"""
tests/python/test_math_v3_fixes.py
Regression tests for v3 reconstruction defects found by full-corpus triage:
- sup/sub lost inside fractions ('n^{2}' -> 'n2')
- degree double-wrap ('^{^{\\circ}}')
- radical over-guessing ('\\sqrt{x -12}') and silent empty '\\sqrt{}'
- per-span normalize splitting multi-span math ('√' + 'x')
"""
import unittest
import pymupdf

from scripts.math_pdf.source_reader import SpanAtom, LineAtom, DrawingAtom
from scripts.math_pdf.formula_parser import (
    normalize_typography,
    render_span_pool_with_scripts,
    build_line_text_with_typography,
    reconstruct_fractions_with_drawings,
    detect_sqrt_groups,
    span_has_marker,
)
from scripts.math_pdf.option_parser import (
    find_option_markers_in_text,
    parse_question_options,
)


def span(text, x0, y0, x1, y1, size=11.95, font="CMR12"):
    return SpanAtom(
        text=text, bbox=pymupdf.Rect(x0, y0, x1, y1),
        font=font, size=size, origin=(x0, y1), color=0, flags=0,
    )


def line(spans, x0=None, y0=None, x1=None, y1=None):
    xs0 = min(s.bbox.x0 for s in spans) if x0 is None else x0
    ys0 = min(s.bbox.y0 for s in spans) if y0 is None else y0
    xs1 = max(s.bbox.x1 for s in spans) if x1 is None else x1
    ys1 = max(s.bbox.y1 for s in spans) if y1 is None else y1
    return LineAtom(bbox=pymupdf.Rect(xs0, ys0, xs1, ys1), spans=spans)


def hline(x0, y, x1, h=0.0):
    r = pymupdf.Rect(x0, y, x1, y + h)
    return DrawingAtom(rect=r, items=[], width=1.0, color=None, fill=None,
                       is_horizontal_line=True)


class TestSupInFractions(unittest.TestCase):
    def test_sup_preserved_in_numerator_pool(self):
        # Q3-like: n (base) + 2 (small, raised)
        n = span("n", 188.9, 182.8, 195.9, 194.7, 11.95, "CMMI12")
        two = span("2", 195.9, 181.6, 200.2, 189.6, 7.96, "CMR8")
        out = render_span_pool_with_scripts([n, two])
        compact = out.replace(" ", "")
        self.assertIn("n^{2}", compact)

    def test_cascaded_nested_sup(self):
        # 001-18: (sin80°)^{x²+x−72}: level-1 sup x(7.96) + level-2 '2'(5.97)
        # renders NESTED so the '2' is visibly superscripted.
        base = span(")", 363.2, 535.9, 367.8, 547.8, 11.95, "CMR12")
        x = span("x", 367.8, 534.7, 372.6, 542.7, 7.96, "CMMI8")
        two = span("2", 372.6, 533.5, 376.2, 539.5, 5.97, "CMR6")
        plus = span("+", 376.7, 534.7, 383.3, 542.7, 7.96, "CMR8")
        l = line([base, x, two, plus])
        out = build_line_text_with_typography(l)
        compact = out.replace(" ", "")
        # Nested level-2 inside one sup group (no '^{a}^{b}' double-sup).
        self.assertIn("^{x^{2}+}", compact)

    def test_cmex_union_maps_to_cup(self):
        # 001-18: '(−∞;−9)\x05(8;∞)' — CMEX10 U+0005 is a big union operator
        out = normalize_typography("(-\u221e;-9)\x05(8;\u221e).")
        self.assertIn(r"\cup", out)
        self.assertNotIn("\x05", out)

    def test_full_fraction_keeps_sup(self):
        num = line([
            span("n", 188.9, 182.8, 195.9, 194.7, 11.95, "CMMI12"),
            span("2", 195.9, 181.6, 200.2, 189.6, 7.96, "CMR8"),
            span(" −n + 3", 200.2, 182.8, 242.5, 194.7, 11.95, "CMR12"),
        ])
        den = line([span("n + 1", 202.1, 199.0, 229.3, 211.0, 11.95, "CMMI12")])
        out = reconstruct_fractions_with_drawings([num, den], [hline(188.9, 197.4, 242.5)])
        compact = out.replace(" ", "")
        self.assertIn(r"\frac{n^{2}-n+3}{n+1}", compact)
        self.assertNotIn("n2-n+3", compact)

    def test_denominator_with_tall_root_span(self):
        # Q8 (ground truth: y = k/√x − 12): 'k' over bar; den spans '√','x'
        # START above the bar; trailing '−12' stays outside the fraction.
        num = line([span("k", 253.4, 521.7, 259.5, 533.7, 11.95, "CMMI12")])
        den = line([
            span("√", 248.3, 529.4, 258.3, 541.4, 11.95, "CMSY10"),
            span("x", 258.3, 538.0, 264.9, 550.0, 11.95, "CMMI12"),
            span("−12", 264.9, 529.8, 292.4, 541.7, 11.95, "CMSY10"),
        ])
        out = reconstruct_fractions_with_drawings(
            [num, den], [hline(248.3, 536.3, 264.9)])
        compact = out.replace(" ", "")
        self.assertIn(r"\frac{k}{\sqrt{x}}", compact)
        self.assertNotIn(r"\sqrt{?}", compact)


