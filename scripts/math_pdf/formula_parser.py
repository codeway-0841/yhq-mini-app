"""
scripts/math_pdf/formula_parser.py
Layout-based semantic formula AST builder and LaTeX emitter.
Reconstructs fractions from vector lines, systems of equations from
curly bracket glyphs, radicals with degrees, superscripts, subscripts,
and mathematical operators using geometry and typography.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Any, Sequence
import pymupdf

from scripts.math_pdf.source_reader import GlyphAtom, SpanAtom, LineAtom, DrawingAtom


GREEK_MAP = {
    "α": r"\alpha", "β": r"\beta", "γ": r"\gamma", "δ": r"\delta",
    "λ": r"\lambda", "μ": r"\mu", "π": r"\pi", "ρ": r"\rho",
    "φ": r"\varphi", "ω": r"\omega", "θ": r"\theta",
}

SYMBOL_MAP = {
    "·": r"\cdot ", "×": r"\times ", "≤": r"\le ", "≥": r"\ge ",
    "≠": r"\ne ", "≈": r"\approx ", "∞": r"\infty ", "∈": r"\in ",
    "∉": r"\notin ", "∪": r"\cup ", "∩": r"\cap ", "⊂": r"\subset ",
    "∥": r"\parallel ", "⊥": r"\perp ", "→": r"\to ", "∠": r"\angle ",
    "∅": r"\emptyset ", "△": r"\triangle ",
}

SYSTEM_CHARS = set("⎧⎪⎨⎩\x0e")

def _strip_trailing_punct(spans: list[SpanAtom]) -> list[SpanAtom]:
    """
    Drops trailing sentence-punctuation spans from a fraction pool
    ('-\\frac{9}{13 .}' -> '-\\frac{9}{13}.'): a fraction side never ends
    with '.', ',', ';', ':' — those belong to the sentence outside.
    Only the LAST span, only if it is punctuation-only.
    """
    out = list(spans)
    while out and out[-1].text.strip() in {".", ",", ";", ":"}:
        out.pop()
    return out


def _script_join(cur: str, addition: str) -> str:
    """
    Joins rendered text into an open script group, inserting a space at
    letter-letter boundaries ('lg'+'x' -> 'lg x', never 'lgx' which forms
    the undefined command '\\lgx'; digits/symbols attach directly).
    """
    if cur and re.search(r"[a-zA-Zα-ωΑ-Ω]$", cur) and re.match(r"^[a-zA-Zα-ωΑ-Ω]", addition):
        return cur + " " + addition
    return cur + addition


def _close_join(group: str, addition: str) -> str:
    """Appends inside the group's closing brace ('^{a}' + 'b' -> '^{ab}')."""
    assert group.endswith("}")
    return _script_join(group[:-1], addition) + "}"

# Words allowed inside fraction numerators/above-bar spans (all else with
# 4+ letters counts as prose). Apostrophes included: Uzbek 'bo‘lsa' must
# read as ONE word (029-07 family: prose-numerator false fractions).
_MATH_WORDS = frozenset({
    "sinh", "cosh", "tanh", "ctgh", "arcsin", "arccos", "arctg",
    "arcctg", "atan", "asin", "acos",
})
_WORD_RE = r"[a-zA-Z‘’'ʼа-яА-Я]{4,}"
# Short Uzbek particles that are never math (001-25: 'va' glued into a
# fraction as '\frac{va}{AC}'). Compared lowercased against whole tokens;
# longer prose is already caught by _WORD_RE + _MATH_WORDS.
_STOPWORDS = frozenset({
    "va", "ni", "bu", "u", "ga", "da", "dan", "ham", "deb", "esa",
    "yoki", "bo",
})

# Conservative radicand token for LINEAR root fallback (geometric overbar
# path handles stacked roots). Attaches: paren groups, 1-3 digits, or 1-3
# letters that do NOT continue into a longer word AND are followed by
# end-of-text, an operator, punctuation or a backslash ('√ab + c' attaches;
# prose '√ni soddalashtiring' / '√agar' never does). Marker guard keeps
# 'B)' out (006-15).
_ROOT_TK = (r"(\([^()\n]*\)|\d{1,3}|(?![A-D]\))[A-Za-zα-ωΑ-Ω]{1,3}"
           r"(?![A-Za-zα-ωΑ-Ω])(?=\s*($|[+\-*/=<>≤≥(),;.\]}|\\0-9])))")

# Option markers must never be consumed as formula parts (radicand,
# numerator, denominator). Local copy of the option_parser pattern
# (option_parser imports this module, so no module-level import possible).
_MARKER_RE = re.compile(r"(?<![a-zA-Zа-яА-Я0-9_\\\^∩∪])([ABCD])\s*\)")


def span_has_marker(text: str) -> bool:
    """True if a span carries an A)/B)/C)/D) option marker."""
    return _MARKER_RE.search(text) is not None


def _has_prose(text: str) -> bool:
    """True if a span carries prose words (radicands/numerators never do)."""
    words = re.findall(_WORD_RE, text)
    return any(w.lower() not in _MATH_WORDS for w in words)


@dataclass
class ASTNode:
    def to_latex(self) -> str:
        raise NotImplementedError


@dataclass
class TextNode(ASTNode):
    text: str
    def to_latex(self) -> str:
        return self.text


@dataclass
class FractionNode(ASTNode):
    numerator: str
    denominator: str
    def to_latex(self) -> str:
        return f"\\frac{{{self.numerator}}}{{{self.denominator}}}"


@dataclass
class RadicalNode(ASTNode):
    radicand: str
    degree: str | None = None
    def to_latex(self) -> str:
        if self.degree:
            return f"\\sqrt[{self.degree}]{{{self.radicand}}}"
        return f"\\sqrt{{{self.radicand}}}"


@dataclass
class CasesNode(ASTNode):
    equations: list[str]
    def to_latex(self) -> str:
        eqs = " \\\\\n".join(self.equations)
        return f"\\begin{{cases}}\n{eqs}\n\\end{{cases}}"


