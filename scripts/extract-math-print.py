#!/usr/bin/env python3
"""
extract-math-print.py
PDF geometry-based extractor for Matematika Test Print (11,040 questions, 368 topics, 301 diagrams).
Extracts questions and 4 options per question using whitespace gap boundaries,
isolates diagram labels, reconstructs semantic LaTeX math via math_formula_builder,
and writes to versioned targets (v2).
"""

from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys
from typing import Any, NamedTuple

from PIL import Image, ImageChops
import pymupdf

# Ensure scripts directory is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from math_formula_builder import (
    clean_base_text,
    build_spans_text,
    reconstruct_fractions_in_text,
    reconstruct_system_cases,
    SYSTEM_CHARS,
)

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path("c:/Users/PC/Desktop/Bot")
SOURCE_DEFAULT = Path("D:/Matematika Test Print")

QUESTION_MARKER = re.compile(r"^(\d{1,2})\.")
OPTION_MARKER = re.compile(r"(?<![\w\\∩∪\(])([ABCD])\s*\)")

class MatchObj:
    def __init__(self, s: int, e: int, g: str):
        self._s, self._e, self._g = s, e, g
    def start(self) -> int: return self._s
    def end(self) -> int: return self._e
    def group(self, n: int = 1) -> str: return self._g

def find_option_markers(text: str) -> list[MatchObj]:
    markers = []
    for m in OPTION_MARKER.finditer(text):
        letter = m.group(1)
        start = m.start()
        end = m.end()
        
        line_start = text.rfind("\n", 0, start)
        line_prefix = text[line_start + 1 if line_start != -1 else 0 : start].rstrip()
        if line_prefix:
            last_char = line_prefix[-1]
            if last_char in "-+−*·/=<>≤≥^_,\\[{(":
                continue
                
        if not (line_prefix and line_prefix[-1] in ".;?:!"):
            open_parens = line_prefix.count("(") - line_prefix.count(")")
            if open_parens > 0:
                continue
            
        suffix = text[end:]
        if suffix:
            if re.match(r"^\d+(?![.,\d])", suffix) or suffix[0] in "^_":
                continue
            if re.match(r"^[a-zA-Zа-яА-Яo‘oʻg‘gʻ]", suffix):
                continue
                
        markers.append(MatchObj(start, end, letter))
    return markers

def is_option_line(text: str) -> bool:
    return len(find_option_markers(text)) > 0

KNOWN_PRINTER_TYPOS = {
    "Algebra91_121.pdf#variant=6&question=3": ["0,8.", "0,1.", "0,2.", "0,4."],
    "Algebra91_121.pdf#variant=96&question=3": ["0,8.", "0,1.", "0,2.", "0,4."],
}

class SourceSpec(NamedTuple):
    category: str
    category_name: str
    table: str
    filename: str
    first_variant: int
    count: int

SOURCES: tuple[SourceSpec, ...] = (
    SourceSpec("algebra", "Algebra", "KalitAl", "Algebra1_30.pdf", 1, 30),
    SourceSpec("algebra", "Algebra", "KalitAl", "Algebra31_60.pdf", 31, 30),
    SourceSpec("algebra", "Algebra", "KalitAl", "Algebra61_90.pdf", 61, 30),
    SourceSpec("algebra", "Algebra", "KalitAl", "Algebra91_121.pdf", 91, 31),
    SourceSpec("geometriya", "Geometriya", "KalitGeo", "Geometriya_variant.pdf", 1, 40),
    SourceSpec("algebra-trigonometriya", "Algebra va Trigonometriya", "KalitAlTrigon", "Algebra___Trigonometriyagacha.pdf", 1, 40),
    SourceSpec("algebra-geometriya", "Algebra va Geometriya", "KalitAlGeo", "Algebra_va_Geometriya1_30.pdf", 1, 30),
    SourceSpec("algebra-geometriya", "Algebra va Geometriya", "KalitAlGeo", "Algebra_va_Geometriya31_60.pdf", 31, 30),
    SourceSpec("algebra-geometriya", "Algebra va Geometriya", "KalitAlGeo", "Algebra_va_Geometriya61_90.pdf", 61, 30),
    SourceSpec("algebra-geometriya", "Algebra va Geometriya", "KalitAlGeo", "Algebra_va_Geometriya91_120.pdf", 91, 30),
    SourceSpec("algebra-geometriya", "Algebra va Geometriya", "KalitAlGeo", "Algebra_va_Geometriya121_150.pdf", 121, 30),
    SourceSpec("algebra-geometriya", "Algebra va Geometriya", "KalitAlGeo", "Algebra_va_Geometriya151_164.pdf", 151, 14),
    SourceSpec("kombinatorika", "Kombinatorika", "KalitKombi", "Kombinatorika.pdf", 1, 3),
)

