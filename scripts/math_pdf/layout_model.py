"""
scripts/math_pdf/layout_model.py
Dynamic page layout and column model for Matematika Test Print PDFs.
Calculates real gutter boundaries, extracts column streams, and detects
strict monotonic question anchors (1..30) across multi-page variants.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Sequence
import pymupdf

from scripts.math_pdf.source_reader import PageSourceData, LineAtom, DrawingAtom


QUESTION_ANCHOR_RE = re.compile(r"^\s*(\d{1,2})\.")


@dataclass
class QuestionAnchor:
    q_num: int
    page_offset: int  # 0 or 1
    col_idx: int      # 0 (left) or 1 (right)
    line_idx: int
    line: LineAtom
    y0: float
    y1: float


@dataclass
class ColumnLayout:
    page_offset: int
    col_idx: int
    bbox: pymupdf.Rect
    lines: list[LineAtom]
    drawings: list[DrawingAtom]
    horizontal_lines: list[DrawingAtom]
    anchors: list[QuestionAnchor]


@dataclass
class VariantLayout:
    var_offset: int
    columns: list[ColumnLayout]
    anchors: list[QuestionAnchor]  # Strictly ordered 1..30

    @property
    def is_complete(self) -> bool:
        return [a.q_num for a in self.anchors] == list(range(1, 31))


def find_column_gutter(page_data: PageSourceData) -> float:
    """
    Finds the vertical dividing line between left and right columns.
    If an explicit vertical dividing drawing exists near center, uses it.
    Otherwise defaults to center (297.5).
    """
    dividers = [
        d.rect.x0
        for d in page_data.drawings
        if d.rect.height >= 300.0 and abs(d.rect.x0 - 297.5) < 30.0
    ]
    return dividers[0] if dividers else 297.5


def build_variant_layout(
    var_offset: int,
    p0_data: PageSourceData,
    p1_data: PageSourceData,
) -> VariantLayout:
    """
    Builds the dynamic 4-column layout flow:
    (Page 0 Left) -> (Page 0 Right) -> (Page 1 Left) -> (Page 1 Right)
    and resolves the monotonic 1..30 question anchors.
    """
    columns: list[ColumnLayout] = []
    all_anchors: list[QuestionAnchor] = []

    for p_offset, p_data in enumerate([p0_data, p1_data]):
        gutter = find_column_gutter(p_data)

        # Filter out running headers (y0 < 18), running footers (y1 > 805), and "Variant-*" headers
        valid_lines = [
            l for l in p_data.lines
            if 18.0 < l.y0 and l.y1 < 805.0 and not l.text.strip().startswith("Variant-")
        ]

        left_lines = sorted([l for l in valid_lines if l.x0 < gutter], key=lambda l: (round(l.y0, 1), l.x0))
        right_lines = sorted([l for l in valid_lines if l.x0 >= gutter], key=lambda l: (round(l.y0, 1), l.x0))

        left_drawings = [d for d in p_data.drawings if d.x1 <= gutter + 5.0 and 20.0 < d.y0 < 805.0 and not (d.rect.height >= 300.0 and abs(d.x0 - 297.5) < 30.0)]
        right_drawings = [d for d in p_data.drawings if d.x0 >= gutter - 5.0 and 20.0 < d.y0 < 805.0 and not (d.rect.height >= 300.0 and abs(d.x0 - 297.5) < 30.0)]

        left_h = [d for d in p_data.horizontal_lines if d.x1 <= gutter + 5.0 and 20.0 < d.y0 < 805.0]
        right_h = [d for d in p_data.horizontal_lines if d.x0 >= gutter - 5.0 and 20.0 < d.y0 < 805.0]

        left_col_box = pymupdf.Rect(20.0, 20.0, gutter, 805.0)
        right_col_box = pymupdf.Rect(gutter, 20.0, p_data.width - 15.0, 805.0)

        for col_idx, (c_box, c_lines, c_drawings, c_h) in enumerate([
            (left_col_box, left_lines, left_drawings, left_h),
            (right_col_box, right_lines, right_drawings, right_h),
        ]):
            col_anchors: list[QuestionAnchor] = []
            if c_lines:
                col_min_x = min(l.x0 for l in c_lines)
                for line_idx, l in enumerate(c_lines):
                    # Question anchor must be column-margin-aligned
                    if l.x0 <= col_min_x + 15.0:
                        m = QUESTION_ANCHOR_RE.match(l.text)
                        if m:
                            q_num = int(m.group(1))
                            anchor = QuestionAnchor(
                                q_num=q_num,
                                page_offset=p_offset,
                                col_idx=col_idx,
                                line_idx=line_idx,
                                line=l,
                                y0=l.y0,
                                y1=l.y1,
                            )
                            col_anchors.append(anchor)
                            all_anchors.append(anchor)

            columns.append(ColumnLayout(
                page_offset=p_offset,
                col_idx=col_idx,
                bbox=c_box,
                lines=c_lines,
                drawings=c_drawings,
                horizontal_lines=c_h,
                anchors=col_anchors,
            ))

    # Sort all anchors strictly by q_num
    all_anchors.sort(key=lambda a: a.q_num)

    return VariantLayout(
        var_offset=var_offset,
        columns=columns,
        anchors=all_anchors,
    )