def normalize_typography(text: str) -> str:
    """Normalize ligatures, unicode symbols, minus signs, and degrees."""
    if not text:
        return ""
    text = (
        text.replace("ﬃ", "ffi")
        .replace("ﬄ", "ffl")
        .replace("ﬂ", "fl")
        .replace("ﬁ", "fi")
        .replace("ﬀ", "ff")
        .replace("−", "-")
        # U+2032 PRIME (derivatives f′) -> ASCII apostrophe: KaTeX renders
        # f^{'} as a prime in strict mode; U+2032 is an unknown symbol.
        .replace("′", "'")
        # U+02D9 DOT ABOVE between math letters ('π˙k') is print dust, not a
        # multiplication dot (verified by source crop for 042-22: 'πk' is
        # tight). A real times-dot extracts as U+00B7/U+22C5 (mapped below).
        .replace("˙", "")
    )
    for s, r in SYMBOL_MAP.items():
        text = text.replace(s, r)
    for g, r in GREEK_MAP.items():
        text = text.replace(g, r)

    # Degrees: 30° -> 30^{\circ} (SINGLE backslash).
    # NOTE: plain str.replace inserts backslashes literally, so the
    # replacement below must be a non-raw "^{\\circ}" (= one backslash).
    # r1 handles an optional existing caret; r2 digit+degree; the plain
    # replace catches lone '°' after space/paren/letter (old code emitted
    # invalid double-backslash '^{\\circ}' here = 739 broken items).
    text = re.sub(r"\^?\{?[\u25e6°]\}?", r"^{\\circ}", text)
    text = re.sub(r"(\d+)\s*[\u25e6°]", r"\1^{\\circ}", text)
    text = text.replace("\u25e6", "^{\\circ}").replace("°", "^{\\circ}")
    # Collapse nested degree wraps from sup-detection (e.g. '^{^{\\circ}}' -> '^{\\circ}').
    # The inner '(\^{)+' requires at least one nested opener, otherwise the
    # pattern eats STRUCTURAL braces ('\frac{..^{\circ}}{..}' lost its '}{').
    text = re.sub(r"\^\{(\^\{)+\\circ\}(\})+", r"^{\\circ}", text)
    # NOTE: no generic '^{+…}+' collapsing: it eats structural '}}'
    # (006-22 '\frac{..}{..}' junction). Nested case above suffices.

    # Vectors
    text = re.sub(r"[\u20d7\u20d6⃗]\s*\\frac\{([a-zA-Z])", r"\\frac{\\vec{\1}", text)
    text = re.sub(r"[\u20d7\u20d6⃗]([a-zA-Z])", r"\\vec{\1}", text)
    text = re.sub(r"([a-zA-Z])[\u20d7\u20d6⃗]", r"\\vec{\1}", text)
    text = re.sub(r"([a-zA-Z])[\u00af¯]", r"\\vec{\1}", text)
    text = re.sub(r"[\u00af¯]([a-zA-Z])", r"\\vec{\1}", text)
    text = re.sub(r"-+\\to\s*([A-Za-z0-9_]+)", r"\\vec{\1}", text)
    text = text.replace("\u00af", "").replace("¯", "").replace("\u20d7", "").replace("\u20d6", "")

    # Trig powers are owned by GEOMETRY (small raised digits become ^{...}
    # before this function runs). A text regex like 'sin\s*([2346])' cannot
    # tell powers ('sin²x') from angle coefficients ('sin 2°') and corrupts
    # the latter into '\sin^{2\circ}' (006-22) — so there is NO such regex.
    # (Legacy math_formula_builder.py keeps its own copy; see note there.)
    text = re.sub(r"(?<!\\operatorname\{)\b(arcctg|arctg)\b(?!\})", r"\\operatorname{\1}", text)
    text = re.sub(r"(?<!\\operatorname\{)\b(ctg|tg)\b(?!\})", r"\\operatorname{\1}", text)
    text = re.sub(r"(\\operatorname\{)+([a-zA-Z]+)\}+", r"\\operatorname{\2}", text)

    # Greek / pi parameter spacing (e.g. \pin, \pik -> \pi n, \pi k)
    text = re.sub(r"\\pi([a-zA-Z]+)", r"\\pi \1", text)
    text = re.sub(r"π\s*([a-zA-Z])\b", r"\\pi \1", text)

    # Logarithms: log2 x -> \log_{2} x
    # (?<!\\) guards: normalize runs multiple passes (row + final); without
    # the guard '\log_{2}' re-matches as bare 'log' and doubles to '\\log'.
    text = re.sub(r"(?<!\\)\blog\s*([0-9]+)\b", r"\\log_{\1}", text)
    # lg / ln function names (KaTeX-native); subscripts stay geometric.
    text = re.sub(r"(?<!\\)\blg\b", r"\\lg", text)
    text = re.sub(r"(?<!\\)\bln\b", r"\\ln", text)
    # Upright function commands for geometric subscripts:
    # 'log_{0,5}' -> '\log_{0,5}' (renderer understands CMD_{...}).
    text = re.sub(r"(?<!\\)\b(log|ln|lg|sin|cos|tg|ctg|arcsin|arccos|arctg|arcctg)_\{([^}]*)\}",
                  r"\\\1_{\2}", text)

    # Radicals. Linear fallback is deliberately conservative (see _ROOT_TK:
    # stacked roots are resolved geometrically instead).
    # NO bare-digit degree rule ('3√x' -> '\sqrt[3]{x}'): a full-size digit
    # before '√' is ALWAYS a coefficient in TeX print (true degrees are
    # small and get sup-wrapped by geometry into the '^{d}' rules below).
    # The bare rule corrupted coefficients ('3√3' -> '\sqrt[3]{3}', 001-05).
    # The (?![A-D]\)) guard keeps option markers out of radicands:
    # '⁵√B)' must stay marker B), not '\sqrt[5]{B}' (006-15 regression).
    _TK = _ROOT_TK
    # Sup-wrapped degree from geometry rendering: '^{3} √x' -> '\sqrt[3]{x}'
    text = re.sub(r"\^\{([23456789])\}\s*\\sqrt\{", r"\\sqrt[\1]{", text)
    text = re.sub(r"\^\{([23456789])\}\s*√\s*" + _TK, r"\\sqrt[\1]{\2}", text)
    # Degree AFTER the root glyph (overlapping small digit sorts after '√'):
    # '√ ^{3} x' -> '\sqrt[3]{x}'; repairs inside-group damage too.
    text = re.sub(r"√\s*\^\{([23456789])\}\s*" + _TK, r"\\sqrt[\1]{\2}", text)
    text = re.sub(r"\\sqrt\{\^\{([23456789])\}\s*(?=[^}\s])", r"\\sqrt[\1]{", text)
    text = re.sub(r"√\s*" + _TK, r"\\sqrt{\1}", text)
    # Sentence dot glued inside a root ('\sqrt{2.}' -> '\sqrt{2}.').
    # Decimal dots are never last ('2.5}' untouched).
    text = re.sub(r"\\sqrt((\[[^\]]*\])?)\{([^{}]*?)\.\}", r"\\sqrt\1{\3}.", text)
    # Unresolved lone '√' -> visible placeholder (KaTeX-valid, greppable),
    # never silent empty '\sqrt{}'. Trailing space keeps following prose
    # separate ('\sqrt{?} ni', not '\sqrt{?}ni').
    text = text.replace("√", r"\sqrt{?} ")

    # Large parentheses, brackets, and mathematical extension glyphs
    text = re.sub(r"[\x18\x17]{2,}", "|", text)
    text = re.sub(r"[⎛⎜⎝\x0c\x06\x17\x1a]+", r"\\left(", text)
    text = re.sub(r"[⎞⎟⎠\r\x07\x18\x1b]+", r"\\right)", text)
    text = re.sub(r"[\x10\x02\x08\x15]+", r"[", text)
    text = re.sub(r"[\x11\x03\x09\x16]+", r"]", text)
    text = re.sub(r"[\x13\x14\x19\x1f]+", r"\\cup ", text)
    # CMEX10 U+0005 is the big union operator between intervals
    # ('(−∞;−9)\x05(8;∞)' = A) of 001-18, proven by source crop).
    text = text.replace("\x05", r"\cup ")
    text = text.replace("\x0f", "").replace("\x12", "").replace("\x04", "")
    text = re.sub(r"(?:\\left\s*\(\s*){2,}", r"\\left(", text)
    text = re.sub(r"(?:\\right\s*\)\s*){2,}", r"\\right)", text)
    text = re.sub(r"\\left\(\s*\\right\)", "", text)

    # Remove residual system bracket chars from regular text
    text = re.sub(r"[⎧⎪⎨⎩⎫⎬⎭\x0e]+", "", text)

    # Strip any remaining unmapped ASCII control characters (excluding newline and tab)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)

    # Canonical sibling order sub-then-sup for ADJACENT complete groups:
    # 'a^{2}_{1}' -> 'a_{1}^{2}' (identical rendering; canonical form).
    # Strict full-brace form only (never partial digits like '_{0}^{2}, 2}').
    # Tolerates the join space ('a^{2} _{1}').
    text = re.sub(r"([a-zA-Z\)\]])\^\{([^{}]+)\}\s*_\{([^{}]+)\}", r"\1_{\3}^{\2}", text)
    # Detached scripts from column layout: 'log _{2}' -> 'log_{2}'
    text = re.sub(r"([A-Za-z\)\]}])\s+([_\^]\{)", r"\1\2", text)

    # Merge consecutive superscripts e.g. ^{2}^{x} -> ^{2x}
    for _ in range(5):
        text = re.sub(r"\^{([^}]+)}\s*\^{([^}]+)}", r"^{\1\2}", text)

    # Merge consecutive subscripts e.g. _{a}_{1} -> _{a1}
    for _ in range(5):
        text = re.sub(r"_{([^}]+)}\s*_{([^}]+)}", r"_{\1\2}", text)

    # Split glued operator commands from juxtaposed letters
    # ('\cdotlog' from same-run appending -> '\cdot log').
    text = re.sub(r"(\\cdot)(?!s)([a-zA-Z])", r"\1 \2", text)
    text = re.sub(r"(\\to)(?!p)([a-zA-Z])", r"\1 \2", text)
    text = re.sub(r"(\\cup|\\cap|\\pm|\\div)([a-zA-Z])", r"\1 \2", text)

    # Whitespace cleanup. Comma spacing applies before LETTERS only:
    # 'olma,anor' -> 'olma, anor' but math '_{0,2}' / '(0,2)' stay tight
    # (the old unconditional ', ' split subscripts: '_{0, 2}' — v1q21).
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s+,", ",", text)
    text = re.sub(r",\s*(?=[A-Za-z‘’'ʼ])", ", ", text)
    text = re.sub(r"\s*([;])\s*", r"\1 ", text)
    text = re.sub(r"(\d+),\s+(\d+)", r"\1,\2", text)
    text = re.sub(r"\s+([)\]}])", r"\1", text)
    text = re.sub(r"([(\[{])\s+", r"\1", text)
    return text.strip()