CATEGORY_EXPECTED = {
    "algebra": 121,
    "geometriya": 40,
    "algebra-trigonometriya": 40,
    "algebra-geometriya": 164,
    "kombinatorika": 3,
}

ANSWER_RE = re.compile(r"(\d{1,2})\.([ABCD])\b")

def load_answer_keys(database_path: Path) -> dict[tuple[str, int], list[str]]:
    connection = sqlite3.connect(database_path)
    keys: dict[tuple[str, int], list[str]] = {}
    try:
        for category, expected in CATEGORY_EXPECTED.items():
            table = next(spec.table for spec in SOURCES if spec.category == category)
            rows = connection.execute(f'SELECT "Id", "Kalit" FROM "{table}" ORDER BY "Id"').fetchall()
            if [row[0] for row in rows] != list(range(1, expected + 1)):
                raise ValueError(f"{table}: variant IDs are not contiguous 1..{expected}")
            for variant, raw in rows:
                found = ANSWER_RE.findall(raw or "")
                if [int(number) for number, _ in found] != list(range(1, 31)):
                    raise ValueError(f"{table} variant {variant}: expected ordered answers 1..30")
                keys[(category, int(variant))] = [f"A{'ABCD'.index(letter) + 1}" for _, letter in found]
    finally:
        connection.close()
    if len(keys) != 368:
        raise ValueError(f"answer key count {len(keys)} != 368")
    return keys

