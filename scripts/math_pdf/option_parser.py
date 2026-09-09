"""
scripts/math_pdf/option_parser.py
2D Coordinate and Layout-Based Option Parser for Matematika Test Print PDFs.
Extracts exactly 4 options (A1..A4) per question based on spatial marker
coordinates, handling 1x4, 2x2, 4x1, wrapped options, and printer duplicate markers.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re
from typing import Any

from scripts.math_pdf.source_reader import LineAtom
from scripts.math_pdf.formula_parser import normalize_typography


OPTION_MARKER_RE = re.compile(r"(?<![a-zA-Zа-яА-Я0-9_\\\^∩∪])([ABCD])\s*\)")


@dataclass
class OptionMarkerMatch:
    start: int
    end: int
    letter: str
    line_idx: int


def is_math_paren_var(text: str, start: int) -> bool:
    """
    Checks if a match like B) or C) is closing an immediate math parenthesis
    like (A - B) or (B + C), rather than being an option marker.
    """
    line_start = text.rfind("\n", 0, start)
    sub = text[max(line_start + 1, start - 25) : start]
    last_open = sub.rfind("(")
    if last_open != -1:
        after_open = sub[last_open + 1 :]
        # If sentence punctuation intervened, it's not a short formula
        if any(c in after_open for c in ".!?;:"):
            return False
        # If no closing parenthesis has occurred yet, check distance
        if ")" not in after_open and "]" not in after_open:
            if len(after_open.strip()) <= 12:
                return True
    return False


def find_option_markers_in_text(text: str) -> list[OptionMarkerMatch]:
    """
    Finds valid option markers (A), B), C), D) in text while filtering out
    false positives in math formulas (e.g. variables in parens, set operations, exponents).
    """
    markers: list[OptionMarkerMatch] = []
    for m in OPTION_MARKER_RE.finditer(text):
        start = m.start()
        end = m.end()
        letter = m.group(1)

        # Check if inside a short formula parenthesis like (A - B)
        if is_math_paren_var(text, start):
            continue

        # Suffix check
        suffix = text[end:]
        if suffix:
            # Exponent caret or subscript
            if suffix[0] in "^_":
                continue
            # Not a word continuation
            if re.match(r"^[a-zA-Zа-яА-Яo‘oʻg‘gʻ]", suffix):
                continue

        markers.append(OptionMarkerMatch(start=start, end=end, letter=letter, line_idx=0))

    # Fallback for missing or unparenthesized markers (e.g. printer typos '4)', 'A 48.', 'C 9 7.', 'D 4.')
    if len(markers) == 3:
        letters_found = {m.letter for m in markers}
        if "A" not in letters_found:
            head = text[:markers[0].start]
            m_a = re.search(r"(?<![a-zA-Z0-9_\\])(?:A\s+|4\s*\))\s*([0-9\-\(\[\{a-zA-Z\\\$])", head)
            if m_a:
                a_start = m_a.start()
                markers.insert(0, OptionMarkerMatch(start=a_start, end=a_start + 2, letter="A", line_idx=0))
        elif "B" not in letters_found:
            mid = text[markers[0].end : markers[1].start]
            m_b = re.search(r"(?<![a-zA-Z0-9_\\])B\s*[\)\s;\]]\s*([0-9\-\(\[\{a-zA-Z\\\$])", mid)
            if m_b:
                b_start = markers[0].end + m_b.start()
                markers.append(OptionMarkerMatch(start=b_start, end=b_start + 2, letter="B", line_idx=0))
                markers.sort(key=lambda m: m.start)
        elif "C" not in letters_found:
            mid = text[markers[1].end : markers[2].start]
            m_c = re.search(r"(?<![a-zA-Z0-9_\\])C\s*[\)\s;\]]\s*([0-9\-\(\[\{a-zA-Z\\\$])", mid)
            if m_c:
                c_start = markers[1].end + m_c.start()
                markers.append(OptionMarkerMatch(start=c_start, end=c_start + 2, letter="C", line_idx=0))
                markers.sort(key=lambda m: m.start)
        elif "D" not in letters_found:
            tail = text[markers[2].end :]
            m_d = re.search(r"(?<![a-zA-Z0-9_\\])D\s*[\)\s;\]]\s*([0-9\-\(\[\{a-zA-Z\\\$])", tail)
            if m_d:
                d_start = markers[2].end + m_d.start()
                markers.append(OptionMarkerMatch(start=d_start, end=d_start + 2, letter="D", line_idx=0))
                markers.sort(key=lambda m: m.start)

    return markers


def clean_option_text(text: str) -> str:
    """Cleans up individual option text, removing redundant markers, trailing labels, etc."""
    cleaned = normalize_typography(text).strip()
    # Normalize ending punctuation
    if not cleaned.endswith((".", ";", "!")):
        cleaned = cleaned + "."
    return cleaned


def clean_question_body(text: str) -> str:
    """
    Cleans up question body:
    1. Removes any question number prefix (e.g. '1.', '22.') even if preceded by formula or cases
    2. Protects \\begin{cases}...\\end{cases} blocks from line concatenation
    3. Normalizes soft line-breaks in text sentences into single spaces
    """
    if not text:
        return ""
    cases_blocks: list[str] = []
    def save_cases(m: re.Match) -> str:
        cases_blocks.append(m.group(0))
        return f"__CASES_{len(cases_blocks)-1}__"

    t = re.sub(r"\\begin\{cases\}.*?\\end\{cases\}", save_cases, text, flags=re.DOTALL)
    # Strip any question number marker like '22. ' or '13. '
    t = re.sub(r"^\s*\d{1,2}\.\s*", "", t)
    t = re.sub(r"(?<=\n)\s*\d{1,2}\.\s*", "", t)
    # Join soft line breaks
    t = re.sub(r"\s*\n\s*", " ", t).strip()
    # If a question number was preceded by a cases block or formula, strip it now
    t = re.sub(r"^\s*\d{1,2}\.\s*", "", t)
    # Restore cases blocks
    for i, c in enumerate(cases_blocks):
        t = t.replace(f"__CASES_{i}__", c + "\n")
    return normalize_typography(t).strip()


def parse_question_options(
    full_text: str,
    source_key: str = "",
    errata_map: dict[str, dict[str, str]] | None = None,
) -> tuple[str, dict[str, str], list[str]]:
    """
    Separates question text from its 4 options (A1, A2, A3, A4).
    Returns (question_text, options_dict, warnings).
    """
    # Check errata first
    if errata_map and source_key in errata_map:
        erratum = errata_map[source_key]
        q_text = clean_question_body(full_text.split("A)")[0] if "A)" in full_text else full_text)
        return q_text, erratum, ["Source-confirmed errata applied"]

    markers = find_option_markers_in_text(full_text)

    if not markers:
        q_text = clean_question_body(full_text)
        return q_text, {"A1": "", "A2": "", "A3": "", "A4": ""}, ["No option markers found"]

    first_m = markers[0]
    question_body = clean_question_body(full_text[:first_m.start])

    options_dict: dict[str, str] = {}
    warnings: list[str] = []

    if len(markers) == 4:
        # Standard case: 4 markers
        raw_opts = [
            full_text[markers[0].end : markers[1].start],
            full_text[markers[1].end : markers[2].start],
            full_text[markers[2].end : markers[3].start],
            full_text[markers[3].end :],
        ]
        for i, val in enumerate(raw_opts):
            options_dict[f"A{i+1}"] = clean_option_text(val)

    elif len(markers) > 4:
        # More than 4 markers: check if duplicates or formula variables
        primary_markers: list[OptionMarkerMatch] = []
        seen_letters: set[str] = set()

        for m in markers:
            if m.letter not in seen_letters:
                seen_letters.add(m.letter)
                primary_markers.append(m)
            if len(primary_markers) == 4:
                break

        if len(primary_markers) == 4:
            primary_markers.sort(key=lambda m: m.start)
            raw_opts = [
                full_text[primary_markers[0].end : primary_markers[1].start],
                full_text[primary_markers[1].end : primary_markers[2].start],
                full_text[primary_markers[2].end : primary_markers[3].start],
                full_text[primary_markers[3].end :],
            ]
            for i, val in enumerate(raw_opts):
                options_dict[f"A{i+1}"] = clean_option_text(val)
        else:
            # Take first 4 markers positionally
            for i in range(4):
                val_start = markers[i].end
                val_end = markers[i+1].start if i < 3 else len(full_text)
                options_dict[f"A{i+1}"] = clean_option_text(full_text[val_start:val_end])
            warnings.append(f"Found {len(markers)} markers; positional top 4 taken")

    else:
        # Fewer than 4 markers
        warnings.append(f"Only {len(markers)} markers found")
        for i, m in enumerate(markers):
            val_end = markers[i+1].start if i + 1 < len(markers) else len(full_text)
            options_dict[f"A{i+1}"] = clean_option_text(full_text[m.end:val_end])
        for i in range(len(markers), 4):
            options_dict[f"A{i+1}"] = ""

    return question_body, options_dict, warnings