class ScriptRenderer:
    """
    Renders spans with superscript/subscript detection, including CASCADED
    (nested) scripts: '(sin80°)^{x²+x−72}' has level-1 sup spans (7.96pt)
    with a level-2 '2' (5.97pt) raised above 'x' (001-18: 'x2' regression).

    A small span attaches to the previous span when it is sufficiently
    smaller AND raised (sup) above the previous span's top; otherwise it
    starts a new script unit relative to the line base.
    """

    def __init__(self, base_size: float, base_y1: float, line_y0: float):
        self.base_size = base_size
        self.base_y1 = base_y1
        self.line_y0 = line_y0
        self.parts: list[str] = []
        self.prev: SpanAtom | None = None
        self.prev_is_sup = False
        self.prev_is_sub = False
        # One-span lookahead buffer for root degrees: a small digit that may
        # precede '√' (inline '∛x' where the degree's y is ambiguous).
        self.pending: SpanAtom | None = None

    def _already_wrapped(self, norm: str, kind: str) -> bool:
        return re.fullmatch(r"\^\{.*\}", norm) is not None if kind == "sup" \
            else re.fullmatch(r"_\{.*\}", norm) is not None

    def render(self, span: SpanAtom) -> None:
        stext = span.text
        if not stext.strip():
            return
        # Resolve a buffered small digit first (see buffering below).
        if self.pending is not None:
            pd = self.pending
            self.pending = None
            if (stext.lstrip().startswith("√")
                    and 0.0 <= span.bbox.x0 - pd.bbox.x1 <= 8.0
                    and abs((span.bbox.y0 + span.bbox.y1) / 2.0
                            - (pd.bbox.y0 + pd.bbox.y1) / 2.0) <= 10.0):
                # Root degree ('∛x'): emit '^{d}' prefix; the root renders
                # normally and downstream rules build '\sqrt[d]{...}'.
                self.parts.append("^{" + normalize_typography(pd.text.strip()) + "}")
                self.prev = pd
                self.prev_is_sup = True
                self.prev_is_sub = False
                self._render_inner(span)
                return
            self._render_inner(pd)
        # Buffer a small digit: it may be a root degree (resolved above).
        if (stext.strip() in {"2", "3", "4", "5", "6", "7", "8", "9"}
                and span.size <= self.base_size * 0.82):
            if self.pending is not None:
                old = self.pending
                self.pending = None
                self._render_inner(old)
            self.pending = span
            return
        self._render_inner(span)

    def _render_inner(self, span: SpanAtom) -> None:
        stext = span.text
        if not stext.strip():
            return
        # Decimal-comma joiner inside SUBscripts: 'log_{0,2}' — a small
        # lowered ','/';' nests into the deepest open sub group
        # ('^{log_{0}}' + ',' -> '^{log_{0,}}', not '^{log_{0},}').
        # After a sup ('x^{2}, y') the comma stays outside (plain text).
        if (stext.strip() in {",", ";"} and self.prev_is_sub
                and not self.prev_is_sup
                and span.size <= self.base_size * 0.82):
            p = self.parts[-1]
            if p.endswith("}"):
                # Nest into the deepest open sub group: the last '}' before
                # the final one closes it ('^{log_{0}}' -> '^{log_{0,}}').
                idx = p.rfind("}", 0, len(p) - 1)
                if idx != -1:
                    self.parts[-1] = p[:idx] + stext.strip() + p[idx:]
                else:
                    self.parts[-1] = p[:-1] + stext.strip() + "}"
            else:
                self.parts.append(stext.strip())
            return
        # Continuation after a joined comma: '_{0,}' + '2' -> '_{0,2}'.
        # The digit may sit at comma height rather than lowered (log_{0,2}
        # family), so horizontal adjacency also qualifies. The pending comma
        # may sit one or two braces deep ('_{0,}' or '^{log_{0,}}').
        if ((self.prev_is_sup or self.prev_is_sub) and self.parts
                and re.search(r"[;,]\}{1,2}$", self.parts[-1])
                and span.size <= self.base_size * 0.82):
            y_ok = ((self.prev_is_sub and span.bbox.y0 > self.line_y0 + 2.0)
                    or (self.prev_is_sup and span.bbox.y1 < self.base_y1 - 2.0))
            x_ok = self.prev is not None and 0.0 <= span.bbox.x0 - self.prev.bbox.x1 <= 8.0
            if y_ok or x_ok:
                # Nest beside the comma (deepest open group).
                p = self.parts[-1]
                inner = p[:-1]
                idx = inner.rfind("}")
                if idx != -1:
                    self.parts[-1] = inner[:idx] + normalize_typography(stext) + inner[idx:] + "}"
                else:
                    self.parts[-1] = inner + normalize_typography(stext) + "}"
                self.prev = span
                return
        if stext.strip() and span.size <= self.base_size * 0.82:
            # Cascaded sup: smaller and raised above the PREVIOUS span
            # ('(sin80°)^{x²}': level-2 '2' nests INSIDE level-1 '^{x}').
            if (self.prev is not None and self.prev_is_sup
                    and span.size <= self.prev.size * 0.85
                    and span.bbox.y1 < self.prev.bbox.y1 - 1.0):
                inner = normalize_typography(stext)
                self.parts[-1] = _close_join(self.parts[-1], "^{" + inner + "}")
                self.prev = span
                return
            # Level-3 sub inside a sup: smaller and lowered vs the PREVIOUS
            # sup span ('2^{log_{0,2}}': '0' nests as '_{0}' inside '^{log}').
            if (self.prev is not None and self.prev_is_sup
                    and span.size <= self.prev.size * 0.85
                    and span.bbox.y0 > self.prev.bbox.y0 + 1.0):
                inner = normalize_typography(stext)
                self.parts[-1] = _close_join(self.parts[-1], "_{" + inner + "}")
                self.prev = span
                self.prev_is_sup = False
                self.prev_is_sub = True
                return
            # Cascaded sub: smaller and lowered below the PREVIOUS span
            if (self.prev is not None and self.prev_is_sub
                    and span.size <= self.prev.size * 0.85
                    and span.bbox.y0 > self.prev.bbox.y0 + 1.0):
                inner = normalize_typography(stext)
                self.parts[-1] = _close_join(self.parts[-1], "_{" + inner + "}")
                self.prev = span
                return
            # Level-3 sup inside a sub: smaller and raised vs previous sub.
            if (self.prev is not None and self.prev_is_sub
                    and span.size <= self.prev.size * 0.85
                    and span.bbox.y1 < self.prev.bbox.y1 - 1.0):
                inner = normalize_typography(stext)
                self.parts[-1] = _close_join(self.parts[-1], "^{" + inner + "}")
                self.prev = span
                self.prev_is_sup = True
                self.prev_is_sub = False
                return
            if span.bbox.y1 < self.base_y1 - 2.0:
                norm = normalize_typography(stext)
                if self._already_wrapped(norm, "sup"):
                    self.parts.append(norm)  # e.g. lone '°' already '^{\circ}'
                elif self.prev_is_sup and self.parts and self.parts[-1].endswith("}"):
                    # Same script run: exponent content ('log(x)·…', 'x²+x')
                    # joins one sup group instead of '^{a}^{b}' (KaTeX
                    # double-superscript error).
                    self.parts[-1] = _close_join(self.parts[-1], norm)
                elif (self.prev_is_sub and not self.prev_is_sup and self.parts
                        and self.parts[-1].endswith("}")
                        and self.prev is not None
                        and -8.0 <= span.bbox.x0 - self.prev.bbox.x1 <= 8.0):
                    # Sibling sup after sub ('a_{1}^{2}'): same base,
                    # adjacent column -> concatenate, no space.
                    self.parts[-1] = _script_join(self.parts[-1], "^{" + norm + "}")
                else:
                    self.parts.append("^{" + norm + "}")
                self.prev = span
                self.prev_is_sup = True
                self.prev_is_sub = False
                return
            elif span.bbox.y0 > self.line_y0 + 2.0:
                norm = normalize_typography(stext)
                if self._already_wrapped(norm, "sub"):
                    self.parts.append(norm)
                elif self.prev_is_sub and self.parts and self.parts[-1].endswith("}"):
                    self.parts[-1] = _close_join(self.parts[-1], norm)
                elif (self.prev_is_sup and not self.prev_is_sub and self.parts
                        and self.parts[-1].endswith("}")
                        and self.prev is not None
                        and -8.0 <= span.bbox.x0 - self.prev.bbox.x1 <= 8.0):
                    # Sibling sub after sup ('log^{2}_{0,2}'): same base,
                    # adjacent column -> concatenate, no space.
                    self.parts[-1] = _script_join(self.parts[-1], "_{" + norm + "}")
                elif stext.strip() in {",", ";"}:
                    # Punctuation after non-sub context stays plain text
                    # ('x^{2}, y' must not become 'x^{2}_{,} y').
                    self.parts.append(stext.strip())
                    self.prev = span
                    self.prev_is_sup = False
                    self.prev_is_sub = False
                    return
                else:
                    self.parts.append("_{" + norm + "}")
                self.prev = span
                self.prev_is_sup = False
                self.prev_is_sub = True
                return
        self.parts.append(stext)
        self.prev = span
        self.prev_is_sup = False
        self.prev_is_sub = False

    def result(self) -> str:
        # Flush a buffered degree digit normally (no root followed).
        if self.pending is not None:
            pd = self.pending
            self.pending = None
            self._render_inner(pd)
        # Script units attach to their base without space ('n^{2}', not 'n ^{2}').
        return re.sub(r"\s+([\^_]\{)", r"\1", " ".join(self.parts))


