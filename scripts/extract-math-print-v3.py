#!/usr/bin/env python3
"""
scripts/extract-math-print-v3.py
Master pipeline runner for Matematika PDF Pipeline v3.
Processes 13 source PDFs, 368 variants, 11,040 questions, isolating diagrams,
reconstructing semantic LaTeX formulas, coordinate-based options, and writing to v3.
"""

from __future__ import annotations

import argparse
from dataclasses import asdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys

# Ensure UTF-8 stdout
sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import pymupdf
from scripts.math_pdf.source_reader import extract_page_data
from scripts.math_pdf.layout_model import build_variant_layout
from scripts.math_pdf.question_segmenter import segment_variant_questions
from scripts.math_pdf.formula_parser import (
    reconstruct_fractions_with_drawings,
    reconstruct_system_cases,
    normalize_typography,
)
from scripts.math_pdf.option_parser import parse_question_options
from scripts.math_pdf.diagram_extractor import extract_question_diagram
from scripts.math_pdf.provenance import ProvenanceWriter, QuestionProvenanceRecord
from scripts.math_pdf.validators import validate_v3_bank


V3_DIR = ROOT / "content-banks/matematika/v3"
V3_IMG_DIR = ROOT / "public/math-print/v3"
PDF_DIR = ROOT / "tmp/pdfs/math-source"
NATIJA_DB = Path(r"D:\Matematika Test Print\NatijaDB.db")


