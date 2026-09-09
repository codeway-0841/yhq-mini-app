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
    "∅": r"\emptyset ",
}

SYSTEM_CHARS = set("⎧⎪⎨⎩")


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
    )
    for s, r in SYMBOL_MAP.items():
        text = text.replace(s, r)
    for g, r in GREEK_MAP.items():
        text = text.replace(g, r)

    # Degrees: 30° -> 30^{\circ}
    text = re.sub(r"\^{?[\u25e6°]}?", r"^{\\circ}", text)
    text = re.sub(r"(\d+)\s*[\u25e6°]", r"\1^{\\circ}", text)
    text = text.replace("\u25e6", r"^{\\circ}").replace("°", r"^{\\circ}")
    text = re.sub(r"\^{+\\circ}+", r"^{\\circ}", text)

    # Vectors
    text = re.sub(r"[\u20d7\u20d6⃗]\s*\\frac\{([a-zA-Z])", r"\\frac{\\vec{\1}", text)
    text = re.sub(r"[\u20d7\u20d6⃗]([a-zA-Z])", r"\\vec{\1}", text)
    text = re.sub(r"([a-zA-Z])[\u20d7\u20d6⃗]", r"\\vec{\1}", text)
    text = re.sub(r"([a-zA-Z])[\u00af¯]", r"\\vec{\1}", text)
    text = re.sub(r"[\u00af¯]([a-zA-Z])", r"\\vec{\1}", text)
    text = re.sub(r"-+\\to\s*([A-Za-z0-9_]+)", r"\\vec{\1}", text)
    text = text.replace("\u00af", "").replace("¯", "").replace("\u20d7", "").replace("\u20d6", "")

    # Trig functions and powers
    text = re.sub(r"\b(sin|cos)\s*([2346])\b", r"\\\1^{\2}", text)
    text = re.sub(r"\b(arcctg|arctg)\b", r"\\operatorname{\1}", text)
    text = re.sub(r"\b(ctg|tg)\b", r"\\operatorname{\1}", text)

    # Logarithms: log2 x -> \log_{2} x
    text = re.sub(r"\blog\s*([0-9]+)\b", r"\\log_{\1}", text)

    # Radicals with degree: 3√ -> \sqrt[3]{...}
    text = re.sub(r"\b([23456789])\s*\\?sqrt\{", r"\\sqrt[\1]{", text)
    text = re.sub(r"\b([23456789])\s*√\s*", r"\\sqrt[\1]{", text)
    text = re.sub(r"√\s*([A-Za-z0-9]+(?:\s*[+\-]\s*[A-Za-z0-9]+)?)", r"\\sqrt{\1}", text)
    text = text.replace("√", r"\sqrt{}")

    # Large parentheses and brackets
    text = re.sub(r"[⎛⎜⎝\x0c]+", r"\\left(", text)
    text = re.sub(r"[⎞⎟⎠\r]+", r"\\right)", text)
    text = re.sub(r"[\x10\x02]+", r"[", text)
    text = re.sub(r"[\x11\x03]+", r"]", text)
    text = text.replace("\x0f", "").replace("\x12", "").replace("\x04", "").replace("\x05", "")

    # Remove residual system bracket chars from regular text
    text = re.sub(r"[⎧⎪⎨⎩⎫⎬⎭]+", "", text)

    # Merge consecutive superscripts e.g. ^{2}^{x} -> ^{2x}
    for _ in range(5):
        text = re.sub(r"\^{([^}]+)}\s*\^{([^}]+)}", r"^{\1\2}", text)

    # Merge consecutive subscripts e.g. _{a}_{1} -> _{a1}
    for _ in range(5):
        text = re.sub(r"_{([^}]+)}\s*_{([^}]+)}", r"_{\1\2}", text)

    # Whitespace cleanup
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s*([,;])\s*", r"\1 ", text)
    text = re.sub(r"(\d+),\s+(\d+)", r"\1,\2", text)
    text = re.sub(r"\s+([)\]}])", r"\1", text)
    text = re.sub(r"([(\[{])\s+", r"\1", text)
    return text.strip()


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

    out: list[str] = []
    for s in line.spans:
        stext = s.text
        if not stext:
            continue

        # Check if span is superscript or subscript
        is_small = (s.size <= base_size * 0.82)
        if is_small and stext.strip():
            # Check vertical position
            if s.bbox.y1 < base_y1 - 2.0:
                # Superscript
                clean_sup = normalize_typography(stext)
                out.append(f"^{{{clean_sup}}}")
                continue
            elif s.bbox.y0 > line.y0 + 2.0:
                # Subscript
                clean_sub = normalize_typography(stext)
                out.append(f"_{{{clean_sub}}}")
                continue

        out.append(stext)

    line_raw = "".join(out)
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

    return all_rows


