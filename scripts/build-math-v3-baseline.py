#!/usr/bin/env python3
"""
scripts/build-math-v3-baseline.py
Captures baseline manifest for Matematika PDF Pipeline v3.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
CANONICAL_JSON = ROOT / "content-banks/matematika/math-print.json"
NATIJA_DB = Path(r"D:\Matematika Test Print\NatijaDB.db")
PDF_DIR = ROOT / "tmp/pdfs/math-source"
IMAGES_DIR = ROOT / "public/math-print"
V3_DIR = ROOT / "content-banks/matematika/v3"

SOURCES_SPEC = [
    {"category": "algebra", "table": "KalitAl", "filename": "Algebra1_30.pdf", "first_variant": 1, "count": 30},
    {"category": "algebra", "table": "KalitAl", "filename": "Algebra31_60.pdf", "first_variant": 31, "count": 30},
    {"category": "algebra", "table": "KalitAl", "filename": "Algebra61_90.pdf", "first_variant": 61, "count": 30},
    {"category": "algebra", "table": "KalitAl", "filename": "Algebra91_121.pdf", "first_variant": 91, "count": 31},
    {"category": "geometriya", "table": "KalitGeo", "filename": "Geometriya_variant.pdf", "first_variant": 1, "count": 40},
    {"category": "algebra-trigonometriya", "table": "KalitAlTrigon", "filename": "Algebra___Trigonometriyagacha.pdf", "first_variant": 1, "count": 40},
    {"category": "algebra-geometriya", "table": "KalitAlGeo", "filename": "Algebra_va_Geometriya1_30.pdf", "first_variant": 1, "count": 30},
    {"category": "algebra-geometriya", "table": "KalitAlGeo", "filename": "Algebra_va_Geometriya31_60.pdf", "first_variant": 31, "count": 30},
    {"category": "algebra-geometriya", "table": "KalitAlGeo", "filename": "Algebra_va_Geometriya61_90.pdf", "first_variant": 61, "count": 30},
    {"category": "algebra-geometriya", "table": "KalitAlGeo", "filename": "Algebra_va_Geometriya91_120.pdf", "first_variant": 91, "count": 30},
    {"category": "algebra-geometriya", "table": "KalitAlGeo", "filename": "Algebra_va_Geometriya121_150.pdf", "first_variant": 121, "count": 30},
    {"category": "algebra-geometriya", "table": "KalitAlGeo", "filename": "Algebra_va_Geometriya151_164.pdf", "first_variant": 151, "count": 14},
    {"category": "kombinatorika", "table": "KalitKombi", "filename": "Kombinatorika.pdf", "first_variant": 1, "count": 3},
]

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def main():
    V3_DIR.mkdir(parents=True, exist_ok=True)

    print("1. Canonical math-print.json tekshirilmoqda...")
    if not CANONICAL_JSON.exists():
        print(f"XATO: {CANONICAL_JSON} topilmadi!")
        sys.exit(1)
    
    canonical_hash = sha256_file(CANONICAL_JSON)
    with open(CANONICAL_JSON, "r", encoding="utf-8") as f:
        canonical_data = json.load(f)

    topics = canonical_data.get("topics", [])
    items = canonical_data.get("items", [])
    print(f"   Canonical Topics: {len(topics)}, Items: {len(items)}, SHA-256: {canonical_hash}")

    print("2. NatijaDB.db tekshirilmoqda...")
    if not NATIJA_DB.exists():
        print(f"XATO: {NATIJA_DB} topilmadi!")
        sys.exit(1)
    
    natija_hash = sha256_file(NATIJA_DB)
    print(f"   NatijaDB SHA-256: {natija_hash}")

    conn = sqlite3.connect(NATIJA_DB)
    answer_keys: dict[str, list[str]] = {}
    answer_re = re.compile(r"(\d{1,2})\.([ABCD])\b")
    
    for spec in SOURCES_SPEC:
        cat = spec["category"]
        tbl = spec["table"]
        rows = conn.execute(f'SELECT "Id", "Kalit" FROM "{tbl}" ORDER BY "Id"').fetchall()
        for variant_id, raw in rows:
            key = f"{cat}-{variant_id}"
            if key in answer_keys:
                continue
            found = answer_re.findall(raw or "")
            answers = [f"A{'ABCD'.index(l) + 1}" for _, l in found]
            if len(answers) == 30:
                answer_keys[key] = answers

    conn.close()
    print(f"   Answer keys yuklandi: {len(answer_keys)} ta variant")

    h_keys = hashlib.sha256()
    for k in sorted(answer_keys.keys()):
        h_keys.update(f"{k}:{','.join(answer_keys[k])};".encode("utf-8"))
    answer_keys_hash = h_keys.hexdigest()
    print(f"   Answer keys hash: {answer_keys_hash}")

    print("3. Public math-print WebP diagrammalari tahlil qilinmoqda...")
    images_manifest = {}
    if IMAGES_DIR.exists():
        for p in sorted(IMAGES_DIR.glob("*.webp")):
            images_manifest[p.name] = sha256_file(p)
    print(f"   Diagrammalar soni: {len(images_manifest)}")

    print("4. Manba PDF fayllari tekshirilmoqda...")
    import pymupdf
    sources_manifest = []
    for spec in SOURCES_SPEC:
        pdf_path = PDF_DIR / spec["filename"]
        if not pdf_path.exists():
            print(f"OGOHLANTIRISH: PDF topilmadi: {pdf_path}")
            continue
        doc = pymupdf.open(pdf_path)
        sources_manifest.append({
            "category": spec["category"],
            "filename": spec["filename"],
            "table": spec["table"],
            "first_variant": spec["first_variant"],
            "count": spec["count"],
            "page_count": len(doc),
            "sha256": sha256_file(pdf_path),
            "size_bytes": pdf_path.stat().st_size,
        })
        doc.close()
    print(f"   Manba PDF fayllar: {len(sources_manifest)} ta")

    manifest = {
        "version": "v3.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "canonical_json": {
            "path": str(CANONICAL_JSON.relative_to(ROOT)),
            "sha256": canonical_hash,
            "topics_count": len(topics),
            "items_count": len(items),
        },
        "natija_db": {
            "path": str(NATIJA_DB),
            "sha256": natija_hash,
            "answer_keys_count": len(answer_keys),
            "answer_keys_hash": answer_keys_hash,
        },
        "baseline_images": {
            "count": len(images_manifest),
            "files": images_manifest,
        },
        "sources": sources_manifest,
        "external_ids": [item["externalId"] for item in items],
    }

    manifest_path = V3_DIR / "source-manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"✅ Baseline manifest saqlandi: {manifest_path}")

    errata_path = V3_DIR / "source-errata.json"
    if not errata_path.exists():
        errata = {
            "description": "Source-confirmed printer errata for Matematika Test Print PDFs",
            "errata": [
                {
                    "pdf": "Algebra91_121.pdf",
                    "page": 11,
                    "variant": 6,
                    "question": 3,
                    "raw_text": "0,8. 0,1. 0,2. 0,4.",
                    "resolved_options": {
                        "A1": "0,8.",
                        "A2": "0,1.",
                        "A3": "0,2.",
                        "A4": "0,4."
                    },
                    "reason": "Source print omitted option letters A), B), C), D); answers positioned as 4 distinct coordinates",
                    "status": "confirmed"
                },
                {
                    "pdf": "Algebra91_121.pdf",
                    "page": 11,
                    "variant": 96,
                    "question": 3,
                    "raw_text": "0,8. 0,1. 0,2. 0,4.",
                    "resolved_options": {
                        "A1": "0,8.",
                        "A2": "0,1.",
                        "A3": "0,2.",
                        "A4": "0,4."
                    },
                    "reason": "Source print omitted option letters A), B), C), D); answers positioned as 4 distinct coordinates",
                    "status": "confirmed"
                }
            ]
        }
        with open(errata_path, "w", encoding="utf-8") as f:
            json.dump(errata, f, indent=2, ensure_ascii=False)
        print(f"✅ Errata fayli yaratildi: {errata_path}")

if __name__ == "__main__":
    main()