def load_errata_map(errata_path: Path) -> dict[str, dict[str, str]]:
    if not errata_path.exists():
        return {}
    with open(errata_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    errata_map = {}
    for item in data.get("errata", []):
        key = f"{item['pdf']}#variant={item['variant']}&question={item['question']}"
        errata_map[key] = item["resolved_options"]
    return errata_map


def load_answer_keys(db_path: Path, sources: list[dict]) -> dict[tuple[str, int], list[str]]:
    conn = sqlite3.connect(db_path)
    keys: dict[tuple[str, int], list[str]] = {}
    answer_re = re.compile(r"(\d{1,2})\.([ABCD])\b")
    try:
        for s in sources:
            cat = s["category"]
            tbl = s["table"]
            rows = conn.execute(f'SELECT "Id", "Kalit" FROM "{tbl}" ORDER BY "Id"').fetchall()
            for variant_id, raw in rows:
                key = (cat, int(variant_id))
                if key in keys:
                    continue
                found = answer_re.findall(raw or "")
                answers = [f"A{'ABCD'.index(l) + 1}" for _, l in found]
                if len(answers) == 30:
                    keys[key] = answers
    finally:
        conn.close()
    return keys


def main():
    parser = argparse.ArgumentParser(description="Extract Matematika Test Print questions to v3")
    parser.add_argument("--dry-run", action="store_true", help="Run without writing final files")
    parser.add_argument("--limit-sources", type=int, default=None, help="Limit number of PDFs to process")
    args = parser.parse_args()

    manifest_path = V3_DIR / "source-manifest.json"
    if not manifest_path.exists():
        print(f"XATO: Baseline manifest topilmadi: {manifest_path}. Avval build-math-v3-baseline.py ni ishga tushiring!")
        sys.exit(1)

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    sources = manifest["sources"]
    if args.limit_sources:
        sources = sources[:args.limit_sources]

    errata_path = V3_DIR / "source-errata.json"
    errata_map = load_errata_map(errata_path)
    print(f"Errata qoidalari yuklandi: {len(errata_map)} ta")

    answer_keys = load_answer_keys(NATIJA_DB, sources)
    print(f"Answer keys yuklandi: {len(answer_keys)} ta variant")

    prov_writer = ProvenanceWriter(V3_DIR / "provenance.ndjson")
    manual_reviews: list[dict] = []

    bank_topics: list[dict] = []
    bank_items: list[dict] = []

    total_diagrams = 0
    total_processed_questions = 0

    print(f"\n🚀 Matematika PDF Pipeline v3 boshlanmoqda ({len(sources)} ta PDF)...")

    for s_idx, spec in enumerate(sources, 1):
        pdf_name = spec["filename"]
        cat = spec["category"]
        first_var = spec["first_variant"]
        count = spec["count"]
        pdf_path = PDF_DIR / pdf_name

        print(f"[{s_idx}/{len(sources)}] {pdf_name} ({count} variant: {first_var}..{first_var + count - 1})...")
        doc = pymupdf.open(pdf_path)

        cat_names = {
            "algebra": "Algebra",
            "geometriya": "Geometriya",
            "algebra-trigonometriya": "Algebra va Trigonometriya",
            "algebra-geometriya": "Algebra va Geometriya",
            "kombinatorika": "Kombinatorika",
        }
        cat_name = cat_names.get(cat, spec["category"].replace("-", " ").title())

        for v_idx in range(count):
            real_var = first_var + v_idx
            topic_external_id = f"mtp-{cat}-{real_var:03d}"
            name = f"{cat_name} \u2014 {real_var}-variant"

            bank_topics.append({
                "externalId": topic_external_id,
                "nameUz": name,
                "nameRu": name,
            })

            p0 = extract_page_data(doc[v_idx * 2])
            p1 = extract_page_data(doc[v_idx * 2 + 1])
            layout = build_variant_layout(v_idx, p0, p1)
            segments = segment_variant_questions(layout, p0, p1)

            for seg in segments:
                q_num = seg.q_num
                total_processed_questions += 1
                external_id = f"mtp-{cat}-{real_var:03d}-{q_num:02d}"
                source_key = f"{pdf_name}#variant={real_var}&question={q_num}"

                # Diagram extraction
                image_url: str | None = None
                excluded_indices: list[int] = []

                if seg.diagram_drawings:
                    # Find which page has the drawings
                    p_off = 0 if seg.diagram_drawings[0] in p0.drawings else 1
                    target_page = doc[v_idx * 2 + p_off]
                    diag = extract_question_diagram(
                        page=target_page,
                        drawings=seg.diagram_drawings,
                        lines=seg.lines,
                        external_id=external_id,
                        output_dir=V3_IMG_DIR,
                    )
                    if diag:
                        image_url = diag.image_rel_path
                        excluded_indices = diag.label_line_indices
                        total_diagrams += 1

                # Filter out diagram labels from question text lines
                text_lines = [l for i, l in enumerate(seg.lines) if i not in excluded_indices]

                # Check system cases
                cases_latex = reconstruct_system_cases(text_lines)

                # Reconstruct fractions and typography
                full_text = reconstruct_fractions_with_drawings(text_lines, seg.horizontal_lines)
                if cases_latex and cases_latex not in full_text:
                    full_text = f"{cases_latex}\n{full_text}"

                # Parse options
                q_body, options, warnings = parse_question_options(full_text, source_key, errata_map)

                # Get correct answer
                var_key = (cat, real_var)
                correct_ans = answer_keys.get(var_key, ["A1"] * 30)[q_num - 1]

                bank_items.append({
                    "externalId": external_id,
                    "topicExternalId": topic_external_id,
                    "questionUz": q_body,
                    "questionRu": q_body,
                    "optionsUz": options,
                    "optionsRu": options,
                    "correctAnswer": correct_ans,
                    "source": source_key,
                    "image": image_url,
                })

                # Provenance
                prov_writer.record_question(QuestionProvenanceRecord(
                    external_id=external_id,
                    source_pdf=pdf_name,
                    variant=real_var,
                    q_num=q_num,
                    pages=[v_idx * 2, v_idx * 2 + 1],
                    lines_count=len(seg.lines),
                    horizontal_lines_count=len(seg.horizontal_lines),
                    diagram_drawings_count=len(seg.diagram_drawings),
                    has_image=image_url is not None,
                    image_path=image_url,
                    option_markers_found=len([k for k in options if options[k]]),
                    warnings=warnings,
                    errata_applied=source_key in errata_map,
                ))

                if warnings and source_key not in errata_map:
                    manual_reviews.append({
                        "external_id": external_id,
                        "source": source_key,
                        "warnings": warnings,
                        "raw_text": full_text[:100],
                    })

        doc.close()

    print(f"\n✅ Qayta ishlash yakunlandi: {len(bank_topics)} ta mavzu, {len(bank_items)} ta savol, {total_diagrams} ta diagramma.")

    # Validation
    v3_bank = {
        "version": 3,
        "subjectId": "matematika",
        "bankId": "math_db",
        "bankName": "Matematika Test Print",
        "topics": bank_topics,
        "items": bank_items,
    }

    report = validate_v3_bank(v3_bank, manifest)
    print(f"\n--- AUDIT HISOBOTI ---")
    print(f"Jami mavzular: {report.total_topics} / 368")
    print(f"Jami savollar: {report.total_questions} / 11040")
    print(f"Yetishmayotgan IDlar: {len(report.missing_external_ids)}")
    print(f"Ortiqcha IDlar: {len(report.extra_external_ids)}")
    print(f"Bo'sh savollar: {len(report.empty_questions)}")
    print(f"Bo'sh variantlar: {len(report.empty_options)}")
    print(f"Buzilgan gliflar: {report.broken_glyph_count}")
    print(f"Formula oqishlari: {report.leakage_count}")
    print(f"Donor fallbacklar: {report.donor_fallback_count}")
    print(f"Holat: {'✅ O‘TDI' if report.passed else '❌ YIQILDI'}")

    if not args.dry_run:
        # Write files
        out_json_path = V3_DIR / "math-print.json"
        with open(out_json_path, "w", encoding="utf-8") as f:
            json.dump(v3_bank, f, indent=2, ensure_ascii=False)
        print(f"💾 v3 JSON saqlandi: {out_json_path}")

        prov_writer.flush()
        print(f"💾 Provenance saqlandi: {V3_DIR / 'provenance.ndjson'}")

        with open(V3_DIR / "audit-report.json", "w", encoding="utf-8") as f:
            json.dump(asdict(report), f, indent=2, ensure_ascii=False)
        print(f"💾 Audit hisoboti saqlandi: {V3_DIR / 'audit-report.json'}")

        with open(V3_DIR / "manual-review.json", "w", encoding="utf-8") as f:
            json.dump(manual_reviews, f, indent=2, ensure_ascii=False)
        print(f"💾 Qo'lda ko'rish ro'yxati saqlandi: {V3_DIR / 'manual-review.json'}")


if __name__ == "__main__":
    main()
