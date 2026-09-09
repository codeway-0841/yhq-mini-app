"""
tests/python/test_math_options.py
Unit tests for option_parser.
"""

import unittest
from scripts.math_pdf.option_parser import (
    find_option_markers_in_text,
    parse_question_options,
)


class TestMathOptions(unittest.TestCase):
    def test_standard_options(self):
        text = "Tenglamani yeching: 2x = 4. A) 2. B) 4. C) 0. D) -2."
        body, opts, warnings = parse_question_options(text)
        self.assertEqual(body, "Tenglamani yeching: 2x = 4.")
        self.assertEqual(opts["A1"], "2.")
        self.assertEqual(opts["A2"], "4.")
        self.assertEqual(opts["A3"], "0.")
        self.assertEqual(opts["A4"], "-2.")
        self.assertEqual(len(warnings), 0)

    def test_false_positive_prevention(self):
        text = "Agar A(A -B) + B(B -C) + C(C -A) = 0 bo‘lsa, qiymatni toping. A) 0,25. B) 0,75. C) 1. D) 0,5."
        body, opts, warnings = parse_question_options(text)
        self.assertTrue(body.startswith("Agar A(A -B)"))
        self.assertEqual(opts["A1"], "0,25.")
        self.assertEqual(opts["A2"], "0,75.")
        self.assertEqual(opts["A3"], "1.")
        self.assertEqual(opts["A4"], "0,5.")

    def test_duplicate_markers(self):
        text = "Sistemani yeching. A) 7. B) 8. D) 9. D) 12."
        body, opts, warnings = parse_question_options(text)
        self.assertEqual(body, "Sistemani yeching.")
        self.assertEqual(opts["A1"], "7.")
        self.assertEqual(opts["A2"], "8.")
        self.assertEqual(opts["A3"], "9.")
        self.assertEqual(opts["A4"], "12.")

    def test_errata_resolution(self):
        text = "0,8. 0,1. 0,2. 0,4."
        errata = {
            "test.pdf#variant=1&question=1": {
                "A1": "0,8.", "A2": "0,1.", "A3": "0,2.", "A4": "0,4."
            }
        }
        body, opts, warnings = parse_question_options(
            text, "test.pdf#variant=1&question=1", errata
        )
        self.assertEqual(opts["A1"], "0,8.")
        self.assertEqual(opts["A2"], "0,1.")
        self.assertEqual(opts["A3"], "0,2.")
        self.assertEqual(opts["A4"], "0,4.")


if __name__ == "__main__":
    unittest.main()