class TestDegrees(unittest.TestCase):
    def test_no_nested_degree_wrap(self):
        self.assertEqual(normalize_typography("30°"), r"30^{\circ}")
        # sup-wrapped degree collapses instead of nesting
        self.assertEqual(normalize_typography("^{^{\\circ}}"), r"^{\circ}")
        self.assertNotIn("^{^{", normalize_typography("sin80°"))

    def test_structural_braces_survive_degree_cleanup(self):
        # 006-22: fraction junction '}{' after '^{\circ}' must not be eaten.
        s = "\\frac{sin 90^{\\circ}}{sin 91^{\\circ}}"
        self.assertEqual(normalize_typography(s), s)

    def test_lone_degree_span_not_double_wrapped(self):
        base = span("sin80", 50.0, 100.0, 90.0, 112.0, 11.95, "CMR12")
        deg = span("°", 90.0, 98.0, 95.0, 106.0, 7.96, "CMR8")
        l = line([base, deg])
        out = build_line_text_with_typography(l)
        self.assertNotIn("^{^{", out)
        self.assertIn(r"^{\circ}", out)


class TestRadicals(unittest.TestCase):
    def test_single_token_radicand(self):
        # '√x −12' must NOT swallow '-12' into the root
        out = normalize_typography("√x −12")
        self.assertIn(r"\sqrt{x}", out)
        self.assertNotIn(r"\sqrt{x -12}", out)
        self.assertNotIn(r"\sqrt{x-12}", out)

    def test_prose_never_becomes_radicand(self):
        self.assertNotIn("\\sqrt{yechimga", normalize_typography("√ yechimga"))
        self.assertNotIn("\\sqrt{funksiyaning", normalize_typography("√funksiyaning"))
        self.assertNotIn("\\sqrt{ni}", normalize_typography("√ni soddalashtiring"))

    def test_digit_prefix_radicand(self):
        # '√2cos(4α' -> root covers '2' only (overbar path handles the rest)
        out = normalize_typography("√2cos")
        self.assertIn(r"\sqrt{2}", out)

    def test_paren_radicand(self):
        out = normalize_typography("√(x+2)")
        self.assertEqual(out, r"\sqrt{(x+2)}")

    def test_indexed_root_with_radicand(self):
        # Sup-wrapped degree (geometry-proven small digit) -> indexed root.
        out = normalize_typography("^{3} √x")
        self.assertEqual(out, r"\sqrt[3]{x}")

    def test_bare_digit_before_root_is_coefficient(self):
        # Full-size digits are coefficients, never degrees (001-05:
        # '3√3' must stay '3 \sqrt{3}', not '\sqrt[3]{3}').
        out = normalize_typography("3√3")
        self.assertNotIn("\\sqrt[3]{3}", out)
        self.assertIn("\\sqrt{3}", out)

    def test_no_silent_empty_sqrt(self):
        out = normalize_typography("√")
        self.assertNotIn(r"\sqrt{}", out)

    def test_sqrt_overbar_group(self):
        # '√' glyph + overbar drawing + radicand spans below it
        sqrt = span("√", 248.3, 529.4, 258.3, 541.4, 11.95, "CMSY10")
        x = span("x", 258.3, 538.0, 264.9, 550.0, 11.95, "CMMI12")
        l = line([sqrt, x])
        bar = hline(258.0, 528.0, 275.0)
        groups = detect_sqrt_groups([l], [bar])
        self.assertEqual(len(groups), 1)
        latex, _ids = groups[0]
        self.assertIn(r"\sqrt{x}", latex)
        self.assertNotIn("{}", latex)

    def test_fraction_bar_not_taken_as_overbar(self):
        # 084-05 regression: fraction bar with numerator above must NOT
        # become a sqrt overbar swallowing the fraction.
        num = span("x + y", 167.9, 312.2, 194.7, 324.1, 11.95, "CMMI12")
        sqrt = span("√", 158.0, 319.9, 167.9, 331.8, 11.95, "CMSY10")
        x = span("x", 168.0, 328.5, 174.6, 340.4, 11.95, "CMMI12")
        lnum = line([num])
        lden = line([sqrt, x])
        bar = hline(158.0, 325.0, 195.0)
        groups = detect_sqrt_groups([lnum, lden], [bar])
        self.assertEqual(groups, [])

    def test_row_level_keeps_sqrt_together(self):
        # '√' and '2cos' as separate spans on one line (no overbar):
        # root covers the leading number only, never prose
        sqrt = span("√", 68.9, 120.2, 78.9, 132.1, 11.95, "CMSY10")
        x = span("2cos", 80.0, 120.2, 110.0, 132.1, 11.95, "CMR12")
        l = line([sqrt, x])
        out = reconstruct_fractions_with_drawings([l], [])
        self.assertIn(r"\sqrt{2}", out)
        self.assertNotIn(r"\sqrt{}", out)

    def test_wrapped_degree_before_root(self):
        # Geometry wraps '3' as '^{3}' before row-level sqrt regex runs
        self.assertEqual(normalize_typography("^{3} √x"), r"\sqrt[3]{x}")
        self.assertEqual(normalize_typography("^{5} √2"), r"\sqrt[5]{2}")

    def test_root_does_not_eat_option_marker(self):
        # 006-15 regression: '⁵√B)' keeps marker B), root gets placeholder
        out = normalize_typography("A) \\sqrt[4]{3} - 5√B) 5√2 - 4√3.")
        self.assertIn("B)", out)
        self.assertNotIn("\\sqrt[5]{B}", out)
        out2 = normalize_typography("- √B) 1;")
        self.assertIn("B)", out2)

    def test_degree_after_root_glyph(self):
        # Overlapping small degree sorts after '√': '√ ^{3} x' -> indexed root
        self.assertEqual(normalize_typography("√ ^{3} x"), r"\sqrt[3]{x}")
        self.assertEqual(normalize_typography("\\sqrt{^{3} y}"), r"\sqrt[3]{y}")

    def test_prime_maps_to_ascii(self):
        # U+2032 (derivatives f′) must become ASCII ' for KaTeX-strict.
        out = normalize_typography("f^{′} (x) > f (x)")
        self.assertNotIn("′", out)
        self.assertIn("^{'}", out)

    def test_sentence_dot_leaves_root(self):
        # '\sqrt{2.}' -> '\sqrt{2}.' WITHOUT eating the radicand
        # (group-numbering regression: radicand vanished).
        self.assertEqual(normalize_typography("12 \\sqrt{2.}"), "12 \\sqrt{2}.")
        self.assertEqual(normalize_typography("A \\sqrt[2]{2.}"), "A \\sqrt[2]{2}.")
        # Decimal dots inside are untouched.
        self.assertEqual(normalize_typography("\\sqrt{2.5}"), "\\sqrt{2.5}")

    def test_fullsize_digit_not_root_degree(self):        # Geometry path: full-size '2' in '2√x' is a coefficient, NOT a degree
        sqrt = span("√", 100.0, 200.0, 110.0, 212.0, 11.95, "CMSY10")
        two = span("2", 90.0, 200.0, 96.0, 212.0, 11.95, "CMR12")
        x = span("x", 112.0, 200.0, 118.0, 212.0, 11.95, "CMMI12")
        l = line([two, sqrt, x])
        bar = hline(110.0, 199.0, 125.0)
        groups = detect_sqrt_groups([l], [bar])
        self.assertEqual(len(groups), 1)
        latex, _ = groups[0]
        self.assertTrue(latex.startswith(r"\sqrt{"))
        self.assertNotIn("[2]", latex)

    def test_overbar_allowed_under_prose(self):
        # Q10: inline root's overbar with a PROSE sentence above it is still
        # an overbar (prose is not a fraction numerator).
        sqrt = span("√", 130.0, 681.0, 140.0, 692.9, 11.95, "CMSY10")
        a = span("a", 142.0, 690.9, 148.0, 702.8, 11.95, "CMMI12")
        prose = span("cheksiz ko'p", 36.0, 676.4, 120.0, 688.4, 11.95, "CMR12")
        lq = line([prose])
        lr = line([sqrt, a])
        bar = hline(138.0, 690.3, 173.0)
        groups = detect_sqrt_groups([lq, lr], [bar])
        self.assertEqual(len(groups), 1)
        latex, _ = groups[0]
        self.assertIn(r"\sqrt{a}", latex)

    def test_lone_sqrt_relocates_to_baseline_row(self):
        # Q10 word order: lone '√' joins the row containing its baseline.
        from scripts.math_pdf.formula_parser import cluster_lines_into_rows
        q = line([span("ko'p", 36.0, 676.4, 120.0, 688.4, 11.95, "CMR12")])
        root = line([span("√", 130.0, 681.0, 140.0, 692.9, 11.95, "CMSY10")])
        cont = line([span("yechimga", 51.7, 690.9, 116.1, 702.8, 11.95, "CMR12"),
                     span("a", 142.0, 690.9, 148.0, 702.8, 11.95, "CMMI12")])
        rows = cluster_lines_into_rows([q, root, cont])
        flat = [[l.text for l in r] for r in rows]
        # '√' must end up with 'yechimga…', not with the sentence row.
        row_with_root = next(r for r in flat if any("√" in t for t in r))
        self.assertTrue(any("yechimga" in t for t in row_with_root))

    def test_fraction_sides_need_content(self):
        # A lone '+' under a vector line is not a denominator.
        num = line([span("1", 10.0, 100.0, 16.0, 112.0, 11.95, "CMR12")])
        den = line([span("+", 10.0, 120.0, 16.0, 132.0, 11.95, "CMR12")])
        out = reconstruct_fractions_with_drawings([num, den], [hline(8.0, 115.0, 20.0)])
        self.assertNotIn(r"\frac", out)

    def test_cases_consume_equation_spans(self):
        # 037-10: system equations must not ALSO render linearly.
        from scripts.math_pdf.formula_parser import reconstruct_system_cases
        br = span("\u23a7", 40.0, 100.0, 48.0, 140.0, 11.95, "CMEX10")
        e1 = span("x + y = 1", 52.0, 100.0, 120.0, 112.0, 11.95, "CMR12")
        e2 = span("y + z = 2", 52.0, 120.0, 120.0, 132.0, 11.95, "CMR12")
        bl = line([br])
        l1 = line([e1])
        l2 = line([e2])
        latex, used = reconstruct_system_cases([bl, l1, l2])
        self.assertIn("\\begin{cases}", latex)
        self.assertTrue(len(used) > 0)
        out = reconstruct_fractions_with_drawings([bl, l1, l2], [], used)
        self.assertNotIn("x + y = 1", out)

    def test_wide_separator_bar_rejected(self):
        # 006-09: 215pt column rule with two isolated clusters is not a bar.
        num = line([span("a", 120.0, 100.0, 130.0, 112.0, 11.95, "CMR12"),
                    span("b", 218.0, 100.0, 228.0, 112.0, 11.95, "CMR12")])
        den = line([span("c", 120.0, 120.0, 130.0, 132.0, 11.95, "CMR12"),
                    span("d", 218.0, 120.0, 228.0, 132.0, 11.95, "CMR12")])
        out = reconstruct_fractions_with_drawings([num, den], [hline(50.0, 115.0, 265.0)])
        self.assertNotIn(r"\frac", out)

    def test_next_row_numerator_excluded(self):
        # 006-09 A1: the NEXT option's 'π' must not leak into this den.
        num = line([span("π", 136.0, 621.0, 143.0, 633.0, 11.95, "CMMI12")])
        den = line([span("6", 137.0, 637.0, 143.0, 649.0, 11.95, "CMR12")])
        intruder = line([span("π", 136.0, 644.0, 143.0, 656.0, 11.95, "CMMI12")])
        out = reconstruct_fractions_with_drawings([num, den, intruder], [hline(136.0, 636.0, 143.0)])
        self.assertIn(r"\frac{\pi}{6}", out)
        self.assertNotIn(r"\pi 6", out.replace(r"\frac{\pi}{6}", ""))

    def test_dangling_sqrt_joins_next_row(self):
        # Cross-row roots resolve via '\s*' in the linear rules
        # (Q8: '√' stranded at row end, radicand opens next row).
        out = normalize_typography("y =\n√\nx −12")
        self.assertIn("\\sqrt{x}", out)
        # Prose never attaches
        out2 = normalize_typography("ko‘p\n√\nyechimga")
        self.assertNotIn("\\sqrt{yechimga", out2)
        # Markers never attach
        out3 = normalize_typography("A) x\n√\nB) y")
        self.assertIn("B)", out3)

    def test_detached_subscript_joins(self):
        self.assertEqual(normalize_typography("log _{2} x"), "log_{2} x")

    def test_decimal_comma_subscript_joins(self):
        # 'log' base '0,2': small lowered '0' ',' '2' merge into one subscript
        log = span("log", 10.0, 100.0, 25.0, 112.0, 11.95, "CMR12")
        z = span("0", 25.0, 104.0, 30.0, 110.0, 7.96, "CMR8")
        comma = span(",", 30.0, 104.0, 33.0, 110.0, 7.96, "CMR8")
        two = span("2", 33.0, 104.0, 38.0, 110.0, 7.96, "CMR8")
        l = line([log, z, comma, two])
        out = build_line_text_with_typography(l)
        self.assertIn("log_{0,2}", out.replace(" ", ""))

    def test_log_base_exact_geometry(self):        # v1q21 exact spans: 2^{log_{0,2}(x)·…} — comma+digit must join.
        from scripts.math_pdf.formula_parser import ScriptRenderer
        def S2(text, x0, y0, x1, y1, size, font="CMR12"):
            return span(text, x0, y0, x1, y1, size, font)
        spans = [
            S2("2", 325.8, 746.4, 331.6, 758.4, 11.95),
            S2("log", 331.6, 745.1, 342.4, 753.1, 7.96),
            S2("0", 342.6, 748.7, 346.2, 754.7, 5.97),
            S2(",", 346.2, 748.7, 348.5, 754.7, 5.97),
            S2("2", 348.5, 748.7, 352.1, 754.7, 5.97),
            S2("(x)", 352.6, 745.1, 364.0, 753.1, 7.96),
        ]
        r = ScriptRenderer(11.95, 758.4, 741.9)
        for s in spans:
            r.render(s)
        out = r.result().replace(" ", "")
        # Comma nests into the sub and the digit continues ('_{0,2}').
        self.assertIn("_{0,2}", out)
        self.assertNotIn("?,", out)


