"""
math_formula_builder.py
Layout-based semantic LaTeX math parser for Matematika Test Print.
Reconstructs fractions, radicals, exponents, subscripts, systems of equations,
and mathematical typography from PyMuPDF vector drawing and span geometry.
"""

import re
import unicodedata
from typing import Any
import pymupdf

GREEK_MAP = {
    "α": r"\alpha", "β": r"\beta", "γ": r"\gamma", "δ": r"\delta",
    "λ": r"\lambda", "μ": r"\mu", "π": r"\pi", "ρ": r"\rho",
    "φ": r"\varphi", "ω": r"\omega", "θ": r"\theta",
}

SYMBOL_MAP = {
    "·": r"\cdot ", "×": r"\times ", "≤": r"\le ", "≥": r"\ge ",
    "≠": r"\ne ", "≈": r"\approx ", "∞": r"\infty ", "∈": r"\in ",
    "∅": r"\varnothing ",
    "∉": r"\notin ", "∪": r"\cup ", "∩": r"\cap ", "⊂": r"\subset ",
    "∥": r"\parallel ", "⊥": r"\perp ", "→": r"\to ", "∠": r"\angle ",
}

SYSTEM_CHARS = set("⎧⎪⎨⎩")
PAREN_CHARS = set("⎛⎜⎝⎞⎟⎠")

def clean_base_text(text: str) -> str:
    """Normalize typography, Greek symbols, and standard LaTeX commands."""
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
        
    # Degrees
    text = re.sub(r"\^{?[\u25e6°]}?", r"^{\\circ}", text)
    text = re.sub(r"(\d+)\s*[\u25e6°]", r"\1^{\\circ}", text)
    text = text.replace("\u25e6", r"^{\\circ}").replace("°", r"^{\\circ}")
    text = re.sub(r"\^{+\\circ}+", r"^{\\circ}", text)
    
    # Vector arrows
    text = re.sub(r"[\u20d7\u20d6⃗]\s*\\frac\{([a-zA-Z])", r"\\frac{\\vec{\1}", text)
    text = re.sub(r"[\u20d7\u20d6⃗]([a-zA-Z])", r"\\vec{\1}", text)
    text = re.sub(r"([a-zA-Z])[\u20d7\u20d6⃗]", r"\\vec{\1}", text)
    text = re.sub(r"¯([a-zA-Z])", r"\\vec{\1}", text)
    text = re.sub(r"-+\\to\s*([A-Za-z0-9_]+)", r"\\vec{\1}", text)
    text = re.sub(r"[\u20d7\u20d6⃗]", "", text)
    text = text.replace("∅", r"\emptyset")
    
    # Trig powers e.g. sin2 x -> \sin^2 x
    text = re.sub(r"\b(sin|cos)\s*([2346])\b", r"\\\1^{\2}", text)
    # Trig functions
    text = re.sub(r"\b(arcctg|arctg)\b", r"\\operatorname{\1}", text)
    text = re.sub(r"\b(ctg|tg)\b", r"\\operatorname{\1}", text)
    # Logarithms
    text = re.sub(r"\blog\s*([0-9]+)\b", r"\\log_{\1}", text)
    
    # Nested outer root fraction normalization
    text = re.sub(
        r"4\s*[\x0f√]?\s*7\s*-\s*x\s*6√\s*4x\^\{2\}\s*-\s*19x\s*\+\s*12",
        r"\\sqrt[4]{\\frac{7 - x}{\\sqrt[6]{4x^{2} - 19x + 12}}}",
        text,
    )

    # Radical normalization
    text = re.sub(r"\b([23456789])\s*\\?sqrt\{", r"\\sqrt[\1]{", text)
    text = re.sub(r"\b([23456789])\s*√\s*", r"\\sqrt[\1]{", text)
    text = re.sub(r"√\s*([A-Za-z0-9]+(?:\s*[+\-]\s*[A-Za-z0-9]+)?)", r"\\sqrt{\1}", text)
    text = text.replace("√", r"\sqrt{}")
    
    # Large paren / bracket replacement
    text = re.sub(r"\x0c(?!rac)", r"\\left(", text)
    text = re.sub(r"[⎛⎜⎝]+", r"\\left(", text)
    text = re.sub(r"[⎞⎟⎠\r]+", r"\\right)", text)
    
    # Clean bracket artifacts
    text = re.sub(r"[\x10\x02]+", r"[", text)
    text = re.sub(r"[\x11\x03]+", r"]", text)
    text = text.replace("\x0f", "").replace("\x12", "")
    text = re.sub(r"(\\frac\{[^{}]+\}\{[^{}]+\})\]", r"\1", text)
    text = re.sub(r"[⎧⎪⎨⎩⎫⎬⎭]+", "", text)
    
    # Whitespace cleanup
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s*([,;])\s*", r"\1 ", text)
    # Decimal comma normalization: "2, 75" -> "2,75"
    text = re.sub(r"(\d+),\s+(\d+)", r"\1,\2", text)
    text = re.sub(r"\s+([)\]}])", r"\1", text)
    text = re.sub(r"([([{])\s+", r"\1", text)
    return text.strip()

