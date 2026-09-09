"""
scripts/math_pdf/diagram_extractor.py
Precision Diagram Extractor for Matematika Test Print PDFs.
Isolates geometric drawings, coordinate grids, and axis graphs,
includes internal labels (x, y, 0, point letters, degrees),
crops with 6-8px padding at 3x resolution, and outputs versioned WebPs.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
from pathlib import Path
from typing import Sequence
from PIL import Image
import pymupdf

from scripts.math_pdf.source_reader import DrawingAtom, LineAtom, PageSourceData


@dataclass
class ExtractedDiagram:
    external_id: str
    image_rel_path: str
    crop_rect: pymupdf.Rect
    sha256: str
    hash8: str
    label_line_indices: list[int]


def is_label_line(line: LineAtom, drawing_box: pymupdf.Rect) -> bool:
    """
    Determines if a line is an internal diagram label (e.g. 'x', 'y', '0', 'O', '30°', 'A', 'B').
    A diagram label is short (< 15 chars), does not start with question/option markers,
    and sits inside or immediately adjacent (< 8pt) to the drawing box.
    """
    text = line.text.strip()
    if not text:
        return False
    # Not a question anchor or option marker
    if any(m in text for m in ("A)", "B)", "C)", "D)", "A.", "B.", "C.", "D.")):
        return False
    # Not full text or formula sentences
    if any(word in text.lower() for word in ("teng", "toping", "hisoblang", "yeching", "bo‘lsa", "agar")):
        return False
    # Long explanatory text is part of question body, not a diagram label
    if len(text) > 20:
        return False

    # Check spatial overlap or adjacency with drawing box
    l_box = line.bbox
    # Allow 8pt padding around drawings
    expanded = pymupdf.Rect(
        drawing_box.x0 - 8.0,
        drawing_box.y0 - 8.0,
        drawing_box.x1 + 8.0,
        drawing_box.y1 + 8.0,
    )
    return expanded.contains(l_box) or expanded.intersects(l_box)


def extract_question_diagram(
    page: pymupdf.Page,
    drawings: list[DrawingAtom],
    lines: list[LineAtom],
    external_id: str,
    output_dir: Path,
) -> ExtractedDiagram | None:
    """
    Extracts, renders, and saves a question diagram as lossless WebP.
    Returns ExtractedDiagram metadata with label lines to be excluded from question text.
    """
    if not drawings:
        return None

    # Calculate union bounding box of all drawings
    min_x = min(d.x0 for d in drawings)
    min_y = min(d.y0 for d in drawings)
    max_x = max(d.x1 for d in drawings)
    max_y = max(d.y1 for d in drawings)
    drawings_box = pymupdf.Rect(min_x, min_y, max_x, max_y)

    # Filter out tiny spurious vector artifacts (e.g. dots < 5x5 pt)
    if drawings_box.width < 10.0 or drawings_box.height < 10.0:
        return None

    # Identify all label lines
    label_indices: list[int] = []
    crop_box = pymupdf.Rect(drawings_box)

    for idx, l in enumerate(lines):
        if is_label_line(l, drawings_box):
            label_indices.append(idx)
            crop_box.include_rect(l.bbox)

    # Add 6-8px margin padding
    padding = 7.0
    crop_box.x0 = max(0.0, crop_box.x0 - padding)
    crop_box.y0 = max(0.0, crop_box.y0 - padding)
    crop_box.x1 = min(page.rect.width, crop_box.x1 + padding)
    crop_box.y1 = min(page.rect.height, crop_box.y1 + padding)

    # Render at 3x resolution
    matrix = pymupdf.Matrix(3.0, 3.0)
    pix = page.get_pixmap(matrix=matrix, clip=crop_box, alpha=False)

    # Save to memory buffer to compute SHA-256 and 8-char hash
    img_bytes = pix.tobytes("png")
    from io import BytesIO
    im = Image.open(BytesIO(img_bytes))

    out_buffer = BytesIO()
    im.save(out_buffer, format="WEBP", lossless=True, quality=100)
    webp_data = out_buffer.getvalue()

    full_hash = hashlib.sha256(webp_data).hexdigest()
    hash8 = full_hash[:8]

    filename = f"{external_id}-{hash8}.webp"
    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = output_dir / filename
    with open(out_file, "wb") as f:
        f.write(webp_data)

    rel_path = f"/math-print/v3/{filename}"

    return ExtractedDiagram(
        external_id=external_id,
        image_rel_path=rel_path,
        crop_rect=crop_box,
        sha256=full_hash,
        hash8=hash8,
        label_line_indices=label_indices,
    )