def extract_variant_regions(doc: pymupdf.Document, var_offset: int) -> dict[int, list[tuple[int, pymupdf.Rect]]]:
    p0 = doc[var_offset * 2]
    p1 = doc[var_offset * 2 + 1]
    
    columns = [
        {"page": p0, "page_idx": var_offset * 2, "x0": 28.0, "x1": 298.0, "gutter": (28, 48)},
        {"page": p0, "page_idx": var_offset * 2, "x0": 300.0, "x1": 582.0, "gutter": (300, 322)},
        {"page": p1, "page_idx": var_offset * 2 + 1, "x0": 28.0, "x1": 298.0, "gutter": (28, 48)},
        {"page": p1, "page_idx": var_offset * 2 + 1, "x0": 300.0, "x1": 582.0, "gutter": (300, 322)},
    ]
    
    for col in columns:
        page = col["page"]
        data = json.loads(page.get_text("rawjson"))
        lines = []
        for b in data.get("blocks", []):
            if b.get("type") == 0:
                for l in b.get("lines", []):
                    bbox = pymupdf.Rect(l["bbox"])
                    if col["x0"] - 2 <= bbox.x0 and bbox.x1 <= col["x1"] + 2:
                        txt = "".join(c.get("c", "") for s in l.get("spans", []) for c in s.get("chars", []))
                        lines.append({
                            "bbox": bbox,
                            "text": txt,
                            "spans": l.get("spans", []),
                            "y0": bbox.y0,
                            "y1": bbox.y1,
                            "x0": bbox.x0,
                            "x1": bbox.x1,
                        })
        lines.sort(key=lambda l: (l["y0"], l["x0"]))
        col["lines"] = lines
        
        col_drawings = []
        for d in page.get_drawings():
            r = pymupdf.Rect(d["rect"])
            if col["x0"] - 2 <= r.x0 and r.x1 <= col["x1"] + 2:
                col_drawings.append(d)
        col["drawings"] = col_drawings
        
        anchors = []
        for idx, l in enumerate(lines):
            m = QUESTION_MARKER.match(l["text"].strip())
            if m and col["gutter"][0] <= l["x0"] <= col["gutter"][1]:
                q_num = int(m.group(1))
                if 1 <= q_num <= 30:
                    anchors.append((q_num, l["y0"], l["y1"], idx, l["bbox"]))
        anchors.sort(key=lambda a: a[1])
        col["anchors"] = anchors

    questions: dict[int, list[tuple[int, pymupdf.Rect]]] = {q: [] for q in range(1, 31)}
    last_seen_q = 0
    prev_q_has_all_opts = True
    
    for c_idx, col in enumerate(columns):
        anchors = col["anchors"]
        lines = col["lines"]
        drawings = col["drawings"]
        x0, x1 = col["x0"], col["x1"]
        p_idx = col["page_idx"]
        
        if not anchors:
            if 0 < last_seen_q <= 30 and lines and not prev_q_has_all_opts:
                max_y1 = max(l["y1"] for l in lines)
                questions[last_seen_q].append((p_idx, pymupdf.Rect(x0, 28.0, x1, max_y1 + 5)))
                prev_q_has_all_opts = True
            continue
            
        first_q = anchors[0][0]
        
        if not prev_q_has_all_opts and c_idx > 0 and last_seen_q == first_q - 1:
            lines_before_a0 = [l for l in lines if l["y0"] < anchors[0][1] - 1]
            first_q_top_candidates = [l["y0"] for l in lines_before_a0 if any(c in l["text"] for c in SYSTEM_CHARS) and anchors[0][1] - l["y0"] <= 85]
            prev_q_lines = [l for l in lines_before_a0 if l["y0"] not in first_q_top_candidates]
            
            if prev_q_lines:
                wrap_end_y = max(l["y1"] for l in prev_q_lines)
                next_top_y = min(first_q_top_candidates) if first_q_top_candidates else anchors[0][1]
                boundary = (wrap_end_y + next_top_y) / 2.0
                questions[last_seen_q].append((p_idx, pymupdf.Rect(x0, 28.0, x1, boundary)))
                current_top_y = boundary
            else:
                top_elem = min(first_q_top_candidates) if first_q_top_candidates else anchors[0][1]
                current_top_y = max(28.0, top_elem - 4)
            prev_q_has_all_opts = True
        else:
            first_q_top_candidates = [l["y0"] for l in lines if l["y0"] < anchors[0][1] - 1 and any(c in l["text"] for c in SYSTEM_CHARS) and anchors[0][1] - l["y0"] <= 85]
            if first_q_top_candidates:
                current_top_y = max(28.0, min(first_q_top_candidates) - 4)
            else:
                current_top_y = 28.0
                
        for a_idx, (q_num, a_y0, a_y1, l_idx, a_bbox) in enumerate(anchors):
            last_seen_q = q_num
            is_last_in_col = (a_idx == len(anchors) - 1)
            
            if not is_last_in_col:
                next_q_num, next_a_y0, next_a_y1, next_l_idx, next_a_bbox = anchors[a_idx + 1]
                
                between_lines = [l for l in lines if a_y0 - 2 <= l["y0"] < next_a_y0]
                opt_lines = [l for l in between_lines if is_option_line(l["text"])]
                
                diag_bottom = a_y1
                for d in drawings:
                    r = pymupdf.Rect(d["rect"])
                    if col["x0"] <= r.x0 and r.x1 <= col["x1"] and a_y0 - 5 <= r.y0 < next_a_y0:
                        if min(r.width, r.height) > 15:
                            diag_bottom = max(diag_bottom, r.y1)
                            
                high_system = [l["y0"] for l in between_lines if any(c in l["text"] for c in SYSTEM_CHARS) and next_a_y0 - l["y0"] <= 85]
                next_top_y = min(high_system) if high_system else next_a_y0
                
                if opt_lines:
                    last_opt_l = opt_lines[-1]
                    cont_lines = [l for l in between_lines if l["y0"] > last_opt_l["y0"] and l["y1"] < next_top_y - 2 and not any(c in l["text"] for c in SYSTEM_CHARS)]
                    q_lines_bottom = max([last_opt_l["y1"]] + [l["y1"] for l in cont_lines])
                else:
                    q_lines_bottom = a_y1
                    
                q_content_bottom = max(q_lines_bottom, diag_bottom)
                
                for d in drawings:
                    r = pymupdf.Rect(d["rect"])
                    if col["x0"] <= r.x1 and r.x0 <= col["x1"] and q_content_bottom <= r.y0 < next_top_y:
                        next_top_y = min(next_top_y, r.y0)
                            
                boundary_y = (q_content_bottom + next_top_y) / 2.0
                if boundary_y <= q_content_bottom:
                    boundary_y = q_content_bottom + 0.5
                    
                questions[q_num].append((p_idx, pymupdf.Rect(x0, current_top_y, x1, boundary_y)))
                current_top_y = boundary_y
            else:
                opt_lines = [l for l in lines if l["y0"] >= a_y0 - 2 and is_option_line(l["text"])]
                markers = [m.group(1) for l in opt_lines for m in find_option_markers(l["text"])]
                prev_q_has_all_opts = (len(markers) >= 4)
                questions[q_num].append((p_idx, pymupdf.Rect(x0, current_top_y, x1, 830.0)))

    return questions

