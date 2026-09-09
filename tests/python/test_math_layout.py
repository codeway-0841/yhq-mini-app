"""
tests/python/test_math_layout.py
Unit tests for layout_model and column segmentation.
"""

import unittest
from pathlib import Path
import pymupdf

from scripts.math_pdf.source_reader import extract_page_data
from scripts.math_pdf.layout_model import build_variant_layout, find_column_gutter


ROOT = Path(__file__).resolve().parent.parent.parent
PDF_PATH = ROOT / "tmp/pdfs/math-source/Algebra1_30.pdf"


class TestMathLayout(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not PDF_PATH.exists():
            raise unittest.SkipTest(f"Source PDF not found: {PDF_PATH}")
        cls.doc = pymupdf.open(PDF_PATH)

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "doc"):
            cls.doc.close()

    def test_find_column_gutter(self):
        p0 = extract_page_data(self.doc[0])
        gutter = find_column_gutter(p0)
        self.assertAlmostEqual(gutter, 297.4, delta=2.0)

    def test_variant_1_layout(self):
        p0 = extract_page_data(self.doc[0])
        p1 = extract_page_data(self.doc[1])
        vl = build_variant_layout(0, p0, p1)
        self.assertTrue(vl.is_complete)
        self.assertEqual(len(vl.anchors), 30)
        self.assertEqual([a.q_num for a in vl.anchors], list(range(1, 31)))

    def test_multiple_variants_monotonicity(self):
        for var in range(5):
            p0 = extract_page_data(self.doc[var * 2])
            p1 = extract_page_data(self.doc[var * 2 + 1])
            vl = build_variant_layout(var, p0, p1)
            self.assertTrue(vl.is_complete, f"Variant {var+1} anchors incomplete: {[a.q_num for a in vl.anchors]}")


if __name__ == "__main__":
    unittest.main()