def render_span_with_scripts(
    span: SpanAtom,
    base_size: float,
    base_y1: float,
    line_y0: float,
) -> str:
    """
    Single-span convenience wrapper (no cascade context).
    Prefer ScriptRenderer for ordered span sequences.
    """
    r = ScriptRenderer(base_size, base_y1, line_y0)
    r.render(span)
    return r.result()


def render_span_pool_with_scripts(spans: list[SpanAtom]) -> str:
    """Renders numerator/denominator span pools with sup/sub preserved."""
    ordered = sorted(spans, key=lambda s: s.bbox.x0)
    sized = [s for s in ordered if s.text.strip()]
    if not sized:
        return ""
    base_size = max(s.size for s in sized)
    if base_size < 10.0:
        base_size = 11.95  # all-small pool (e.g. split exponent): assume base
    base_y1 = max(s.bbox.y1 for s in sized)
    line_y0 = min(s.bbox.y0 for s in sized)
    # Space-joined (like legacy row rendering): source spans often carry no
    # inter-word spaces, and math spacing is insignificant for KaTeX.
    r = ScriptRenderer(base_size, base_y1, line_y0)
    for s in ordered:
        r.render(s)
    return r.result()


def build_line_text_with_typography(line: LineAtom) -> str:
    """
    Renders a line atom into text while turning superscript/subscript spans
    into LaTeX exponents ^{...} and subscripts _{...} based on font size and baseline offset.
    """
    if not line.spans:
        return ""

    # Estimate base font size for the line
    sizes = [s.size for s in line.spans if s.text.strip()]
    base_size = max(sizes) if sizes else 10.0
    base_y1 = max(s.bbox.y1 for s in line.spans if s.text.strip()) if sizes else line.y1

    r = ScriptRenderer(base_size, base_y1, line.y0)
    for s in line.spans:
        if not s.text:
            continue
        r.render(s)

    line_raw = r.result()
    return normalize_typography(line_raw)


