"""
scripts/math_pdf/source_reader.py
Low-level PDF vector and text geometry extractor.
Extracts characters/glyphs, text spans, lines, vector drawings, and images
from PyMuPDF documents while preserving precise bounding boxes and typography.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Sequence
import pymupdf


@dataclass
class GlyphAtom:
    char: str
    bbox: pymupdf.Rect
    font: str
    size: float
    origin: tuple[float, float]
    color: int

    @property
    def x0(self) -> float: return self.bbox.x0
    @property
    def y0(self) -> float: return self.bbox.y0
    @property
    def x1(self) -> float: return self.bbox.x1
    @property
    def y1(self) -> float: return self.bbox.y1


@dataclass
class SpanAtom:
    text: str
    bbox: pymupdf.Rect
    font: str
    size: float
    origin: tuple[float, float]
    color: int
    flags: int
    glyphs: list[GlyphAtom] = field(default_factory=list)

    @property
    def x0(self) -> float: return self.bbox.x0
    @property
    def y0(self) -> float: return self.bbox.y0
    @property
    def x1(self) -> float: return self.bbox.x1
    @property
    def y1(self) -> float: return self.bbox.y1


@dataclass
class LineAtom:
    bbox: pymupdf.Rect
    spans: list[SpanAtom] = field(default_factory=list)
    dir: tuple[float, float] = (1.0, 0.0)

    @property
    def text(self) -> str:
        return "".join(s.text for s in self.spans)

    @property
    def x0(self) -> float: return self.bbox.x0
    @property
    def y0(self) -> float: return self.bbox.y0
    @property
    def x1(self) -> float: return self.bbox.x1
    @property
    def y1(self) -> float: return self.bbox.y1


@dataclass
class DrawingAtom:
    rect: pymupdf.Rect
    items: list[Any]
    width: float
    color: Any
    fill: Any
    is_horizontal_line: bool = False
    is_vertical_line: bool = False

    @property
    def x0(self) -> float: return self.rect.x0
    @property
    def y0(self) -> float: return self.rect.y0
    @property
    def x1(self) -> float: return self.rect.x1
    @property
    def y1(self) -> float: return self.rect.y1


@dataclass
class PageSourceData:
    page_num: int
    rect: pymupdf.Rect
    lines: list[LineAtom] = field(default_factory=list)
    drawings: list[DrawingAtom] = field(default_factory=list)
    horizontal_lines: list[DrawingAtom] = field(default_factory=list)

    @property
    def width(self) -> float: return self.rect.width
    @property
    def height(self) -> float: return self.rect.height


def extract_page_data(page: pymupdf.Page) -> PageSourceData:
    """
    Extracts all text glyphs, spans, lines, and vector drawings from a PyMuPDF Page.
    """
    page_rect = page.rect
    raw_dict = page.get_text("rawdict")
    raw_drawings = page.get_drawings()

    lines: list[LineAtom] = []
    for b in raw_dict.get("blocks", []):
        if b.get("type") != 0:  # 0 is text block
            continue
        for l in b.get("lines", []):
            line_rect = pymupdf.Rect(l["bbox"])
            line_dir = l.get("dir", (1.0, 0.0))
            spans: list[SpanAtom] = []

            for s in l.get("spans", []):
                span_rect = pymupdf.Rect(s["bbox"])
                glyphs: list[GlyphAtom] = []

                for c in s.get("chars", []):
                    c_rect = pymupdf.Rect(c["bbox"])
                    glyphs.append(GlyphAtom(
                        char=c.get("c", ""),
                        bbox=c_rect,
                        font=c.get("font", s.get("font", "")),
                        size=float(c.get("size", s.get("size", 0.0))),
                        origin=tuple(c.get("origin", (c_rect.x0, c_rect.y1))),
                        color=int(c.get("color", s.get("color", 0))),
                    ))

                span_text = "".join(g.char for g in glyphs)
                spans.append(SpanAtom(
                    text=span_text,
                    bbox=span_rect,
                    font=s.get("font", ""),
                    size=float(s.get("size", 0.0)),
                    origin=tuple(s.get("origin", (span_rect.x0, span_rect.y1))),
                    color=int(s.get("color", 0)),
                    flags=int(s.get("flags", 0)),
                    glyphs=glyphs,
                ))

            if spans:
                lines.append(LineAtom(
                    bbox=line_rect,
                    spans=spans,
                    dir=line_dir,
                ))

    drawings: list[DrawingAtom] = []
    horizontal_lines: list[DrawingAtom] = []

    for d in raw_drawings:
        d_rect = pymupdf.Rect(d["rect"])
        raw_w = d.get("width")
        w = float(raw_w) if raw_w is not None else 1.0
        items = d.get("items", [])
        
        # Check if horizontal line (typical fraction bar or root top)
        # width >= 3.0, height <= 2.5
        is_h_line = (d_rect.height <= 2.5 and d_rect.width >= 3.0)
        # Check if vertical separator
        is_v_line = (d_rect.width <= 2.5 and d_rect.height >= 50.0)

        atom = DrawingAtom(
            rect=d_rect,
            items=items,
            width=w,
            color=d.get("color"),
            fill=d.get("fill"),
            is_horizontal_line=is_h_line,
            is_vertical_line=is_v_line,
        )
        drawings.append(atom)
        if is_h_line:
            horizontal_lines.append(atom)

    return PageSourceData(
        page_num=page.number,
        rect=page_rect,
        lines=lines,
        drawings=drawings,
        horizontal_lines=horizontal_lines,
    )
