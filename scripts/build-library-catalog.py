"""Kutubxona katalogini tayyorlash (bir marta / kontent yangilanganda ishga tushiriladi).

Manba (lokal, repo'ga KIRMAYDI):
    content-banks/testmakon/kutubxona/catalog.json  (+ <sinf>/*.pdf, *-cover.webp)

Chiqish (repo'ga kiradi):
    src/content/library.json          — tozalangan katalog (tashqi URL'siz)
    public/kutubxona/covers/<sinf>/*  — 520px optimallashtirilgan webp muqovalar

Nima qilinadi:
  1. Tashqi havolalar (testmakon.uz) BUTUNLAY olib tashlanadi — ilova ularga bog'lanmaydi.
  2. Dublikat nashrlar chiqarib tashlanadi (bir xil PDF ikki xil slug bilan kelgan).
  3. Sarlavhalar HTML entity'lardan tozalanadi, sinf prefiksi alohida `name`ga ajratiladi.
  4. Fan nomlari kanonik id'larga o'giriladi (UI'da tarjima + ikonka shu id orqali).
  5. Muqovalar 520px webp'ga siqiladi — 3.1GB PDF'lardan tashqari umumiy hajm ~14MB → ~4MB.

Ishlatish:
    python scripts/build-library-catalog.py

Talab: Python 3 + Pillow (PIL).
"""

import html
import json
import os
import re
import shutil
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC_DIR = os.path.join(ROOT, "content-banks", "testmakon", "kutubxona")
CATALOG_PATH = os.path.join(SRC_DIR, "catalog.json")
OUT_JSON = os.path.join(ROOT, "src", "content", "library.json")
OUT_COVERS = os.path.join(ROOT, "public", "kutubxona", "covers")

COVER_MAX_W = 520
COVER_QUALITY = 82

# ── 1. Dublikat nashrlar ─────────────────────────────────────────────────────
# Bir xil PDF (bayt-baytga teng) ikki xil slug bilan kelgan yoki PDF'i umuman
# yo'q eski nashr. Kanonik variant ({sinf}-sinf-...) saqlanadi.
EXCLUDED_SLUGS = {
    "ona-tili-4-sinf",                         # dup: 4-sinf-ona-tili
    "biologiya-5-sinf",                        # dup: 5-sinf-biologiya
    "biologiya-7-sinf",                        # dup: 7-sinf-zoologiya (PDF bir xil)
    "biologiya-odam-va-uning-salomatligi",     # dup: 8-sinf-odam-va-uning-salomatligi
    "ozbekiston-tarixi-8-sinf",                # dup: 8-sinf-ozbekiston-tarixi (PDF bir xil)
    "ozbekiston-tarixi-9-sinf",                # dup: 9-sinf-ozbekiston-tarixi (PDF bir xil)
    "ozbekiston-tarixi-10-sinf",               # dup: 10-sinf-ozbekiston-tarixi (PDF bir xil)
    "ona-tili-11-sinf",                        # dup: 11-sinf-ona-tili-1/2-qism
}

# Nomlash tartibi boshqalardan farq qiladigan yagona nashr — kanonik shaklga keltiramiz.
TITLE_OVERRIDES = {
    "adabiyot-11-sinf-2-qism": "11-sinf Adabiyot 2-qism",
}

# ── 2. Fanlar (kanonik id + tarjima) ─────────────────────────────────────────
# Diqqat: bu faqat MA'LUMOT. Ikonkalar src/features/library/subject-icons.ts'da
# (content/ kod import qilmaydi — AGENTS 1a qoidasi).
SUBJECTS: list[tuple[str, str, str]] = [
    ("ona-tili", "Ona tili", "Родной язык"),
    ("adabiyot", "Adabiyot", "Литература"),
    ("matematika", "Matematika", "Математика"),
    ("english", "Ingliz tili", "Английский язык"),
    ("rus-tili", "Rus tili", "Русский язык"),
    ("nemis-tili", "Nemis tili", "Немецкий язык"),
    ("fransuz-tili", "Fransuz tili", "Французский язык"),
    ("tarix", "Tarix", "История"),
    ("biologiya", "Biologiya", "Биология"),
    ("fizika", "Fizika", "Физика"),
    ("kimyo", "Kimyo", "Химия"),
    ("geografiya", "Geografiya", "География"),
    ("informatika", "Informatika", "Информатика"),
    ("texnologiya", "Texnologiya", "Технология"),
    ("jismoniy-tarbiya", "Jismoniy tarbiya", "Физическая культура"),
    ("musiqa", "Musiqa", "Музыка"),
    ("tasviriy-sanat", "Tasviriy san'at", "Изобразительное искусство"),
    ("tabiatshunoslik", "Tabiatshunoslik", "Естествознание"),
    ("odobnoma", "Odobnoma", "Этика"),
    ("huquq", "Huquq", "Право"),
    ("tarbiya", "Tarbiya", "Воспитание"),
    ("milliy-goya", "Milliy g'oya", "Национальная идея"),
    ("iqtisodiyot", "Iqtisodiyot", "Экономика"),
    ("vatan-tuygusi", "Vatan tuyg'usi", "Чувство Родины"),
    ("chizmachilik", "Chizmachilik", "Черчение"),
    ("chaqiruv-tayyorgarlik", "Chaqiruv tayyorgarligi", "Допризывная подготовка"),
    ("manaviyat", "Ma'naviyat", "Основы духовности"),
]