def cluster_lines_into_rows(lines: list[LineAtom], row_tol: float = 6.0, gutter: float = 297.5) -> list[list[LineAtom]]:
    """
    Clusters lines within a segment into horizontal visual rows.
    Preserves column sequence (Column 0 lines before Column 1 lines)
    so cross-column questions read in correct order.
    """
    if not lines:
        return []

    # Partition lines into column groups preserving sequential stream
    groups: list[list[LineAtom]] = []
    curr_key: bool | None = None
    curr_group: list[LineAtom] = []

    for l in lines:
        is_right = (l.x0 >= gutter)
        if is_right != curr_key:
            if curr_group:
                groups.append(curr_group)
            curr_group = [l]
            curr_key = is_right
        else:
            curr_group.append(l)
    if curr_group:
        groups.append(curr_group)

    all_rows: list[list[LineAtom]] = []
    for grp in groups:
        sorted_lines = sorted(grp, key=lambda l: (l.y0 + l.y1) / 2.0)
        rows: list[list[LineAtom]] = []
        curr_row: list[LineAtom] = [sorted_lines[0]]

        for l in sorted_lines[1:]:
            cy_curr = (curr_row[-1].y0 + curr_row[-1].y1) / 2.0
            cy_l = (l.y0 + l.y1) / 2.0
            if abs(cy_l - cy_curr) <= row_tol:
                curr_row.append(l)
            else:
                rows.append(curr_row)
                curr_row = [l]
        rows.append(curr_row)

        for r in rows:
            r.sort(key=lambda l: l.x0)
        all_rows.extend(rows)

    # Post-pass: a LONE-'√' line belongs to the row whose y-band contains
    # its baseline with margin (tall root glyphs sort early by center and
    # scramble word order, e.g. Q10 'ko‘p √ yechimga' instead of
    # 'ko‘p yechimga ega. √…'). Only exact lone-√ lines relocate.
    for _ in range(3):  # settle moves
        moved_any = False
        for ri, r in enumerate(all_rows):
            for lone in list(r):
                if lone.text.strip() != "√":
                    continue
                best: int | None = None
                best_gap = 1e9
                for rj, r2 in enumerate(all_rows):
                    if rj == ri or not r2:
                        continue
                    others = [l for l in r2 if l is not lone]
                    if not others:
                        continue
                    ry0 = min(l.y0 for l in others)
                    ry1 = max(l.y1 for l in others)
                    if ry0 + 1.0 <= lone.bbox.y1 <= ry1 - 1.0:
                        gap = abs((ry0 + ry1) / 2.0 - (lone.y0 + lone.y1) / 2.0)
                        if gap < best_gap:
                            best, best_gap = rj, gap
                if best is not None:
                    r.remove(lone)
                    all_rows[best].append(lone)
                    all_rows[best].sort(key=lambda l: l.x0)
                    moved_any = True
        all_rows = [r for r in all_rows if r]
        if not moved_any:
            break

    return all_rows