def extract_q_and_options(doc: pymupdf.Document, clips: list[tuple[int, pymupdf.Rect]], source_key: str | None = None) -> tuple[bool, list[str]]:
    if source_key and source_key in KNOWN_PRINTER_TYPOS:
        return True, KNOWN_PRINTER_TYPOS[source_key]
        
    all_lines = []
    all_drawings = []
    
    for page_idx, clip in clips:
        page = doc[page_idx]
        data = json.loads(page.get_text("rawjson", clip=clip))
        for b in data.get("blocks", []):
            if b.get("type") == 0:
                for l in b.get("lines", []):
                    bbox = pymupdf.Rect(l["bbox"])
                    txt = "".join(c.get("c", "") for s in l.get("spans", []) for c in s.get("chars", []))
                    all_lines.append({
                        "page_idx": page_idx,
                        "bbox": bbox,
                        "text": txt,
                        "spans": l.get("spans", []),
                        "y0": bbox.y0,
                        "y1": bbox.y1,
                    })
        for d in page.get_drawings():
            r = pymupdf.Rect(d["rect"])
            if r.intersects(clip):
                all_drawings.append(d)
                
    diag_drawings = [d for d in all_drawings if min(d["rect"].width, d["rect"].height) > 15 and d["rect"].y0 > 27]
    diag_expanded = None
    if diag_drawings:
        diag_bbox = pymupdf.Rect(diag_drawings[0]["rect"])
        for d in diag_drawings[1:]:
            diag_bbox |= pymupdf.Rect(d["rect"])
        diag_expanded = pymupdf.Rect(diag_bbox.x0 - 15, diag_bbox.y0 - 15, diag_bbox.x1 + 15, diag_bbox.y1 + 15)
        
    content_lines = []
    for l in all_lines:
        if diag_expanded and l["bbox"].intersects(diag_expanded):
            txt = l["text"].strip()
            is_header = re.match(r"^\d{1,2}\.", txt)
            has_opt = is_option_line(txt)
            if not is_header and not has_opt and l["bbox"].x1 < diag_expanded.x1 + 10:
                continue
        content_lines.append(l)
        
    full_text = "\n".join(l["text"] for l in content_lines)
    
    markers: list[MatchObj] = find_option_markers(full_text)
        
    # Handle printer typos:
    # 1) '4)' or 'A ' before B)
    if not any(m.group(1) == "A" for m in markers):
        b_match = next((m for m in markers if m.group(1) == "B"), None)
        if b_match:
            search_area = full_text[:b_match.start()]
            a_sub = re.search(r"(?<!\w)(?:4\s*\)\s*|A\s+)(?=\S)", search_area)
            if a_sub:
                markers.insert(0, MatchObj(a_sub.start(), a_sub.end(), "A"))
                
    # 2) 'C ' before D)
    if any(m.group(1) == "B" for m in markers) and not any(m.group(1) == "C" for m in markers):
        b_match = next(m for m in markers if m.group(1) == "B")
        d_match = next((m for m in markers if m.group(1) == "D"), None)
        end_pos = d_match.start() if d_match else len(full_text)
        c_sub = re.search(r"(?<!\w)C\s+(?=\S)", full_text[b_match.end():end_pos])
        if c_sub:
            c_start = b_match.end() + c_sub.start()
            c_end = b_match.end() + c_sub.end()
            markers.append(MatchObj(c_start, c_end, "C"))
            markers.sort(key=lambda m: m.start())
            
    # 3) 'D ' after C)
    if any(m.group(1) == "C" for m in markers) and not any(m.group(1) == "D" for m in markers):
        c_match = next(m for m in markers if m.group(1) == "C")
        d_sub = re.search(r"(?<!\w)D\s+(?=\S)", full_text[c_match.end():])
        if d_sub:
            d_start = c_match.end() + d_sub.start()
            d_end = c_match.end() + d_sub.end()
            markers.append(MatchObj(d_start, d_end, "D"))
            markers.sort(key=lambda m: m.start())
            
    options: list[str] = []
    if len(markers) >= 4:
        by_letter = set(m.group(1) for m in markers)
        if by_letter >= {"A", "B", "C", "D"}:
            opt_dict = {}
            for i in range(len(markers)):
                start = markers[i].end()
                end = markers[i + 1].start() if i + 1 < len(markers) else len(full_text)
                val = full_text[start:end].strip().replace("\n", " ")
                letter = markers[i].group(1)
                if letter not in opt_dict or (val and not opt_dict[letter]):
                    opt_dict[letter] = val
                elif val:
                    opt_dict[letter] = val
            options = [opt_dict.get("A", ""), opt_dict.get("B", ""), opt_dict.get("C", ""), opt_dict.get("D", "")]
        else:
            chosen_markers = markers[:4]
            for i in range(4):
                start = chosen_markers[i].end()
                end = chosen_markers[i+1].start() if i < 3 else len(full_text)
                options.append(full_text[start:end].strip().replace("\n", " "))
            
    return len(options) == 4 and all(bool(o) for o in options), options

