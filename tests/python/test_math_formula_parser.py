"""
tests/python/test_math_formula_parser.py
Unit tests for formula_parser AST builder and typography normalizer.
"""

import unittest
from scripts.math_pdf.formula_parser import (
    normalize_typography,
    FractionNode,
    RadicalNode,
    CasesNode,
)


class TestMathFormulaParser(unittest.TestCase):
    def test_typography_ligatures_and_symbols(self):
        text = "ﬃ ﬄ ﬂ ﬁ ﬀ − · × ≤ ≥ ≠ ≈ ∞ ∈ ∉ ∪ ∩ ⊂ ∥ ⊥ → ∠"
        normalized = normalize_typography(text)
        self.assertNotIn("ﬃ", normalized)
        self.assertIn("ffi", normalized)
        self.assertIn(r"\cdot", normalized)
        self.assertIn(r"\le", normalized)
        self.assertIn(r"\ge", normalized)
        self.assertIn(r"\cup", normalized)
        self.assertIn(r"\cap", normalized)

    def test_degrees_normalization(self):
        self.assertEqual(normalize_typography("30°"), r"30^{\circ}")
        self.assertEqual(normalize_typography("45◦"), r"45^{\circ}")

    def test_consecutive_superscripts_merge(self):
        raw = "e^{2}^{x}^{-}^{3}^{x}^{2}"
        merged = normalize_typography(raw)
        self.assertEqual(merged, "e^{2x-3x2}")

    def test_ast_nodes(self):
        f = FractionNode(numerator="a + b", denominator="c - d")
        self.assertEqual(f.to_latex(), r"\frac{a + b}{c - d}")

        r1 = RadicalNode(radicand="x^2 + 1")
        self.assertEqual(r1.to_latex(), r"\sqrt{x^2 + 1}")

        r2 = RadicalNode(radicand="x + y", degree="3")
        self.assertEqual(r2.to_latex(), r"\sqrt[3]{x + y}")

        c = CasesNode(equations=["2x + y = 5", "x - y = 1"])
        expected = "\\begin{cases}\n2x + y = 5 \\\\\nx - y = 1\n\\end{cases}"
        self.assertEqual(c.to_latex(), expected)


if __name__ == "__main__":
    unittest.main()