def detect_sqrt_groups(
    ordered_lines: list[LineAtom],
    h_lines: list[DrawingAtom],
    frac_claims: dict[int, float] | None = None,
    blocked: set[int] | None = None,
) -> list[tuple[str, set[int]]]:
    """
    Finds '√' glyph spans with vector overbars and resolves true radicands
    geometrically (instead of guessing linearly).

    Returns [(latex, used_span_ids)].
    - overbar: horizontal drawing starting near the '√' top, extending right.
    - radicand: spans under the overbar band.
    - degree: digit span immediately left of '√' on the same baseline.
    Spans of a group are consumed (excluded from fractions/rows).
    - frac_claims: span_id -> fraction-bar y0 for spans already claimed by
      COMPLETE fractions. A group intersecting claimed spans is skipped,
      unless its overbar sits clearly ABOVE every conflicting bar
      (nested root containing a fraction, e.g. '√(1/2)').
    """
    all_spans = [s for l in ordered_lines for s in l.spans
                 if s.text.strip() and (blocked is None or id(s) not in blocked)]
    groups: list[tuple[str, set[int]]] = []
    used: set[int] = set(blocked) if blocked else set()
    for l in ordered_lines:
        for s in l.spans:
            if id(s) in used or "√" not in s.text:
                continue
            # Only handle lone-'√' spans here; inline '√x' is left to regex.
            if s.text.strip() != "√":
                continue
            sy0, sy1, sx1 = s.bbox.y0, s.bbox.y1, s.bbox.x1
            best = None
            best_dx = 1e9
            for h in h_lines:
                if h.x1 - h.x0 < 4.0:
                    continue
                if not (sy0 - 4.0 <= h.y0 <= sy0 + 12.0):
                    continue
                if not (s.bbox.x0 - 2.0 <= h.x0 <= sx1 + 12.0):
                    continue
                # Fraction-bar discriminator: a fraction bar has text on BOTH
                # Fraction-bar discriminator: a fraction bar has MATH on BOTH
                # sides (numerator above, denominator below). A radical
                # overbar has text only BELOW (the radicand). Full-size text
                # above is evidence of a numerator — UNLESS it is prose
                # (a sentence line like Q10's '...cheksiz ko'p' above an
                # inline root's overbar). Prose words => not a numerator.
                # Only CLOSE text (bottom within 10pt above the bar) counts:
                # a numerator farther up belongs to another bar (Q12's
                # fraction numerator vs the root overbar below it).
                above = False
                for c in all_spans:
                    if c is s or "√" in c.text or not c.text.strip():
                        continue
                    if c.size < 9.0:
                        continue  # sup/sub/degree glyphs may poke above; ignore
                    cy = (c.bbox.y0 + c.bbox.y1) / 2.0
                    if h.y0 - 24.0 <= cy <= h.y0 - 1.0 \
                            and c.bbox.y1 >= h.y0 - 10.0 \
                            and c.bbox.x0 <= h.x1 and c.bbox.x1 >= h.x0:
                        words = re.findall(_WORD_RE, c.text)
                        if any(w.lower() not in _MATH_WORDS for w in words):
                            continue  # prose sentence, not a numerator
                        above = True
                        break
                if above:
                    continue
                dx = abs(h.x0 - sx1)
                if dx < best_dx:
                    best, best_dx = h, dx
            if best is None:
                continue
            radicand = [
                c for c in all_spans
                if id(c) not in used and c is not s
                and not span_has_marker(c.text)
                and not _has_prose(c.text)
                and sy0 - 3.0 <= (c.bbox.y0 + c.bbox.y1) / 2.0 <= sy1 + 14.0
                and c.bbox.x0 >= s.bbox.x0 - 1.0
                and c.bbox.x1 <= best.x1 + 6.0
            ]
            if not radicand:
                continue
            # Fraction conflict: spans already claimed by a COMPLETE fraction
            # belong to it (Q7's '√ab' inside '1/(a-√ab)'), unless this root
            # demonstrably contains the fraction (overbar above its bar).
            if frac_claims:
                conflicting = {frac_claims[i] for c in radicand + [s]
                               for i in [id(c)] if i in frac_claims}
                if conflicting and not all(best.y0 < by - 2.0 for by in conflicting):
                    continue
            # Degree digit immediately left of '√' (small glyph, possibly
            # overlapping the root's left edge, e.g. 084-05 '∛x').
            # Size guard: a full-size '2' in '2√x' is a coefficient, NOT a degree.
            degree = ""
            for c in all_spans:
                if id(c) in used or c is s:
                    continue
                if c.text.strip() in {"2", "3", "4", "5", "6", "7", "8", "9"} \
                        and c.size <= 9.0 \
                        and abs((c.bbox.y0 + c.bbox.y1) / 2.0 - (sy0 + sy1) / 2.0) <= 6.0 \
                        and -6.0 <= s.bbox.x0 - c.bbox.x1 <= 8.0:
                    degree = c.text.strip()
                    radicand.append(c)
                    break
            radicand_text = normalize_typography(render_span_pool_with_scripts(radicand))
            latex = f"\\sqrt[{degree}]{{{radicand_text}}}" if degree else f"\\sqrt{{{radicand_text}}}"
            ids = {id(c) for c in radicand} | {id(s)}
            used.update(ids)
            groups.append((latex, ids))
    return groups


def _pools_for_bar(
    h: DrawingAtom,
    all_spans: list[SpanAtom],
    excluded: set[int],
) -> tuple[list[SpanAtom], list[SpanAtom]] | None:
    """
    Numerator/denominator span pools for one horizontal bar, or None when
    the bar is not a fraction bar (prose above/below, unreadable sides,
    marker spans). Pure geometry + content gates; no consumption.
    """
    x_pad = 5.0
    num_spans = [
        s for s in all_spans
        if id(s) not in excluded
        and not span_has_marker(s.text)
        and h.x0 - x_pad <= s.bbox.x0 and s.bbox.x1 <= h.x1 + x_pad
        and h.y0 - 24.0 <= s.bbox.y0 <= h.y0 + 0.5
        and s.bbox.y1 <= h.y0 + 1.5
    ]
    den_spans = [
        s for s in all_spans
        if id(s) not in excluded
        and not span_has_marker(s.text)
        and h.x0 - x_pad <= s.bbox.x0 and s.bbox.x1 <= h.x1 + x_pad
        # Band: denominator rows often START above the bar (tall
        # root glyphs like '√x−12' in Q8 or '√ab' in Q7's small
        # fractions). The y1 guard excludes pure-above spans.
        # Upper edge +6: rows starting farther below belong to the NEXT
        # structure (006-09: next option's numerator 'π' leaked into den).
        and h.y1 - 12.0 <= s.bbox.y0 <= h.y1 + 6.0
        and s.bbox.y1 >= h.y1 - 1.0
    ]

    if num_spans and den_spans:
        # Bar coverage: a real fraction bar carries content across its
        # length. A column-wide rule (006-09: 215pt separator with two
        # isolated span clusters) is never a fraction bar.
        covered = 0.0
        for s in num_spans + den_spans:
            a = max(s.bbox.x0, h.x0)
            b = min(s.bbox.x1, h.x1)
            if b > a:
                covered += b - a
        if covered < 0.45 * (h.x1 - h.x0):
            return None
        # Overlap resolution: a tall span (root glyph, big paren piece)
        # can qualify for BOTH pools (006-09: numerator 'π' also landed
        # in the denominator). Assign by vertical center vs the bar.
        bar_mid = (h.y0 + h.y1) / 2.0
        shared = {id(s) for s in num_spans} & {id(s) for s in den_spans}
        if shared:
            num_spans = [s for s in num_spans
                         if id(s) not in shared
                         or (s.bbox.y0 + s.bbox.y1) / 2.0 < bar_mid]
            den_spans = [s for s in den_spans
                         if id(s) not in shared
                         or (s.bbox.y0 + s.bbox.y1) / 2.0 >= bar_mid]
            if not num_spans or not den_spans:
                return None
        num_spans = _strip_trailing_punct(sorted(num_spans, key=lambda s: s.bbox.x0))
        den_spans = _strip_trailing_punct(sorted(den_spans, key=lambda s: s.bbox.x0))
        if not num_spans or not den_spans:
            return None
        raw_num = "".join(s.text for s in num_spans)
        raw_den = "".join(s.text for s in den_spans)
        # Both sides need readable content (a lone '+'/'−' under a
        # vector line is not a fraction side).
        if not re.search(r"[\w√]", raw_num, re.UNICODE) or \
           not re.search(r"[\w√]", raw_den, re.UNICODE):
            return None
        # Filter out spurious vector lines under prose sentences
        words = re.findall(_WORD_RE, raw_num + " " + raw_den)
        if any(w.lower() not in _MATH_WORDS for w in words):
            return None
        # ...and short Uzbek particles ('va', 'ni', ...) are never math.
        toks = re.findall(r"[A-Za-z‘’'ʼа-яА-Я]+", raw_num + " " + raw_den)
        if any(t.lower() in _STOPWORDS for t in toks):
            return None
        return num_spans, den_spans
    return None


