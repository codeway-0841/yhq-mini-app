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

    def test_operatorname_idempotency(self):
        raw = "ctg x + tg y"
        pass1 = normalize_typography(raw)
        self.assertEqual(pass1, r"\operatorname{ctg} x + \operatorname{tg} y")
        pass2 = normalize_typography(pass1)
        self.assertEqual(pass2, r"\operatorname{ctg} x + \operatorname{tg} y")
        # Collapses existing nested operatorname
        nested = r"\operatorname{\operatorname{\operatorname{ctg}}} \alpha"
        self.assertEqual(normalize_typography(nested), r"\operatorname{ctg} \alpha")

    def test_pi_token_spacing(self):
        text = r"x = \frac{\pi}{3} + \pin, n \in Z; y = \pik"
        normalized = normalize_typography(text)
        self.assertNotIn(r"\pin", normalized)
        self.assertNotIn(r"\pik", normalized)
        self.assertIn(r"\pi n", normalized)
        self.assertIn(r"\pi k", normalized)

    def test_repeated_parentheses_collapse(self):
        text = r"\left(\left(\left(a + b\right) \right) \right) \left(\right)"
        normalized = normalize_typography(text)
        self.assertEqual(normalized, r"\left(a + b\right)")

    def test_subsup_ordering(self):
        text = "a^{2} _{1} + a^{2} _{2} + a^{2} _{3} = 93"
        normalized = normalize_typography(text)
        self.assertEqual(normalized, "a_{1}^{2} + a_{2}^{2} + a_{3}^{2} = 93")

    def test_math_delimiter_glyphs_and_control_chars(self):
        text = "\x06x + y\x07 \\in \x08a; b\x09 \x13 \x08c; d\x09 \x18\x18\x18"
        normalized = normalize_typography(text)
        self.assertEqual(normalized, r"\left(x + y\right) \in [a; b] \cup [c; d] |")


if __name__ == "__main__":
    unittest.main()