def reconstruct_fractions_with_drawings(
    lines: list[LineAtom],
    h_lines: list[DrawingAtom],
) -> str:
    """
    Combines lines and horizontal vector drawings to reconstruct algebraic fractions.
    """
    # Cluster into visual rows first
    rows = cluster_lines_into_rows(lines)
    ordered_lines = [l for r in rows for l in r]

    if not h_lines:
        row_strings = [" ".join(build_line_text_with_typography(l) for l in r) for r in rows]
        return "\n".join(normalize_typography(s) for s in row_strings if s.strip())

    # Build glyph pool from all lines
    all_spans = [s for l in ordered_lines for s in l.spans if s.text.strip()]

    used_spans: set[int] = set()
    fraction_replacements: list[tuple[float, float, float, float, str, set[int]]] = []

    sorted_h = sorted(h_lines, key=lambda h: (h.y0, h.x0))

    for h in sorted_h:
        hy = (h.y0 + h.y1) / 2.0
        x_pad = 5.0
        num_spans = [
            s for s in all_spans
            if id(s) not in used_spans
            and h.x0 - x_pad <= s.bbox.x0 and s.bbox.x1 <= h.x1 + x_pad
            and h.y0 - 24.0 <= s.bbox.y0 <= h.y0 + 0.5
            and s.bbox.y1 <= h.y0 + 1.5
        ]
        den_spans = [
            s for s in all_spans
            if id(s) not in used_spans
            and h.x0 - x_pad <= s.bbox.x0 and s.bbox.x1 <= h.x1 + x_pad
            and h.y1 - 0.5 <= s.bbox.y0 <= h.y1 + 7.0
        ]

        if num_spans and den_spans:
            raw_num = "".join(s.text for s in num_spans)
            raw_den = "".join(s.text for s in den_spans)
            # Filter out spurious vector lines under prose sentences
            words = re.findall(r"[a-zA-Zа-яА-Я]{4,}", raw_num + " " + raw_den)
            MATH_OK = {"sinh", "cosh", "tanh", "ctgh", "arcsin", "arccos", "arctg", "arcctg", "atan", "asin", "acos"}
            if any(w.lower() not in MATH_OK for w in words):
                continue

            num_spans.sort(key=lambda s: s.bbox.x0)
            den_spans.sort(key=lambda s: s.bbox.x0)

            num_text = normalize_typography(raw_num)
            den_text = normalize_typography(raw_den)

            span_ids = {id(s) for s in num_spans + den_spans}
            for s in num_spans: used_spans.add(id(s))
            for s in den_spans: used_spans.add(id(s))

            frac_latex = f"\\frac{{{num_text}}}{{{den_text}}}"
            fraction_replacements.append((h.x0, hy, h.x1, hy, frac_latex, span_ids))

    # Reconstruct text rows in-line
    emitted_fracs: set[int] = set()
    rendered_rows: list[str] = []
    for r in rows:
        row_parts: list[str] = []
        for l in r:
            l_parts: list[str] = []
            for s in l.spans:
                if not s.text.strip():
                    continue
                # Check if span belongs to a detected fraction
                matched_f_idx = None
                for f_idx, fr in enumerate(fraction_replacements):
                    if id(s) in fr[5]:
                        matched_f_idx = f_idx
                        break
                if matched_f_idx is not None:
                    if matched_f_idx not in emitted_fracs:
                        l_parts.append(fraction_replacements[matched_f_idx][4])
                        emitted_fracs.add(matched_f_idx)
                else:
                    l_parts.append(normalize_typography(s.text))
            if l_parts:
                row_parts.append(" ".join(l_parts))
        if row_parts:
            rendered_rows.append(" ".join(row_parts))

    # Append any remaining fractions that weren't placed in-line
    full_str = "\n".join(rendered_rows)
    for f_idx, fr in enumerate(fraction_replacements):
        if f_idx not in emitted_fracs and fr[4] not in full_str:
            rendered_rows.append(fr[4])

    full_text = "\n".join(rendered_rows)
    return normalize_typography(full_text)


def reconstruct_system_cases(lines: list[LineAtom]) -> str:
    """
    Detects system of equation curly brackets and formats them as \\begin{cases} ... \\end{cases}.
    """
    all_text = " ".join(l.text for l in lines)
    if not any(c in all_text for c in SYSTEM_CHARS):
        return ""

    # Find the curly bracket spans
    bracket_lines = [l for l in lines if any(c in l.text for c in SYSTEM_CHARS)]
    if not bracket_lines:
        return ""

    bracket_x1 = max(
        s.bbox.x1 for l in bracket_lines for s in l.spans if any(c in s.text for c in SYSTEM_CHARS)
    )

    # Group lines to the right of the bracket into equation rows based on y-clustering
    eq_lines = [
        l for l in lines
        if l.x0 >= bracket_x1 - 2.0 and not l.text.strip().startswith("tengsizlik") and not l.text.strip().startswith("sistemasi")
        and not any(c in l.text for c in "ABCD)")
    ]

    if not eq_lines:
        return ""

    # Cluster equation lines into rows (row gap > 10pt)
    eq_lines.sort(key=lambda l: (round(l.y0, 1), l.x0))
    rows: list[list[LineAtom]] = []
    curr_row: list[LineAtom] = [eq_lines[0]]

    for l in eq_lines[1:]:
        if l.y0 - curr_row[-1].y0 > 12.0:
            rows.append(curr_row)
            curr_row = [l]
        else:
            curr_row.append(l)
    rows.append(curr_row)

    eq_strings: list[str] = []
    for r in rows:
        row_txt = " ".join(build_line_text_with_typography(l) for l in r)
        # Clean question anchor if it was next to row 1 or 2
        row_txt = re.sub(r"^\d{1,2}\.\s*", "", row_txt).strip()
        if row_txt:
            eq_strings.append(row_txt)

    if len(eq_strings) >= 2:
        return CasesNode(equations=eq_strings).to_latex()
    return ""