def reconstruct_fractions_with_drawings(
    lines: list[LineAtom],
    h_lines: list[DrawingAtom],
    blocked: set[int] | None = None,
    cases_latex: str = "",
) -> str:
    """
    Combines lines and horizontal vector drawings to reconstruct algebraic fractions.
    `blocked` (system-cases equation spans) renders only in its own block:
    the cases latex is injected INLINE at the first blocked span (so prose
    like '...progressiyada [CASES] bo‘lsa...' keeps its condition in place),
    and blocked spans are excluded everywhere else.
    """
    blocked_ids = blocked or set()
    # Cluster into visual rows first
    rows = cluster_lines_into_rows(lines)
    ordered_lines = [l for r in rows for l in r]

    if not h_lines:
        def _unblocked(l: LineAtom) -> LineAtom:
            return LineAtom(bbox=l.bbox,
                            spans=[s for s in l.spans if id(s) not in blocked_ids],
                            dir=l.dir)
        row_strings = [" ".join(build_line_text_with_typography(_unblocked(l)) for l in r) for r in rows]
        return "\n".join(normalize_typography(s) for s in row_strings if s.strip())

    # Build glyph pool from all lines
    all_spans = [s for l in ordered_lines for s in l.spans
                 if s.text.strip() and id(s) not in blocked_ids]
    sorted_h = sorted(h_lines, key=lambda h: (h.y0, h.x0))

    # Phase A — tentative fraction pools (no consumption): square-root
    # groups must not steal spans that form a COMPLETE fraction side
    # (Q7's '√ab' inside '1/(a-√ab)').
    tentative: dict[int, tuple[list[SpanAtom], list[SpanAtom]]] = {}
    frac_claims: dict[int, float] = {}
    for hi, h in enumerate(sorted_h):
        pools = _pools_for_bar(h, all_spans, set())
        if pools is not None:
            tentative[hi] = pools
            for s in pools[0] + pools[1]:
                frac_claims.setdefault(id(s), h.y0)

    # Phase B — square-root groups (skip fraction-claimed spans unless the
    # root demonstrably contains the fraction: overbar above its bar).
    sqrt_groups = detect_sqrt_groups(ordered_lines, h_lines, frac_claims, blocked_ids) if h_lines else []
    sqrt_used: set[int] = set()
    for _, ids in sqrt_groups:
        sqrt_used.update(ids)
    sqrt_emitted: set[int] = set()

    # Phase C — finalize fractions, excluding root-consumed spans.
    used_spans: set[int] = set(sqrt_used)
    fraction_replacements: list[tuple[float, float, float, float, str, set[int]]] = []

    for hi, h in enumerate(sorted_h):
        hy = (h.y0 + h.y1) / 2.0
        pools = _pools_for_bar(h, all_spans, used_spans)
        if pools is None:
            continue
        num_spans, den_spans = pools

        # Script-aware rendering: plain joins lose ^{...}/_{...}
        # (regression: 'n^{2}' became 'n2' inside fractions).
        num_text = normalize_typography(render_span_pool_with_scripts(num_spans))
        den_text = normalize_typography(render_span_pool_with_scripts(den_spans))
        # Sentence dots/colons/commas glued to pool edges belong outside
        # ('\sqrt{7.}' -> '\sqrt{7}.'; decimals like '2,75' unaffected).
        num_text = re.sub(r"([0-9a-zA-Z}\)\]])[.,;:]+$", r"\1", num_text)
        den_text = re.sub(r"([0-9a-zA-Z}\)\]])[.,;:]+$", r"\1", den_text)

        span_ids = {id(s) for s in num_spans + den_spans}
        for s in num_spans: used_spans.add(id(s))
        for s in den_spans: used_spans.add(id(s))

        frac_latex = f"\\frac{{{num_text}}}{{{den_text}}}"
        fraction_replacements.append((h.x0, hy, h.x1, hy, frac_latex, span_ids))

    # Reconstruct text rows in-line.
    # IMPORTANT: non-fraction spans are joined RAW per line and normalized at
    # row level (not per-span): per-span normalize splits multi-span math
    # ('√' + 'x' -> empty '\sqrt{}') and drops sup/sub geometry.
    def sqrt_idx_for(span_id: int) -> int | None:
        for gi, (_, ids) in enumerate(sqrt_groups):
            if span_id in ids:
                return gi
        return None

    emitted_fracs: set[int] = set()
    rendered_rows: list[str] = []
    cases_injected = False
    for r in rows:
        # ONE renderer per visual row (shared across its lines): script runs
        # like 'log_{0,2}' keep working even when rawdict splits ',' and '2'
        # into different LineAtoms.
        row_sized = [s for l in r for s in l.spans if s.text.strip()]
        if not row_sized:
            continue
        r_base = max(s.size for s in row_sized)
        if r_base < 10.0:
            r_base = 11.95  # all-small row (split script run): assume base
        r_base_y1 = max(s.bbox.y1 for s in row_sized)
        r_y0 = min(l.y0 for l in r)
        rend = ScriptRenderer(r_base, r_base_y1, r_y0)
        row_parts: list[str] = []
        for l in r:
            l_parts: list[str] = []
            for s in l.spans:
                if not s.text.strip():
                    continue
                if id(s) in blocked_ids:
                    # System-cases equation span: inject the cases block
                    # INLINE here (once) instead of duplicating equations.
                    if cases_latex and not cases_injected:
                        if rend.parts:
                            l_parts.append(rend.result())
                            rend = ScriptRenderer(r_base, r_base_y1, r_y0)
                        l_parts.append(cases_latex)
                        cases_injected = True
                    continue  # rendered in its own block, not in row text
                gi = sqrt_idx_for(id(s))
                if gi is not None:
                    if gi not in sqrt_emitted:
                        # Flush pending script rendering before injecting group latex
                        if rend.parts:
                            l_parts.append(rend.result())
                            rend = ScriptRenderer(r_base, r_base_y1, r_y0)
                        l_parts.append(sqrt_groups[gi][0])
                        sqrt_emitted.add(gi)
                    continue
                # Check if span belongs to a detected fraction
                matched_f_idx = None
                for f_idx, fr in enumerate(fraction_replacements):
                    if id(s) in fr[5]:
                        matched_f_idx = f_idx
                        break
                if matched_f_idx is not None:
                    if matched_f_idx not in emitted_fracs:
                        if rend.parts:
                            l_parts.append(rend.result())
                            rend = ScriptRenderer(r_base, r_base_y1, r_y0)
                        l_parts.append(fraction_replacements[matched_f_idx][4])
                        emitted_fracs.add(matched_f_idx)
                else:
                    rend.render(s)
            if rend.parts:
                l_parts.append(rend.result())
                rend = ScriptRenderer(r_base, r_base_y1, r_y0)
            if l_parts:
                # Space-joined: source spans often lack inter-word spaces;
                # "" join glues words ('tengsizlikniqanoatlantiruvchi') and
                # option markers ('A)x'), breaking option parsing.
                row_parts.append(" ".join(l_parts))
        if row_parts:
            rendered_rows.append(normalize_typography(" ".join(row_parts)))

    # Append any remaining fractions that weren't placed in-line
    full_str = "\n".join(rendered_rows)
    for f_idx, fr in enumerate(fraction_replacements):
        if f_idx not in emitted_fracs and fr[4] not in full_str:
            rendered_rows.append(fr[4])
    for gi, (latex, _) in enumerate(sqrt_groups):
        if gi not in sqrt_emitted and latex not in "\n".join(rendered_rows):
            rendered_rows.append(latex)

    full_text = "\n".join(rendered_rows)
    # NOTE: cross-row '√\nTOKEN' needs no special pass: the linear root
    # rules below use '\s*' (which already spans newlines).
    return normalize_typography(full_text)