# Katalogdagi xom fan satri → kanonik id
SUBJECT_MAP = {
    "📚 Ona tili": "ona-tili",
    "📚 Adabiyot": "adabiyot",
    "📚 Matematika": "matematika",
    "📚 English": "english",
    "🇷🇺 Rus tili": "rus-tili",
    "🇩🇪 Nemis tili": "nemis-tili",
    "🇫🇷 Fransuz tili": "fransuz-tili",
    "📜 Tarix": "tarix",
    "🧬 Biologiya": "biologiya",
    "⚛️ Fizika": "fizika",
    "⚗️ Kimyo": "kimyo",
    "📚 Geografiya": "geografiya",
    "💻 Informatika": "informatika",
    "🛠️ Texnologiya": "texnologiya",
    "🏃 Jismoniy tarbiya": "jismoniy-tarbiya",
    "🎵 Musiqa": "musiqa",
    "🎨 Tasviriy san'at": "tasviriy-sanat",
    "🌍 Tabiatshunoslik": "tabiatshunoslik",
    "🤝 Odobnoma": "odobnoma",
    "⚖️ Huquq": "huquq",
    "🌱 Tarbiya": "tarbiya",
    "🇺🇿 Milliy g'oya": "milliy-goya",
    "💰 Iqtisodiy bilim asoslari": "iqtisodiyot",
    "🇺🇿 Vatan tuyg'usi": "vatan-tuygusi",
    "📐 Chizmachilik": "chizmachilik",
    "🎖️ Chaqiruvga qadar tayyorgarlik": "chaqiruv-tayyorgarlik",
    "📖 Ma'naviyat asoslari": "manaviyat",
}

GRADE_PREFIX_RE = re.compile(r"^\d+-sinf\s+")


def parse_pages(raw: str) -> int | None:
    m = re.search(r"\d+", raw or "")
    return int(m.group()) if m else None


def main() -> None:
    if not os.path.isfile(CATALOG_PATH):
        raise SystemExit(f"Katalog topilmadi: {CATALOG_PATH}")

    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        raw_books = json.load(f)

    subjects_used: dict[str, tuple[str, str, str]] = {}
    books = []
    skipped = []
    missing_pdf = []

    for raw in raw_books:
        slug = raw["slug"]
        if slug in EXCLUDED_SLUGS:
            skipped.append(slug)
            continue

        title = html.unescape(TITLE_OVERRIDES.get(slug, raw["title"]))
        title = re.sub(r"\s+", " ", title).strip()
        grade = int(raw["grade_name"].split("-")[0])

        subject_raw = html.unescape(raw["subject"])
        subject_id = SUBJECT_MAP.get(subject_raw)
        if not subject_id:
            raise SystemExit(f"Fan moslanmadi: {subject_raw!r} ({slug})")

        subject_meta = next((s for s in SUBJECTS if s[0] == subject_id), None)
        if not subject_meta:
            raise SystemExit(f"Fan jadvalda yo'q: {subject_id} ({slug})")
        subjects_used[subject_id] = subject_meta

        cover_local = raw.get("cover_local")
        if not cover_local:
            raise SystemExit(f"Muqova fayli yo'q: {slug}")

        if not raw.get("pdf_downloaded"):
            missing_pdf.append(slug)

        books.append({
            "slug": slug,
            "grade": grade,
            "title": title,
            "name": GRADE_PREFIX_RE.sub("", title).strip(),
            "subject": subject_id,
            "pages": parse_pages(raw.get("pages", "")),
            "file": raw.get("pdf_local") or f"{raw['grade_name']}/{slug}.pdf",
            "cover": cover_local,
        })

    if missing_pdf:
        raise SystemExit(f"PDF'i yo'q nashrlar qoldi (dublikat ro'yxatini tekshiring): {missing_pdf}")

    books.sort(key=lambda b: (b["grade"], b["name"].lower()))

    # Kanonik tartibda faqat ishlatilgan fanlar
    subjects = [
        {"id": sid, "uz": uz, "ru": ru}
        for sid, uz, ru in SUBJECTS
        if sid in subjects_used
    ]

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump({"books": books, "subjects": subjects}, f, ensure_ascii=False, indent=1)
        f.write("\n")

    # ── Muqovalar: 520px webp ────────────────────────────────────────────────
    if os.path.isdir(OUT_COVERS):
        shutil.rmtree(OUT_COVERS)

    total_before = total_after = 0
    for book in books:
        src = os.path.join(SRC_DIR, book["cover"].replace("/", os.sep))
        dst = os.path.join(OUT_COVERS, book["cover"].replace("/", os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)

        im = Image.open(src).convert("RGB")
        if im.width > COVER_MAX_W:
            height = round(im.height * COVER_MAX_W / im.width)
            im = im.resize((COVER_MAX_W, height), Image.LANCZOS)
        im.save(dst, "WEBP", quality=COVER_QUALITY, method=6)

        total_before += os.path.getsize(src)
        total_after += os.path.getsize(dst)

    grades = sorted({b["grade"] for b in books})
    print(f"Kitoblar: {len(books)} ta (o'tkazib yuborildi: {len(skipped)} ta dublikat)")
    print(f"Sinflar: {grades[0]}-{grades[-1]} | Fanlar: {len(subjects)}")
    print(f"Muqovalar: {len(books)} ta, {total_before / 1e6:.1f}MB -> {total_after / 1e6:.1f}MB")
    print(f"Yozildi: {OUT_JSON}")
    print(f"Yozildi: {OUT_COVERS}")


if __name__ == "__main__":
    main()