def render_precision_diagram(doc: pymupdf.Document, clips: list[tuple[int, pymupdf.Rect]], output_path: Path) -> bool:
    all_drawings = []
    diag_pages = []
    for page_idx, clip in clips:
        page = doc[page_idx]
        drawings = page.get_drawings()
        page_diag = []
        max_y = 830.0 if clip.y1 >= 790 else clip.y1 + 2
        for d in drawings:
            r = pymupdf.Rect(d["rect"])
            if clip.x0 <= r.x0 and r.x1 <= clip.x1 and clip.y0 - 2 <= r.y0 and r.y1 <= max_y:
                is_frac = (r.height < 1.5 and r.width < 150 and all(it[0] == 'l' for it in d.get('items', [])))
                if not is_frac and min(r.width, r.height) > 12:
                    page_diag.append(r)
        if page_diag:
            diag_pages.append((page_idx, page, page_diag, clip, max_y))
            
    if not diag_pages:
        return False
        
    p_idx, page, diag_drawings, clip, max_y = diag_pages[0]
    union = diag_drawings[0]
    for r in diag_drawings[1:]:
        union |= r
    for d in page.get_drawings():
        r = pymupdf.Rect(d["rect"])
        if r.intersects(pymupdf.Rect(union.x0 - 15, union.y0 - 15, union.x1 + 15, union.y1 + 15)):
            union |= r
        
    data = json.loads(page.get_text("rawjson", clip=pymupdf.Rect(clip.x0, clip.y0, clip.x1, max_y)))
    for b in data.get("blocks", []):
        if b.get("type") == 0:
            for l in b.get("lines", []):
                bbox = pymupdf.Rect(l["bbox"])
                if bbox.intersects(pymupdf.Rect(union.x0 - 20, union.y0 - 20, union.x1 + 20, union.y1 + 20)):
                    txt = "".join(c.get("c", "") for s in l.get("spans", []) for c in s.get("chars", [])).strip()
                    if not re.match(r"^\d{1,2}\.", txt) and not OPTION_MARKER.search(txt):
                        if bbox.y0 > 800 and 280 <= (bbox.x0 + bbox.x1) / 2 <= 315 and txt.strip().isdigit():
                            continue
                        if len(txt.split()) <= 4 and bbox.width <= 80:
                            union |= bbox
                        
    safe_y0 = max(union.y0 - 3, clip.y0)
    safe_y1 = min(union.y1 + 3, max_y)
    safe_x0 = max(union.x0 - 4, clip.x0)
    safe_x1 = min(union.x1 + 4, clip.x1)
    
    clip_rect = pymupdf.Rect(safe_x0, safe_y0, safe_x1, safe_y1)
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=clip_rect, alpha=False, annots=False)
    image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    
    bg = Image.new("RGB", image.size, "white")
    diff = ImageChops.difference(image, bg)
    bbox = diff.getbbox()
    if not bbox:
        return False
        
    pad = 6
    cropped = image.crop((
        max(0, bbox[0] - pad),
        max(0, bbox[1] - pad),
        min(image.width, bbox[2] + pad),
        min(image.height, bbox[3] + pad)
    ))
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(output_path, "WEBP", lossless=True, method=6)
    return True