class TestMarkerProtection(unittest.TestCase):
    def test_marker_spans_detected(self):
        self.assertTrue(span_has_marker("B) 5 2 - 4 3."))
        self.assertTrue(span_has_marker("\\left(A) [- 9;"))
        self.assertFalse(span_has_marker("a + b"))
        self.assertFalse(span_has_marker("\\sqrt{a}"))

    def test_option_marker_after_open_paren_is_option(self):
        # Interval options '(A) 2πn' / '(A) [-9; ∞)' must be found (031-19).
        ms = find_option_markers_in_text("(A) 2πn; B) 0.")
        self.assertEqual([m.letter for m in ms], ["A", "B"])

    def test_permuted_grid_letter_assignment(self):
        # 2-column grid linearizes as B,A,C,D: content follows letters.
        text = "Savol matni. B) beta. A) alfa. C) gamma. D) delta."
        body, opts, _w = parse_question_options(text)
        self.assertEqual(body, "Savol matni.")
        self.assertEqual(opts["A1"], "alfa.")
        self.assertEqual(opts["A2"], "beta.")
        self.assertEqual(opts["A3"], "gamma.")
        self.assertEqual(opts["A4"], "delta.")

    def test_braced_power_marker_kept(self):
        # 'B)^{3}' is option content (wrapped degree), not a math power.
        ms = find_option_markers_in_text("A) x. B)^{3} y. C) z. D) w.")
        self.assertEqual([m.letter for m in ms], ["A", "B", "C", "D"])
        # Bare 'B)^2' stays skipped as math power.
        ms2 = find_option_markers_in_text("ifoda (B)^2 + C) 5.")
        self.assertEqual([m.letter for m in ms2], ["C"])

    def test_math_paren_var_still_skipped(self):
        # Genuine '(A - B)' inside a formula is not an option marker.
        ms = find_option_markers_in_text("ifoda (A - B) + C) 5.")
        self.assertEqual([m.letter for m in ms], ["C"])

    def test_marker_span_excluded_from_radicand(self):
        sqrt = span("√", 10.0, 100.0, 20.0, 112.0, 11.95, "CMSY10")
        good = span("6", 22.0, 100.0, 28.0, 112.0, 11.95, "CMMI12")
        marker = span("B) 1;", 60.0, 100.0, 90.0, 112.0, 11.95, "CMR12")
        l = line([sqrt, good, marker])
        bar = hline(20.0, 99.0, 95.0)
        groups = detect_sqrt_groups([l], [bar])
        self.assertEqual(len(groups), 1)
        latex, _ = groups[0]
        self.assertNotIn("B)", latex)
        self.assertIn("6", latex)


