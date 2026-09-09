"""
tests/python/test_math_diagrams.py
Unit tests for diagram_extractor.
"""

import unittest
from pathlib import Path
import pymupdf

from scripts.math_pdf.source_reader import LineAtom, SpanAtom, DrawingAtom
from scripts.math_pdf.diagram_extractor import is_label_line


def make_line(text: str, bbox: pymupdf.Rect) -> LineAtom:
    s = SpanAtom(
        text=text,
        bbox=bbox,
        font="CMR10",
        size=10.0,
        origin=(bbox.x0, bbox.y1),
        color=0,
        flags=0,
    )
    return LineAtom(bbox=bbox, spans=[s])


class TestMathDiagrams(unittest.TestCase):
    def test_is_label_line(self):
        diag_box = pymupdf.Rect(50.0, 50.0, 150.0, 150.0)

        # Labels inside or close
        l_x = make_line("x", pymupdf.Rect(52.0, 55.0, 60.0, 65.0))
        self.assertTrue(is_label_line(l_x, diag_box))

        l_degree = make_line("30°", pymupdf.Rect(80.0, 90.0, 95.0, 100.0))
        self.assertTrue(is_label_line(l_degree, diag_box))

        # Long text outside
        l_long = make_line("Quyidagi chizmadan foydalanib x ni toping.", pymupdf.Rect(20.0, 20.0, 200.0, 35.0))
        self.assertFalse(is_label_line(l_long, diag_box))

        # Option text
        l_opt = make_line("A) 10. B) 20.", pymupdf.Rect(50.0, 160.0, 100.0, 175.0))
        self.assertFalse(is_label_line(l_opt, diag_box))


if __name__ == "__main__":
    unittest.main()
