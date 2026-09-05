"""Extract original question artwork and answer keys; never OCR mathematics.

Usage: python scripts/extract-physics-print.py SOURCE_DIRECTORY [--render]
Requires PyMuPDF, Pillow, pypdf. Source PDFs remain untouched.
"""
import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path

import pymupdf
from PIL import Image, ImageChops
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ("kin", 13), ("din", 17), ("stat", 18), ("mol", 23),
    ("elek", 12), ("uzgar", 14), ("turli", 12), ("teb", 13),
    ("opt", 11), ("qol", 15), ("umumiy1", 74), ("umumiy2", 74),
]
MARKER = re.compile(r"^(\d{1,2})\.")


def normalize(text):
    return unicodedata.normalize("NFKC", text).replace("‘", "'").replace("’", "'")


def answer_keys(path, count):
    """pypdf preserves each table row's content order (including blank cell 0)."""
    pages = PdfReader(path).pages
    text = "\n".join(p.extract_text() for p in pages[count * 2:])
    headers = list(re.finditer(r"(?m)^([^\n]+?)-(\d+)\s*$", text))
    keys = {}
    for i, match in enumerate(headers):
        body = text[match.end():headers[i + 1].start() if i + 1 < len(headers) else len(text)]
        # Two print formats are used by the program: numbered keys and a
        # 0/1/2/3 grid. In both cases every answer is the letter immediately
        # following a printed number and period. A few originals contain a
        # typo such as ``3.A`` where ``23.A`` was intended; preserving the
        # answer stream is safer than guessing the printed number.
        answers = re.findall(r"(?:^|\s)\d{1,2}\s*[.]\s*([ABCD1])\b", body)
        if '1' in answers:
            # One scanned/printed key contains ``2.1``. The corresponding
            # source question has answer B; keep an explicit audit marker.
            audit_marker = True
            answers = ['B' if a == '1' else a for a in answers]
        else:
            audit_marker = False
        if len(answers) != 30:
            # Grid extraction can have line breaks between the row number and
            # letters, so consume the four row blocks as a fallback.
            answers = []
            for row, row_body in re.findall(r"(?m)^\s*([0-3])\s*(.*)$", body):
                letters = re.findall(r"[ABCD]", row_body)
                expected = {"0": 9, "1": 10, "2": 10, "3": 1}[row]
                if len(letters) == expected:
                    answers.extend(letters)
        if len(answers) != 30:
            raise ValueError(f"{path.name}: invalid key {match.group(0)}: {len(answers)} answers")
        number = int(match.group(2))
        if number in keys:
            raise ValueError(f"{path.name}: invalid/duplicate key {number}: {len(answers)}")
        keys[number] = {"title": normalize(match.group(0).strip()), "answers": answers, "printedTypo": audit_marker}
    if len(keys) != count:
        raise ValueError(f"{path.name}: {len(keys)} keys, expected {count}")
    return keys


def question_regions(doc, count):
    """Read left column then right, carrying continuations across columns/pages."""
    result = []
    active = None
    for pi in range(count * 2):
        page = doc[pi]
        words = page.get_text("words")
        for column, (x0, x1) in enumerate([(28, 295), (302, 581)]):
            marks = []
            for word in words:
                match = MARKER.match(word[4])
                if match and ((column == 0 and 29 < word[0] < 40) or
                              (column == 1 and 303 < word[0] < 314)):
                    number = int(match.group(1))
                    if 1 <= number <= 30:
                        marks.append((number, word[1]))
            marks.sort(key=lambda item: item[1])
            # Each variant occupies exactly two pages. The left column on its
            # first page starts with the title; it never continues an old item.
            top = 29.0
            if pi % 2 == 0 and column == 0:
                if not marks or marks[0][0] != 1:
                    raise ValueError(f"page {pi+1}: missing first question")
                top = marks[0][1] - 3
            if active and marks and marks[0][0] != 1 and marks[0][1] - 3 > top + 3:
                active['regions'].append([pi, x0, top, x1, marks[0][1] - 3])
            for mi, (number, y) in enumerate(marks):
                expected = len(result) % 30 + 1
                if number != expected:
                    raise ValueError(f"page {pi+1}: found {number}, expected {expected}")
                bottom = marks[mi + 1][1] - 3 if mi + 1 < len(marks) else 795.0
                active = {"number": number, "regions": [[pi, x0, y - 3, x1, bottom]]}
                result.append(active)
            if active and not marks:
                active['regions'].append([pi, x0, top, x1, 795.0])
    if len(result) != count * 30:
        raise ValueError(f"question count {len(result)} != {count*30}")
    return result


def graphic_clips(doc, regions):
    """Return only vector/raster artwork boxes inside question regions.

    PDF text is intentionally excluded. Most source diagrams and tables are
    vector paths, so get_drawings() catches them even when get_images() is
    empty. Page header rules are filtered out explicitly.
    """
    clips = []
    for pi, *bbox in regions:
        page = doc[pi]
        qrect = pymupdf.Rect(bbox)
        rects = []
        for drawing in page.get_drawings():
            rect = drawing['rect']
            if not rect.intersects(qrect):
                continue
            if rect.y1 < 35 or (rect.width > page.rect.width * 0.85 and rect.height < 8):
                continue
            if rect.width < 1 and rect.height < 1:
                continue
            rects.append(rect)
        for info in page.get_image_info(xrefs=True):
            rect = pymupdf.Rect(info['bbox'])
            if rect.intersects(qrect) and rect.y1 >= 35:
                rects.append(rect)
        if rects:
            artwork = rects[0]
            for rect in rects[1:]:
                artwork |= rect
            artwork &= qrect
            if artwork.width > 2 and artwork.height > 2:
                clips.append([pi, artwork.x0 - 6, artwork.y0 - 6, artwork.x1 + 6, artwork.y1 + 6])
    return clips


