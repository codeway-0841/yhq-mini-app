"""Extract and normalize the bundled Matematika Test Print question bank.

The official answer keys are read only from NatijaDB.db. Source PDFs are
extracted from the application's managed resources and never modified.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sqlite3
import subprocess
import tempfile
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import pymupdf
from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DEFAULT = Path(r"D:\Matematika Test Print")
QUESTION_MARKER = re.compile(r"^(\d{1,2})\.")
STRICT_OPTION_MARKER = re.compile(r"(?<!\w)([ABCD])\s*\)\s*")
BARE_OPTION_MARKER = re.compile(
    r"(?<!\w)([ABCD])(?=\s+(?:[-+−√\d(\[{]|sin\b|cos\b|tg\b|ctg\b|lb\b))\s*"
)
FALLBACK_FIRST_OPTION = re.compile(r"(?<!\d)4\)\s*")
LINE_START_OPTION_MARKER = re.compile(r"(?m)^([ABCD])\s*\)\s*")
ANSWER_RE = re.compile(r"(\d{1,2})\.([ABCD])\b")


@dataclass(frozen=True)
class SourceSpec:
    category: str
    category_name: str
    table: str
    filename: str
    first_variant: int
    count: int


SOURCES = (
    SourceSpec("algebra", "Algebra", "KalitAl", "Algebra1_30.pdf", 1, 30),
    SourceSpec("algebra", "Algebra", "KalitAl", "Algebra31_60.pdf", 31, 30),
    SourceSpec("algebra", "Algebra", "KalitAl", "Algebra61_90.pdf", 61, 30),
    SourceSpec("algebra", "Algebra", "KalitAl", "Algebra91_121.pdf", 91, 31),
    SourceSpec("geometriya", "Geometriya", "KalitGeo", "Geometriya_variant.pdf", 1, 40),
    SourceSpec("algebra-trigonometriya", "Algebra va Trigonometriya", "KalitAlTrigon", "Algebra___Trigonometriyagacha.pdf", 1, 40),
    SourceSpec("algebra-geometriya", "Algebra va Geometriya", "KalitAlGeo", "Algebra_va_Geometriya1_30.pdf", 1, 30),
    SourceSpec("algebra-geometriya", "Algebra va Geometriya", "KalitAlGeo", "Algebra_va_Geometriya31_60.pdf", 31, 30),
    SourceSpec("algebra-geometriya", "Algebra va Geometriya", "KalitAlGeo", "Algebra_va_Geometriya61_90.pdf", 61, 30),
    SourceSpec("algebra-geometriya", "Algebra va Geometriya", "KalitAlGeo", "Algebra_va_Geometriya91_120.pdf", 91, 30),
    SourceSpec("algebra-geometriya", "Algebra va Geometriya", "KalitAlGeo", "Algebra_va_Geometriya121_150.pdf", 121, 30),
    SourceSpec("algebra-geometriya", "Algebra va Geometriya", "KalitAlGeo", "Algebra_va_Geometriya151_164.pdf", 151, 14),
    SourceSpec("kombinatorika", "Kombinatorika", "KalitKombi", "Kombinatorika.pdf", 1, 3),
)

CATEGORY_EXPECTED = {
    "algebra": 121,
    "geometriya": 40,
    "algebra-trigonometriya": 40,
    "algebra-geometriya": 164,
    "kombinatorika": 3,
}

GREEK = {
    "α": r"\alpha", "β": r"\beta", "γ": r"\gamma", "δ": r"\delta",
    "λ": r"\lambda", "μ": r"\mu", "π": r"\pi", "ρ": r"\rho",
    "φ": r"\varphi", "ω": r"\omega", "θ": r"\theta",
}
SYMBOLS = {
    "·": r"\cdot ", "×": r"\times ", "≤": r"\le ", "≥": r"\ge ",
    "≠": r"\ne ", "≈": r"\approx ", "∞": r"\infty ", "∈": r"\in ",
    "∅": r"\varnothing ",
    "∉": r"\notin ", "∪": r"\cup ", "∩": r"\cap ", "⊂": r"\subset ",
    "∥": r"\parallel ", "⊥": r"\perp ", "→": r"\to ", "∠": r"\angle ",
}


def extract_embedded_pdfs(source_dir: Path, target: Path) -> None:
    exe = source_dir / "Matematika Test Print.exe"
    script = ROOT / "scripts" / "extract-dotnet-pdf-resources.ps1"
    if not exe.exists():
        raise FileNotFoundError(exe)
    subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script),
         "-SourceExe", str(exe), "-OutputDir", str(target)],
        check=True,
    )


def load_answer_keys(db_path: Path) -> dict[tuple[str, int], list[str]]:
    connection = sqlite3.connect(db_path)
    keys: dict[tuple[str, int], list[str]] = {}
    try:
        for category, expected in CATEGORY_EXPECTED.items():
            table = next(spec.table for spec in SOURCES if spec.category == category)
            rows = connection.execute(f'SELECT "Id", "Kalit" FROM "{table}" ORDER BY "Id"').fetchall()
            if [row[0] for row in rows] != list(range(1, expected + 1)):
                raise ValueError(f"{table}: variant IDs are not contiguous 1..{expected}")
            for variant, raw in rows:
                found = ANSWER_RE.findall(raw or "")
                if [int(number) for number, _ in found] != list(range(1, 31)):
                    raise ValueError(f"{table} variant {variant}: expected ordered answers 1..30")
                keys[(category, int(variant))] = [f"A{'ABCD'.index(letter) + 1}" for _, letter in found]
    finally:
        connection.close()
    if len(keys) != 368:
        raise ValueError(f"answer key count {len(keys)} != 368")
    return keys


def question_regions(doc: pymupdf.Document, variant_count: int) -> list[list[tuple[int, pymupdf.Rect]]]:
    records: list[list[tuple[int, pymupdf.Rect]]] = []
    active: list[tuple[int, pymupdf.Rect]] | None = None
    for page_index in range(variant_count * 2):
        page = doc[page_index]
        words = page.get_text("words")
        for column, (x0, x1) in enumerate(((28.0, 295.0), (302.0, 581.0))):
            marks: list[tuple[int, float]] = []
            for word in words:
                match = QUESTION_MARKER.match(word[4])
                in_gutter = (column == 0 and 29 < word[0] < 45) or (column == 1 and 300 < word[0] < 320)
                if match and in_gutter and 1 <= int(match.group(1)) <= 30:
                    marks.append((int(match.group(1)), float(word[1])))
            marks.sort(key=lambda item: item[1])
            top = marks[0][1] - 3 if page_index % 2 == 0 and column == 0 else 29.0
            if active and marks and marks[0][0] != 1 and marks[0][1] - 3 > top + 3:
                active.append((page_index, pymupdf.Rect(x0, top, x1, marks[0][1] - 3)))
            for marker_index, (number, y) in enumerate(marks):
                expected = len(records) % 30 + 1
                if number != expected:
                    raise ValueError(f"page {page_index + 1}: question {number}, expected {expected}")
                bottom = marks[marker_index + 1][1] - 3 if marker_index + 1 < len(marks) else 795.0
                active = [(page_index, pymupdf.Rect(x0, y - 3, x1, bottom))]
                records.append(active)
            if active and not marks:
                active.append((page_index, pymupdf.Rect(x0, top, x1, 795.0)))
    if len(records) != variant_count * 30:
        raise ValueError(f"question count {len(records)} != {variant_count * 30}")
    return records


def raw_question_text(doc: pymupdf.Document, regions: list[tuple[int, pymupdf.Rect]]) -> str:
    return "\n".join(doc[page].get_text(clip=rect) for page, rect in regions)


def option_markers(text: str) -> list[re.Match[str]]:
    line_start = list(LINE_START_OPTION_MARKER.finditer(text))
    if len(line_start) == 4 and [m.group(1) for m in line_start] == ["A", "B", "C", "D"]:
        return line_start
    markers = list(STRICT_OPTION_MARKER.finditer(text))
    if len(markers) >= 4:
        return markers[-4:]
    by_position = {match.start(): match for match in markers}
    by_position.update({match.start(): match for match in BARE_OPTION_MARKER.finditer(text)})
    markers = sorted(by_position.values(), key=lambda match: match.start())
    if len(markers) < 4:
        first = FALLBACK_FIRST_OPTION.search(text)
        if first and (not markers or first.start() < markers[0].start()):
            markers.insert(0, first)  # type: ignore[arg-type]
    return markers[-4:] if len(markers) >= 4 else markers


def split_question(text: str) -> tuple[str, list[str]] | None:
    markers = option_markers(text)
    if len(markers) != 4:
        return None
    question = text[:markers[0].start()]
    options = [
        text[markers[index].end():markers[index + 1].start() if index < 3 else len(text)]
        for index in range(4)
    ]
    if any(not re.search(r"\w|[√π∞∅]", option) for option in options):
        return None
    return question, options


def fingerprint(text: str) -> str:
    text = QUESTION_MARKER.sub("", text.strip(), count=1)
    text = unicodedata.normalize("NFKC", text).casefold()
    return re.sub(r"[^0-9a-zа-яёўқғҳπ√αβγλ]+", "", text)


def normalize_root(text: str) -> str:
    text = re.sub(r"√\s*([A-Za-z0-9]+(?:\s*[+−-]\s*[A-Za-z0-9]+)?)", r"\\sqrt{\1}", text)
    return text.replace("√", r"\sqrt{}")


def normalize_math(text: str, *, strip_number: bool = False) -> str:
    text = unicodedata.normalize("NFKC", html.unescape(text))
    text = text.replace("ﬁ", "fi").replace("ﬀ", "ff").replace("−", "-")
    text = re.sub(r"[\u20d6\u20d7⃗¯]\s*([A-Za-z])", r"\\vec{\1}", text)
    text = re.sub(r"([A-Za-z])\s*[\u20d6\u20d7⃗]", r"\\vec{\1}", text)
    for source, replacement in SYMBOLS.items():
        text = text.replace(source, replacement)
    for source, replacement in GREEK.items():
        text = text.replace(source, replacement)
    text = normalize_root(text)
    text = re.sub(r"(\d+)\s*[◦°]", r"\1^{\\circ}", text)
    text = re.sub(r"\b(sin|cos)\s*([2346])\b", r"\\\1^{\2}", text)
    text = re.sub(r"\b(ctg|tg)\b", r"\\operatorname{\1}", text)
    text = re.sub(r"\bar\s*([A-Za-z])", r"\\vec{\1}", text)
    text = re.sub(r"\b([A-Za-z])([3-9])\b", r"\1^{\2}", text)
    text = re.sub(r"\b([A-Za-z])([12])\b", r"\1_{\2}", text)
    text = re.sub(r"\blog\s*([0-9]+)\b", r"\\log_{\1}", text)
    text = re.sub(r"\b(arcctg|arctg)\b", r"\\operatorname{\1}", text)
    text = text.translate({code: " " for code in range(32) if code not in (9, 10, 13)})
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s*\n\s*", " ", text)
    text = re.sub(r"\s+([,.;:?!])", r"\1", text)
    text = re.sub(r"([([{])\s+", r"\1", text)
    text = re.sub(r"\s+([)\]}])", r"\1", text)
    text = text.strip()
    if strip_number:
        text = QUESTION_MARKER.sub("", text, count=1).strip()
    return text


def diagram_rects(page: pymupdf.Page, question_rect: pymupdf.Rect) -> list[pymupdf.Rect]:
    drawings = []
    anchors = []
    for drawing in page.get_drawings():
        rect = drawing["rect"] & question_rect
        if rect.is_empty or rect.y0 < 27 or (rect.width > 250 and rect.height > 700):
            continue
        drawings.append(rect)
        if min(rect.width, rect.height) > 15:
            anchors.append(rect)
    if not anchors:
        return []
    union = anchors[0]
    for rect in anchors[1:]:
        union |= rect
    for _ in range(3):
        grown = pymupdf.Rect(union.x0 - 14, union.y0 - 14, union.x1 + 14, union.y1 + 14)
        for rect in drawings:
            if grown.intersects(rect):
                union |= rect
    return [union & question_rect]


def render_diagram(doc: pymupdf.Document, regions: list[tuple[int, pymupdf.Rect]], output: Path) -> bool:
    clips: list[tuple[int, pymupdf.Rect]] = []
    for page_index, question_rect in regions:
        for rect in diagram_rects(doc[page_index], question_rect):
            clips.append((page_index, pymupdf.Rect(rect.x0 - 14, rect.y0 - 14, rect.x1 + 14, rect.y1 + 14) & question_rect))
    if not clips:
        return False
    pieces: list[Image.Image] = []
    for page_index, clip in clips:
        pixmap = doc[page_index].get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=clip, alpha=False, annots=False)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        bounds = ImageChops.difference(image, Image.new("RGB", image.size, "white")).getbbox()
        if bounds:
            pieces.append(image.crop((max(0, bounds[0] - 8), max(0, bounds[1] - 8),
                                      min(image.width, bounds[2] + 8), min(image.height, bounds[3] + 8))))
    if not pieces:
        return False
    canvas = Image.new("RGB", (max(piece.width for piece in pieces) + 16,
                               sum(piece.height for piece in pieces) + 16 + 12 * (len(pieces) - 1)), "white")
    y = 8
    for piece in pieces:
        canvas.paste(piece, (8, y))
        y += piece.height + 12
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, "WEBP", lossless=True, method=6)
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=SOURCE_DEFAULT)
    parser.add_argument("--pdf-dir", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "content-banks/matematika/math-print.json")
    parser.add_argument("--images", type=Path, default=ROOT / "public/math-print")
    parser.add_argument("--audit", type=Path, default=ROOT / "content-banks/matematika/math-print.audit.json")
    parser.add_argument("--reuse-images", action="store_true")
    args = parser.parse_args()

    keys = load_answer_keys(args.source / "NatijaDB.db")
    temp: tempfile.TemporaryDirectory[str] | None = None
    if args.pdf_dir:
        pdf_dir = args.pdf_dir
    else:
        temp = tempfile.TemporaryDirectory(prefix="math-print-")
        pdf_dir = Path(temp.name)
        extract_embedded_pdfs(args.source, pdf_dir)

    raw_records: list[dict] = []
    image_count = 0
    category_counts: dict[str, int] = defaultdict(int)
    try:
        for spec in SOURCES:
            doc = pymupdf.open(pdf_dir / spec.filename)
            regions = question_regions(doc, spec.count)
            for offset, question_regions_for_item in enumerate(regions):
                variant = spec.first_variant + offset // 30
                question_number = offset % 30 + 1
                topic_external_id = f"mtp-{spec.category}-{variant:03d}"
                external_id = f"{topic_external_id}-{question_number:02d}"
                raw = raw_question_text(doc, question_regions_for_item)
                split = split_question(raw)
                question_raw = split[0] if split else raw[:option_markers(raw)[0].start()] if option_markers(raw) else raw
                image_path = args.images / f"{external_id}.webp"
                has_image = image_path.exists() if args.reuse_images else render_diagram(doc, question_regions_for_item, image_path)
                image_count += int(has_image)
                raw_records.append({
                    "externalId": external_id,
                    "topicExternalId": topic_external_id,
                    "category": spec.category,
                    "categoryName": spec.category_name,
                    "variant": variant,
                    "questionNumber": question_number,
                    "questionRaw": question_raw,
                    "optionsRaw": split[1] if split else None,
                    "correctAnswer": keys[(spec.category, variant)][question_number - 1],
                    "source": f"{spec.filename}#variant={variant}&question={question_number}",
                    "image": f"/math-print/{external_id}.webp" if has_image else None,
                })
            category_counts[spec.category] += spec.count

        donors: dict[str, list[str]] = {}
        for record in raw_records:
            if record["optionsRaw"]:
                donors.setdefault(fingerprint(record["questionRaw"]), record["optionsRaw"])
        unresolved = []
        for record in raw_records:
            if record["optionsRaw"] is None:
                donor = donors.get(fingerprint(record["questionRaw"]))
                if donor:
                    record["optionsRaw"] = donor
                else:
                    unresolved.append(record["externalId"])
        if unresolved:
            raise ValueError(f"unresolved four-option splits ({len(unresolved)}): {unresolved[:20]}")

        topics = []
        seen_topics = set()
        items = []
        for record in raw_records:
            topic_id = record["topicExternalId"]
            if topic_id not in seen_topics:
                seen_topics.add(topic_id)
                title = f"{record['categoryName']} — {record['variant']}-variant"
                topics.append({"externalId": topic_id, "nameUz": title, "nameRu": title})
            question = normalize_math(record["questionRaw"], strip_number=True)
            options = [normalize_math(value) for value in record["optionsRaw"]]
            if not question or any(not value for value in options):
                raise ValueError(f"empty normalized text in {record['externalId']}")
            option_map = {f"A{index + 1}": value for index, value in enumerate(options)}
            items.append({
                "externalId": record["externalId"], "topicExternalId": topic_id,
                "questionUz": question, "questionRu": question,
                "optionsUz": option_map, "optionsRu": dict(option_map),
                "correctAnswer": record["correctAnswer"], "source": record["source"],
                "image": record["image"],
            })

        if len(topics) != 368 or len(items) != 11040 or image_count != 301:
            raise ValueError(f"final counts topics={len(topics)}, items={len(items)}, images={image_count}")
        bank = {
            "version": 1, "subjectId": "matematika", "bankId": "math_db",
            "bankName": "Matematika Test Print", "topics": topics, "items": items,
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        source_hash = hashlib.sha256((args.source / "NatijaDB.db").read_bytes()).hexdigest()
        audit = {
            "status": "EXTRACTED_PENDING_KATEX_AUDIT",
            "source": str(args.source), "answerKeySha256": source_hash,
            "totalTopics": len(topics), "totalQuestions": len(items),
            "totalTexts": len(items) * 10, "imageAssetsTotal": image_count,
            "categoryVariants": dict(category_counts),
        }
        args.audit.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Extracted {len(items)} questions, {len(topics)} variants and {image_count} diagrams")
    finally:
        if temp:
            temp.cleanup()


if __name__ == "__main__":
    main()
