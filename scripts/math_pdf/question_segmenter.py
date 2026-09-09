"""
scripts/math_pdf/question_segmenter.py
Segments lines and drawings into individual questions (1..30)
based on dynamic column flows, element ownership graphs,
cross-column overflow, and top-of-column formula headers.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Sequence
import pymupdf

from scripts.math_pdf.source_reader import LineAtom, DrawingAtom, PageSourceData
from scripts.math_pdf.layout_model import VariantLayout, QuestionAnchor, ColumnLayout, find_column_gutter


OPTION_D_RE = re.compile(r"(?<![\w\\∩∪\(])D\s*\)")
OPTION_ANY_RE = re.compile(r"(?<![\w\\∩∪\(])([ABCD])\s*\)")


@dataclass
class QuestionSegment:
    q_num: int
    lines: list[LineAtom] = field(default_factory=list)
    drawings: list[DrawingAtom] = field(default_factory=list)
    horizontal_lines: list[DrawingAtom] = field(default_factory=list)
    diagram_drawings: list[DrawingAtom] = field(default_factory=list)
    clips: list[tuple[int, pymupdf.Rect]] = field(default_factory=list)  # (page_offset, Rect)

    @property
    def has_diagram(self) -> bool:
        return len(self.diagram_drawings) > 0


def segment_variant_questions(
    layout: VariantLayout,
    p0_data: PageSourceData,
    p1_data: PageSourceData,
) -> list[QuestionSegment]:
    """
    Partitions the entire variant's lines and drawings into 30 QuestionSegments.
    Handles intra-column questions, cross-column option spills,
    and high formula numerators / root crowns that precede question anchors.
    """
    pages = [p0_data, p1_data]
    segments: list[QuestionSegment] = [QuestionSegment(q_num=q) for q in range(1, 31)]

    # Map each column by (page_offset, col_idx)
    col_map: dict[tuple[int, int], ColumnLayout] = {
        (c.page_offset, c.col_idx): c for c in layout.columns
    }

    # Ordered list of column keys in visual flow order:
    col_order = [(0, 0), (0, 1), (1, 0), (1, 1)]

    # Group anchors by column
    anchors_by_col: dict[tuple[int, int], list[QuestionAnchor]] = {k: [] for k in col_order}
    for a in layout.anchors:
        anchors_by_col[(a.page_offset, a.col_idx)].append(a)

    for col_key in col_order:
        col = col_map[col_key]
        c_anchors = anchors_by_col[col_key]
        c_lines = col.lines

        if not c_anchors:
            # Column has no question anchors.
            # If previous column's last question is incomplete, all lines here belong to it!
            # Otherwise they belong to the next question.
            # Find previous active question:
            prev_anchors = [a for a in layout.anchors if (a.page_offset, a.col_idx) < col_key]
            if prev_anchors and c_lines:
                last_q = prev_anchors[-1].q_num
                segments[last_q - 1].lines.extend(c_lines)
            continue

        first_anchor = c_anchors[0]
        # Lines in this column before the first anchor
        prefix_lines = c_lines[:first_anchor.line_idx]

        if prefix_lines:
            prev_q_num = first_anchor.q_num - 1
            if prev_q_num >= 1:
                prev_seg = segments[prev_q_num - 1]
                # Check which lines belong to first_anchor vs prev_seg.
                # first_anchor can ONLY claim lines that:
                # 1. Contain NO option markers (A, B, C, D)
                # 2. Are in the immediate row/header of first_anchor (bottom reaches into anchor y-span)
                # 3. Are contiguous with first_anchor (at the end of prefix_lines)
                split_idx = len(prefix_lines)
                for idx in range(len(prefix_lines) - 1, -1, -1):
                    pl = prefix_lines[idx]
                    if OPTION_ANY_RE.search(pl.text):
                        break
                    if (abs(pl.y1 - first_anchor.y1) <= 4.0) or (pl.y1 >= first_anchor.y0 and pl.x0 >= first_anchor.line.x0):
                        split_idx = idx
                    else:
                        break

                prev_seg.lines.extend(prefix_lines[:split_idx])
                segments[first_anchor.q_num - 1].lines.extend(prefix_lines[split_idx:])

        # Now handle anchors inside this column
        for i in range(len(c_anchors)):
            curr_a = c_anchors[i]
            curr_q_seg = segments[curr_a.q_num - 1]

            if i + 1 < len(c_anchors):
                next_a = c_anchors[i + 1]
                mid_lines = c_lines[curr_a.line_idx:next_a.line_idx]

                # Find where curr_a ends and next_a begins:
                last_opt_idx = -1
                for idx, ml in enumerate(mid_lines):
                    if OPTION_ANY_RE.search(ml.text):
                        last_opt_idx = idx

                if last_opt_idx == -1:
                    # No options in mid_lines: check if tail lines share next_a baseline
                    split_idx = len(mid_lines)
                    for idx in range(len(mid_lines) - 1, 0, -1):
                        ml = mid_lines[idx]
                        is_next_row = (abs(ml.y1 - next_a.y1) <= 6.0) or (ml.y1 >= next_a.y0 and ml.x0 >= next_a.line.x0)
                        if is_next_row:
                            split_idx = idx
                        else:
                            break
                else:
                    opt_line = mid_lines[last_opt_idx]
                    split_idx = last_opt_idx + 1

                    # Check if option D already finished on opt_line
                    d_match = OPTION_D_RE.search(opt_line.text)
                    if d_match and opt_line.text[d_match.end():].strip().endswith((".", ";")):
                        pass
                    else:
                        # Check if subsequent lines are continuation of option D
                        while split_idx < len(mid_lines):
                            ml = mid_lines[split_idx]
                            # System brackets definitely start next_a
                            if any(c in ml.text for c in "⎧⎪⎨⎩"):
                                break
                            # Short continuation / denominator / ending of option D (not on next_a baseline)
                            if ml.y0 <= opt_line.y1 + 15.0 and len(ml.text.strip()) <= 15 and abs(ml.y1 - next_a.y1) > 6.0:
                                split_idx += 1
                                if ml.text.strip().endswith((".", ";")):
                                    break
                                continue
                            # Lines sharing next_a baseline or inside next_a start next_a
                            if abs(ml.y1 - next_a.y1) <= 6.0 or (ml.y1 >= next_a.y0 and ml.x0 >= next_a.line.x0):
                                break
                            break

                curr_q_seg.lines.extend(mid_lines[:split_idx])
                segments[next_a.q_num - 1].lines.extend(mid_lines[split_idx:])
            else:
                # Last anchor in this column: all lines from curr_a.line_idx to the end of this column
                curr_q_seg.lines.extend(c_lines[curr_a.line_idx:])

    # Now associate drawings and horizontal lines with question segments based on bounding boxes
    for seg in segments:
        if not seg.lines:
            continue

        # Compute bounding boxes of lines on each page
        by_page: dict[int, list[LineAtom]] = {}
        for l in seg.lines:
            p_off = 0 if l in p0_data.lines else 1
            by_page.setdefault(p_off, []).append(l)

        for p_off, p_lines in by_page.items():
            min_x = min(l.x0 for l in p_lines)
            max_x = max(l.x1 for l in p_lines)
            min_y = min(l.y0 for l in p_lines)
            max_y = max(l.y1 for l in p_lines)

            # Expand slightly for fraction lines, radicals, and diagrams
            gutter = find_column_gutter(pages[p_off])
            if max_x < gutter:
                col_box = pymupdf.Rect(20.0, max(20.0, min_y - 10.0), gutter, min(805.0, max_y + 10.0))
            else:
                col_box = pymupdf.Rect(gutter, max(20.0, min_y - 10.0), pages[p_off].width - 15.0, min(805.0, max_y + 10.0))

            seg.clips.append((p_off, col_box))

            # Match horizontal math lines
            p_data = pages[p_off]
            for hl in p_data.horizontal_lines:
                # Vertical center of horizontal line inside question y-range
                cy = (hl.y0 + hl.y1) / 2.0
                if col_box.y0 <= cy <= col_box.y1 and col_box.x0 <= hl.x0 and hl.x1 <= col_box.x1 + 10.0:
                    if hl not in seg.horizontal_lines:
                        seg.horizontal_lines.append(hl)

            # Match drawings: diagrams (drawings that are not horizontal math lines and not column dividers)
            for d in p_data.drawings:
                if d.is_horizontal_line:
                    continue
                if d.rect.height >= 300.0 and abs(d.x0 - 297.5) < 30.0:
                    continue  # Column divider
                cy = (d.y0 + d.y1) / 2.0
                if col_box.y0 - 5.0 <= cy <= col_box.y1 + 5.0 and col_box.x0 - 5.0 <= d.x0 and d.x1 <= col_box.x1 + 10.0:
                    if d not in seg.diagram_drawings:
                        seg.diagram_drawings.append(d)

    return segments