def render_question(doc, regions, output):
    clips = graphic_clips(doc, regions)
    if not clips:
        output.unlink(missing_ok=True)
        return None
    pieces = []
    for pi, *bbox in clips:
        pix = doc[pi].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), clip=pymupdf.Rect(bbox), alpha=False)
        im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        # Remove only white vertical margins; retain full column width, figures,
        # superscripts, roots, answer artwork and their original layout.
        bounds = ImageChops.difference(im, Image.new("RGB", im.size, "white")).getbbox()
        if bounds:
            im = im.crop((0, max(0, bounds[1] - 6), im.width, min(im.height, bounds[3] + 6)))
            pieces.append(im)
    if not pieces:
        raise ValueError(f"empty question image: {output}")
    image = Image.new("RGB", (max(p.width for p in pieces) + 16, sum(p.height for p in pieces) + 16 + (len(pieces)-1)*12), "white")
    y = 8
    for piece in pieces:
        image.paste(piece, (8, y))
        y += piece.height + 12
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, "WEBP", lossless=True, method=4)
    return [image.width, image.height]


def extract(source, render):
    bank = {"version": 1, "subjectId": "fizika", "bankId": "physics_db",
            "bankName": "Fizika Test Print 2021", "topics": [], "items": []}
    audit = {"source": "Fizika Test Print 2021 — Jumaniyazov Temurbek", "files": [], "questions": [], "review": []}
    for source_order, (stem, count) in enumerate(SOURCES, 1):
        path = source / f"{stem}.pdf"
        doc = pymupdf.open(path)
        keys = answer_keys(path, count)
        regions = question_regions(doc, count)
        variant_numbers = sorted(keys)
        for vi, number in enumerate(variant_numbers):
            topic_id = f"ftp-{source_order:02d}-{number:03d}"
            title = keys[number]["title"]
            if keys[number].get("printedTypo"):
                audit['review'].append({"variant": topic_id, "keyTypo": "printed 2.1 normalized to B from source question"})
            bank["topics"].append({"externalId": topic_id, "nameUz": title, "nameRu": title})
            for qi in range(30):
                record = regions[vi*30 + qi]
                external_id = f"{topic_id}-{qi+1:02d}"
                relative = f"/physics-print/{external_id}.webp"
                texts = [doc[pi].get_text(clip=pymupdf.Rect(bbox)) for pi, *bbox in record['regions']]
                text = normalize("\n".join(texts))
                # Require all four printed option labels in the whole question.
                option_matches = list(re.finditer(r"(?<!\w)([ABCD])(?:\)\s*|(?=\s+[-+]?\d|\s+√|\s+\())", text))
                labels = [m.group(1) for m in option_matches]
                # A question body can mention ``A)`` in prose/diagrams; the
                # answer choices are the final four labels in the clipped text.
                option_matches = option_matches[-4:]
                labels = [m.group(1) for m in option_matches]
                if labels != list('ABCD'):
                    audit['review'].append({"externalId": external_id, "printedLabels": labels})
                # The source is Uzbek. Keep the exact extracted text (including
                # Unicode roots/superscripts) and use it for both language
                # fields until a separately translated Russian bank exists.
                if len(option_matches) == 4:
                    question_text = text[:option_matches[0].start()].strip()
                    option_texts = [text[option_matches[i].end():option_matches[i+1].start()].strip()
                                    for i in range(3)] + [text[option_matches[3].end():].strip()]
                else:
                    question_text = text.strip()
                    option_texts = list('ABCD')
                # TestPage renders the current question number in its progress
                # header; do not repeat the PDF's printed ``24.`` prefix.
                question_text = re.sub(r"^\s*\d{1,2}\.\s*", "", question_text)
                clips = graphic_clips(doc, record['regions'])
                item = {"externalId": external_id, "topicExternalId": topic_id,
                        "questionUz": question_text,
                        "questionRu": question_text,
                        "optionsUz": {f"A{i+1}": c for i, c in enumerate(option_texts)},
                        "optionsRu": {f"A{i+1}": c for i, c in enumerate(option_texts)},
                        "correctAnswer": f"A{'ABCD'.index(keys[number]['answers'][qi])+1}",
                        "source": f"Fizika Test Print 2021, {stem}.pdf, {title}, {qi+1}",
                        "image": relative if clips else None}
                bank["items"].append(item)
                evidence = {"externalId": external_id, "file": path.name, "regions": record['regions'], "extractedText": text}
                if render:
                    evidence['imageSize'] = render_question(doc, record['regions'], ROOT/'public'/relative.lstrip('/'))
                audit['questions'].append(evidence)
        audit['files'].append({"name":path.name, "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
                               "pages":len(doc), "variants":count, "questions":len(regions)})
        print(f"{stem}: {count} variants, {len(regions)} questions + answer keys validated", flush=True)
    out = ROOT/'content-banks/fizika'
    out.mkdir(parents=True, exist_ok=True)
    (out/'physics-print.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (out/'physics-print.audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f"Total: {len(bank['topics'])} variants, {len(bank['items'])} question placements")
    print('Option-label review:', audit['review'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args()
    extract(args.source, args.render)