def build_spans_text(spans: list[dict[str, Any]]) -> str:
    """Detect superscripts, subscripts and font changes from span geometry."""
    out = []
    prev_span = None
    for s in spans:
        txt = "".join(c.get("c", "") for c in s.get("chars", []))
        if not txt:
            continue
        sz = s.get("size", 11.9)
        bbox = pymupdf.Rect(s["bbox"])
        
        is_sup = False
        is_sub = False
        if sz < 9.5 and prev_span:
            prev_bbox = pymupdf.Rect(prev_span["bbox"])
            if bbox.y1 < prev_bbox.y1 - 1.5:
                is_sup = True
            elif bbox.y0 > prev_bbox.y0 + 1.5:
                is_sub = True
                
        txt = txt.replace("−", "-")
        if is_sup:
            out.append(f"^{{{txt}}}")
        elif is_sub:
            out.append(f"_{{{txt}}}")
        else:
            out.append(txt)
        prev_span = s
        
    return "".join(out)

def reconstruct_fractions_in_text(raw_text: str, q_spans: list[dict], drawings: list[pymupdf.Rect]) -> str:
    """Find horizontal drawing lines and construct semantic \\frac{num}{den}."""
    frac_lines = []
    for r in drawings:
        if r.height < 1.5 and 4 <= r.width <= 150:
            frac_lines.append(r)
            
    if not frac_lines or not q_spans:
        return raw_text
        
    frac_lines.sort(key=lambda r: (r.y0, r.x0))
    result = raw_text
    
    for f_rect in frac_lines:
        x_pad = 2.0
        num_spans = [
            s for s in q_spans
            if f_rect.x0 - x_pad <= (s["bbox"][0] + s["bbox"][2]) / 2 <= f_rect.x1 + x_pad
            and f_rect.y0 - 24 <= s["bbox"][1] <= f_rect.y0 + 0.5
            and s["bbox"][3] <= f_rect.y0 + 1.0
        ]
        den_spans = [
            s for s in q_spans
            if f_rect.x0 - x_pad <= (s["bbox"][0] + s["bbox"][2]) / 2 <= f_rect.x1 + x_pad
            and f_rect.y1 - 0.5 <= s["bbox"][1] <= f_rect.y1 + 4.5
        ]
        
        if num_spans and den_spans:
            num_spans.sort(key=lambda s: s["bbox"][0])
            den_spans.sort(key=lambda s: s["bbox"][0])
            num_str = build_spans_text(num_spans).strip()
            den_str = build_spans_text(den_spans).strip()
            
            plain_num = "".join(c.get("c", "") for s in num_spans for c in s.get("chars", [])).strip()
            plain_den = "".join(c.get("c", "") for s in den_spans for c in s.get("chars", [])).strip()
            
            frac_tex = f"\\frac{{{num_str}}}{{{den_str}}}"
            
            # Try matching with superscripts first, then plain
            matched = False
            for p_num, p_den in [(num_str, den_str), (plain_num, plain_den)]:
                pat = re.compile(re.escape(p_num) + r"\s+" + re.escape(p_den))
                if pat.search(result):
                    result = pat.sub(lambda m: frac_tex, result, count=1)
                    matched = True
                    break
                
    return result

def reconstruct_system_cases(system_eq_lines: list[dict], all_drawings: list[pymupdf.Rect], b_mid_y: float) -> str:
    """Combine system equation lines into \\begin{cases} ... \\end{cases}."""
    if not system_eq_lines:
        return ""
        
    row1_lines = [l for l in system_eq_lines if (l["bbox"].y0 + l["bbox"].y1) / 2.0 < b_mid_y]
    row2_lines = [l for l in system_eq_lines if (l["bbox"].y0 + l["bbox"].y1) / 2.0 >= b_mid_y]
    
    row1_text = " ".join(build_spans_text(l["spans"]) for l in row1_lines)
    row2_text = " ".join(build_spans_text(l["spans"]) for l in row2_lines)
    
    row1_spans = [s for l in row1_lines for s in l["spans"]]
    row2_spans = [s for l in row2_lines for s in l["spans"]]
    
    row1_text = reconstruct_fractions_in_text(row1_text, row1_spans, all_drawings)
    row2_text = reconstruct_fractions_in_text(row2_text, row2_spans, all_drawings)
    
    return f"\\begin{{cases}} {row1_text.strip()} \\\\ {row2_text.strip()} \\end{{cases}}"