def reconstruct_question(doc: pymupdf.Document, clips: list[tuple[int, pymupdf.Rect]], source_key: str | None = None) -> tuple[str, list[str], bool]:
    ok, opts = extract_q_and_options(doc, clips, source_key=source_key)
    all_lines = []
    all_drawings = []
    for p_idx, clip in clips:
        page = doc[p_idx]
        max_y = 830.0 if clip.y1 >= 790 else clip.y1
        data = json.loads(page.get_text("rawjson", clip=pymupdf.Rect(clip.x0, clip.y0, clip.x1, max_y)))
        for b in data.get("blocks", []):
            if b.get("type") == 0:
                for l in b.get("lines", []):
                    bbox = pymupdf.Rect(l["bbox"])
                    txt = "".join(c.get("c", "") for s in l.get("spans", []) for c in s.get("chars", []))
                    if bbox.y0 > 800 and 280 <= (bbox.x0 + bbox.x1) / 2 <= 315 and txt.strip().isdigit():
                        continue
                    all_lines.append({
                        "page_idx": p_idx,
                        "bbox": bbox,
                        "text": txt,
                        "spans": l.get("spans", []),
                        "y0": bbox.y0,
                        "y1": bbox.y1,
                        "x0": bbox.x0,
                        "x1": bbox.x1,
                    })
        for d in page.get_drawings():
            r = pymupdf.Rect(d["rect"])
            if clip.x0 <= r.x1 and r.x0 <= clip.x1 and clip.y0 <= r.y1 and r.y0 <= max_y:
                all_drawings.append(d)
                
    diag_drawings = [d for d in all_drawings if min(d["rect"].width, d["rect"].height) > 12 and d["rect"].y0 > 27]
    diag_bbox = None
    diag_expanded = None
    if diag_drawings:
        diag_bbox = pymupdf.Rect(diag_drawings[0]["rect"])
        for d in diag_drawings[1:]:
            diag_bbox |= pymupdf.Rect(d["rect"])
        for d in all_drawings:
            r = pymupdf.Rect(d["rect"])
            if r.intersects(pymupdf.Rect(diag_bbox.x0 - 15, diag_bbox.y0 - 15, diag_bbox.x1 + 15, diag_bbox.y1 + 15)):
                diag_bbox |= r
        for l in all_lines:
            bbox = l["bbox"]
            if bbox.intersects(pymupdf.Rect(diag_bbox.x0 - 20, diag_bbox.y0 - 20, diag_bbox.x1 + 20, diag_bbox.y1 + 20)):
                txt = l["text"].strip()
                if not re.match(r"^\d{1,2}\.", txt) and not is_option_line(txt):
                    if len(txt.split()) <= 4 and bbox.width <= 80:
                        diag_bbox |= bbox
        diag_expanded = pymupdf.Rect(diag_bbox.x0 - 10, diag_bbox.y0 - 10, diag_bbox.x1 + 10, diag_bbox.y1 + 10)
        
    content_lines = []
    for l in all_lines:
        if diag_expanded and l["bbox"].intersects(diag_expanded):
            txt = l["text"].strip()
            is_header = re.match(r"^\d{1,2}\.", txt)
            has_opt = is_option_line(txt)
            if not is_header and not has_opt:
                if l["bbox"].width > 80 or len(txt.split()) >= 4:
                    content_lines.append(l)
                    continue
                if l["bbox"].x1 < diag_expanded.x1 + 10:
                    continue
        content_lines.append(l)
        
    first_opt_idx = len(content_lines)
    for idx, l in enumerate(content_lines):
        if is_option_line(l["text"]):
            first_opt_idx = idx
            break
            
    q_lines = content_lines[:first_opt_idx]
    frac_drawings = [pymupdf.Rect(d["rect"]) for d in all_drawings]
    
    system_bracket_spans = [s for l in q_lines for s in l["spans"] if any(c in "".join(ch.get("c", "") for ch in s.get("chars", [])) for c in SYSTEM_CHARS)]
    if system_bracket_spans:
        b_y0 = min(s["bbox"][1] for s in system_bracket_spans)
        b_y1 = max(s["bbox"][3] for s in system_bracket_spans)
        b_x1 = max(s["bbox"][2] for s in system_bracket_spans)
        b_mid_y = (b_y0 + b_y1) / 2.0
        
        system_eq_lines = []
        regular_q_lines = []
        for l in q_lines:
            mid_y = (l["bbox"].y0 + l["bbox"].y1) / 2.0
            if b_y0 - 4 <= mid_y <= b_y1 + 4 and l["bbox"].x0 >= b_x1 - 5:
                if not any(w in l["text"] for w in ["tengsizlik", "sistema", "yechim", "toping", "tenglama"]):
                    system_eq_lines.append(l)
                    continue
            if not any(c in l["text"] for c in SYSTEM_CHARS):
                regular_q_lines.append(l)
                
        system_cases = reconstruct_system_cases(system_eq_lines, frac_drawings, b_mid_y)
        prompt_text = " ".join(build_spans_text(l["spans"]) for l in regular_q_lines)
        prompt_text = re.sub(r"^\d{1,2}\.\s*", "", prompt_text.strip())
        all_q_spans = [s for l in regular_q_lines for s in l["spans"]]
        prompt_text = reconstruct_fractions_in_text(prompt_text, all_q_spans, frac_drawings)
        q_text = f"{system_cases} {prompt_text}".strip()
    else:
        q_text = " ".join(build_spans_text(l["spans"]) for l in q_lines)
        q_text = re.sub(r"^\d{1,2}\.\s*", "", q_text.strip())
        all_q_spans = [s for l in q_lines for s in l["spans"]]
        q_text = reconstruct_fractions_in_text(q_text, all_q_spans, frac_drawings)
    
    q_clean = clean_base_text(q_text)
    all_opt_spans = [s for l in content_lines[first_opt_idx:] for s in l["spans"]]
    clean_opts = [clean_base_text(reconstruct_fractions_in_text(o, all_opt_spans, frac_drawings)) for o in opts]
    
    # Strip any residual option marker typo like 'A) ' from start of question
    q_clean = re.sub(r"^[ABCD]\)\s*", "", q_clean).strip()
    
    return q_clean, clean_opts, diag_bbox is not None

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=SOURCE_DEFAULT)
    parser.add_argument("--pdf-dir", type=Path, default=ROOT / "tmp/pdfs/math-source")
    parser.add_argument("--output", type=Path, default=ROOT / "content-banks/matematika/v2/math-print.json")
    parser.add_argument("--images", type=Path, default=ROOT / "public/math-print/v2")
    parser.add_argument("--audit", type=Path, default=ROOT / "content-banks/matematika/v2/math-print.audit.json")
    parser.add_argument("--reuse-images", action="store_true")
    args = parser.parse_args()

    print(f"Loading answer keys from {args.source / 'NatijaDB.db'}...")
    keys = load_answer_keys(args.source / "NatijaDB.db")

    raw_records: list[dict] = []
    image_count = 0
    category_counts: dict[str, int] = defaultdict(int)

    for spec in SOURCES:
        pdf_path = args.pdf_dir / spec.filename
        print(f"Processing {spec.filename} ({spec.count} variants)...")
        doc = pymupdf.open(pdf_path)
        
        for var_idx in range(spec.count):
            variant = spec.first_variant + var_idx
            topic_external_id = f"mtp-{spec.category}-{variant:03d}"
            q_regions = extract_variant_regions(doc, var_idx)
            
            for q_num in range(1, 31):
                external_id = f"{topic_external_id}-{q_num:02d}"
                source_key = f"{spec.filename}#variant={variant}&question={q_num}"
                clips = q_regions[q_num]
                
                q_clean, clean_opts, has_diag = reconstruct_question(doc, clips, source_key=source_key)
                
                image_path = args.images / f"{external_id}.webp"
                has_image = False
                if has_diag:
                    if args.reuse_images and image_path.exists():
                        has_image = True
                    else:
                        has_image = render_precision_diagram(doc, clips, image_path)
                image_count += int(has_image)
                
                correct_ans = keys[(spec.category, variant)][q_num - 1]
                
                raw_records.append({
                    "externalId": external_id,
                    "topicExternalId": topic_external_id,
                    "category": spec.category,
                    "categoryName": spec.category_name,
                    "variant": variant,
                    "questionNumber": q_num,
                    "questionUz": q_clean,
                    "optionsUz": clean_opts,
                    "correctAnswer": correct_ans,
                    "source": f"{spec.filename}#variant={variant}&question={q_num}",
                    "image": f"/math-print/v2/{external_id}.webp" if has_image else None,
                })
            category_counts[spec.category] += 1

    print(f"\nExtracted {len(raw_records)} questions, {image_count} diagrams.")
    
    if len(raw_records) != 11040:
        raise ValueError(f"Total questions {len(raw_records)} != 11040")
    if image_count != 301:
        print(f"WARNING: Image count {image_count} != 301")

    topics = []
    seen_topics = set()
    items = []
    for record in raw_records:
        topic_id = record["topicExternalId"]
        if topic_id not in seen_topics:
            seen_topics.add(topic_id)
            title = f"{record['categoryName']} — {record['variant']}-variant"
            topics.append({"externalId": topic_id, "nameUz": title, "nameRu": title})
            
        options = record["optionsUz"]
        if len(options) != 4 or any(not value for value in options):
            raise ValueError(f"Invalid options in {record['externalId']}: {options}")
            
        option_map = {f"A{index + 1}": value for index, value in enumerate(options)}
        items.append({
            "externalId": record["externalId"],
            "topicExternalId": topic_id,
            "questionUz": record["questionUz"],
            "questionRu": record["questionUz"],
            "optionsUz": option_map,
            "optionsRu": dict(option_map),
            "correctAnswer": record["correctAnswer"],
            "source": record["source"],
            "image": record["image"],
        })

    bank = {
        "version": 2,
        "subjectId": "matematika",
        "bankId": "math_db",
        "bankName": "Matematika Test Print",
        "topics": topics,
        "items": items,
    }
    
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    
    source_hash = hashlib.sha256((args.source / "NatijaDB.db").read_bytes()).hexdigest()
    audit = {
        "status": "EXTRACTED_V2_PENDING_AUDIT",
        "source": str(args.source),
        "answerKeySha256": source_hash,
        "totalTopics": len(topics),
        "totalQuestions": len(items),
        "totalTexts": len(items) * 10,
        "imageAssetsTotal": image_count,
        "categoryVariants": dict(category_counts),
    }
    args.audit.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SUCCESS: Bank written to {args.output} ({len(items)} questions, {len(topics)} topics, {image_count} images)")

if __name__ == "__main__":
    main()