def is_system_bracket_span(span: SpanAtom) -> bool:
    if any(c in "⎧⎪⎨⎩" for c in span.text):
        return True
    if "\x0e" in span.text and "CMEX" in span.font.upper():
        return True
    return False


def is_math_equation_candidate(text: str) -> bool:
    t = normalize_typography(text).strip()
    if re.match(r"^\s*\d{1,2}\.\s+", t):
        return False
    if any(rel in t for rel in ["=", "<", ">", "≤", "≥", r"\le", r"\ge", r"\ne"]):
        return True
    stripped = re.sub(r"[0-9a-zA-Z\+\-\*\/\^\_\{\}\(\)\[\]\s\\]", "", t)
    if len(stripped) == 0 and len(t) > 0 and not any(w in t.lower() for w in ["bo", "dastlabki", "hadning", "toping", "agar"]):
        return True
    return False


def reconstruct_system_cases(lines: list[LineAtom]) -> tuple[str, set[int]]:
    r"""
    Detects system of equation curly brackets and formats them as \begin{cases} ... \end{cases}.
    Returns (latex, used_span_ids): equation spans render ONLY in the cases
    block — callers must exclude them from row/fraction rendering, otherwise
    every equation appears twice (037-10 duplication).
    """
    bracket_spans = [s for l in lines for s in l.spans if is_system_bracket_span(s)]
    if not bracket_spans:
        return "", set()

    bracket_x1 = max(s.bbox.x1 for s in bracket_spans)
    bracket_y1 = max(s.bbox.y1 for s in bracket_spans)

    # First option marker y
    first_opt_y = min((l.y0 for l in lines if re.search(r'(?<![a-zA-Zа-яА-Я0-9_\\\^∩∪])[ABCD]\s*\)', l.text)), default=9999.0)
    max_allowed_y = min(first_opt_y, bracket_y1 + 30.0)

    cand_lines: list[LineAtom] = []
    for l in lines:
        if l.y0 >= max_allowed_y:
            continue
        lt = l.text.strip()
        if any(lt.startswith(p) for p in ["tengsizlik", "sistemasi"]):
            continue
        if re.search(r'(?<![a-zA-Zа-яА-Я0-9_\\\^∩∪])[ABCD]\s*\)', lt):
            continue
        if not is_math_equation_candidate(lt):
            if not any(is_system_bracket_span(s) for s in l.spans):
                continue

        valid_spans = [
            s for s in l.spans
            if not is_system_bracket_span(s) and s.text.strip() and s.bbox.x0 >= bracket_x1 - 2.0
            and s.bbox.y1 <= max_allowed_y
        ]
        if valid_spans:
            spans_text = "".join(s.text for s in valid_spans)
            if not is_math_equation_candidate(spans_text):
                continue
            r = pymupdf.Rect(
                min(s.bbox.x0 for s in valid_spans),
                min(s.bbox.y0 for s in valid_spans),
                max(s.bbox.x1 for s in valid_spans),
                max(s.bbox.y1 for s in valid_spans),
            )
            cand_lines.append(LineAtom(bbox=r, spans=valid_spans))

    if not cand_lines:
        return "", set()

    # Cluster equation lines into rows (row gap > 12pt)
    cand_lines.sort(key=lambda l: (round(l.y0, 1), l.x0))
    rows: list[list[LineAtom]] = []
    curr_row: list[LineAtom] = [cand_lines[0]]

    for l in cand_lines[1:]:
        if l.y0 - curr_row[-1].y0 > 12.0:
            rows.append(curr_row)
            curr_row = [l]
        else:
            curr_row.append(l)
    rows.append(curr_row)

    eq_strings: list[str] = []
    used_span_ids: set[int] = set()
    for r in rows:
        row_txt = " ".join(build_line_text_with_typography(l) for l in r)
        # Clean question anchor if it was next to row 1 or 2
        row_txt = re.sub(r"^\d{1,2}\.\s*", "", row_txt).strip()
        # (No blind sup/sub swap: geometry owns script order.)
        if row_txt:
            eq_strings.append(row_txt)
            for l in r:
                for s in l.spans:
                    used_span_ids.add(id(s))

    if len(eq_strings) >= 2:
        return CasesNode(equations=eq_strings).to_latex(), used_span_ids
    return "", set()