class TestNormalizeIdempotency(unittest.TestCase):
    def test_double_pass_stable(self):
        # normalize runs per-row AND on the joined text AND in clean_*:
        # backslash-inserting rules must not re-fire on their own output
        # (020-18: '\log' doubled to '\\\\log' across passes).
        samples = [
            "log_{0,5} (2x - 7)",
            "\\log_{0,5} (2x - 7)",
            "lg x + ln y",
            "\\lg x",
            "\\operatorname{tg} x",
            "\\frac{\\pi n}{2}; n \\in Z",
            "30^{\\circ}",
            "\\sqrt[3]{x} + \\sqrt{x}",
            "2^{\\log_{0,2}}",
        ]
        for s in samples:
            once = normalize_typography(s)
            twice = normalize_typography(once)
            self.assertEqual(twice, once, f"not idempotent: {s!r} -> {once!r} -> {twice!r}")


class TestTranscriptionErrata(unittest.TestCase):
    def test_question_and_options_override(self):
        errata = {
            "s.pdf#variant=59&question=24": {
                "options": {"A1": "a.", "A2": "b.", "A3": "c.", "A4": "d."},
                "question": "Tenglamani yeching: x = 1.",
            }
        }
        q, opts, warns = parse_question_options(
            "garbage A) x B) y", "s.pdf#variant=59&question=24", errata)
        self.assertEqual(q, "Tenglamani yeching: x = 1.")
        self.assertEqual(opts["A4"], "d.")
        self.assertTrue(any("transcription" in w for w in warns))

    def test_legacy_options_only_errata_still_works(self):
        errata = {"s.pdf#variant=1&question=1":
                  {"A1": "0,8.", "A2": "0,1.", "A3": "0,2.", "A4": "0,4."}}
        q, opts, _w = parse_question_options(
            "0,8. 0,1. 0,2. 0,4.", "s.pdf#variant=1&question=1", errata)
        self.assertEqual(opts["A1"], "0,8.")


if __name__ == "__main__":
    unittest.main()
