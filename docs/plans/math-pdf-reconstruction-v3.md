# Master Implementation Plan: Matematika PDF Reconstruction Pipeline v3

## 0. Hujjatning maqsadi

Ushbu hujjatni boshqa AI agentga to'liq topshiriq sifatida berish mumkin. Vazifa - 13 ta manba PDFdan tuzilgan 368 variant va 11 040 ta matematika savolini manbaga vizual va semantik jihatdan maksimal darajada mos qayta tiklash, formulalar va javob variantlarini xatosiz ko'rsatish, chizmalarni ortiqcha yozuvsiz va kesilmasdan olish, mavjud foydalanuvchi progressi hamda savol IDlarini saqlagan holda xavfsiz production rollout qilish.

Bu oddiy regex tuzatishi emas. Ish manba PDF geometriyasi, element egaligi, matematik AST, mustaqil audit, qat'iy regression fixturelar va bosqichma-bosqich promotion orqali bajariladi.

## 1. AI agent uchun qat'iy topshiriq

### 1.1. Asosiy natija

Quyidagi natijalarning barchasi bir vaqtda bajarilmaguncha vazifa tugallangan hisoblanmaydi:

1. Barcha 11 040 savol mavjud va `externalId` to'plami o'zgarmagan.
2. 368 ta mavzu/variant mavjud va har birida aynan 30 tadan savol bor.
3. Har savolda o'z PDF hududidan olingan aynan 4 ta bo'sh bo'lmagan javob varianti bor.
4. Javob kalitlari manba `NatijaDB.db` bilan bitma-bit bir xil va baseline hash o'zgarmagan.
5. Savol, variant va formulalarda begona oldingi/keyingi savol matni yo'q.
6. `Variant-95 1.` singari PDF sarlavhalari savolga kirmagan.
7. `\operatorname{tg}`, `\operatorname{ctg}`, indeks, daraja, ildiz, kasr, sistema, matritsa va katta qavslar UI'da xom LaTeX bo'lib ko'rinmaydi.
8. `\pin`, `\pik`, takrorlangan `\left`, `\right`, boshqaruv belgisi yoki buzilgan matematik token qolmagan.
9. Har bir diagramma manbadagi to'liq chizmani va unga tegishli belgilarni o'z ichiga oladi, lekin savol matni va javob variantlarini o'z ichiga olmaydi.
10. Rasmning hech bir tomoni kesilmagan; oq padding va kontur xavfsizligi avtomatik tekshirilgan.
11. Auditda 0 critical, 0 tushuntirilmagan warning va 0 unresolved/manual-review yozuvi qolgan.
12. Production yangilanishida mavjud `questions.id` qiymatlaridan bittasi ham o'zgarmagan.
13. `question_banks.content_version`, server keshi, CDN keshi va faol test sessiyalari yangi kontent versiyasini xavfsiz ko'radi.
14. Barcha unit, integrationga tegishli lokal gate, typecheck va build muvaffaqiyatli o'tgan.

### 1.2. Qat'iyan taqiqlanadi

- Butun korpusga ko'r-ko'rona regex replace qilish.
- Savol chegaralarini faqat doimiy `x` yoki `y` koordinata bilan belgilash.
- Har sahifada chapda 1-15, o'ngda 16-30 bo'ladi deb taxmin qilish.
- Savol yetishmasa boshqa savol yoki dublikatdan matn/variant ko'chirish.
- Formula qiymatiga qarab hardcode yozish.
- Manbada ko'rilmagan matnni matematik mantiq bilan "to'g'rilab" qo'yish.
- Noaniq elementni jim tashlab yuborish yoki plain textga aylantirish.
- Audit warninglarini muvaffaqiyat deb chiqarish.
- Promotion gate o'tmasdan canonical JSON, canonical rasmlar yoki production DBni o'zgartirish.
- Productionda yangi ID yaratish yoki savollarni delete/reinsert qilish.
- Eski 301 rasm sonini haqiqat deb qabul qilish; rasm mavjudligi faqat PDFdagi manba asosida aniqlanadi.
- `strict: 'ignore'` yordamida renderer xatolarini yashirish.
- PDFdagi haqiqiy bosma xatoni hujjatsiz o'zgartirish.

## 2. Hozirgi holat va isbotlangan muammolar

### 2.1. Hozirgi commit - baseline, sifat isboti emas

`791f5d4e feat(math): vector-geometry pdf extraction pipeline for 11,040 questions` commiti boshlang'ich baseline sifatida olinadi. Uning mavjud testlari o'tishi kontentning PDFga mosligini isbotlamaydi.

Hozirgi kuzatuv natijalari:

- `math-print-bank.test.ts`: 12/12 o'tadi.
- `content:audit:math`: 0 critical va 0 KaTeX error deb chiqadi.
- Shu bilan birga audit 30 ta duplicate option va 36 warning topadi, lekin noto'g'ri ravishda 100% muvaffaqiyat deb yozadi.
- Demak, mavjud test/audit false confidence beradi.

### 2.2. Foydalanuvchi rasmlarida tasdiqlangan 6 ta regressiya

Quyidagi IDlar darhol golden fixturega kiritilishi shart:

| ID | Manba | Tasdiqlangan muammo |
|---|---|---|
| `mtp-algebra-geometriya-014-18` | `Algebra_va_Geometriya1_30.pdf`, variant 14, savol 18 | `\operatorname{ctg}` va `\operatorname{tg}` xom ko'ringan; D variantga keyingi 19-savolning `1/cos x + sqrt(3)/sin x = 4` qismi kirgan. Manbada D faqat `5`. |
| `mtp-algebra-geometriya-063-18` | `Algebra_va_Geometriya61_90.pdf`, variant 63, savol 18 | `2 cos(2x + pi/9) + sqrt(3) = 0` ifodasida qavs yo'qolgan; `\pin`, `\pik` paydo bo'lgan; ortiqcha nuqtalar qolgan. |
| `mtp-algebra-geometriya-095-01` | `Algebra_va_Geometriya91_120.pdf`, variant 95, savol 1 | `Variant-95 1.` sarlavhasi savol matniga kirgan. |
| `mtp-algebra-geometriya-065-04` | `Algebra_va_Geometriya61_90.pdf`, variant 65, savol 4 | Uchta kasr ko'paytmasi tekislangan; C variantda `+.` qolgan; D variantga keyingi 5-savol formulasi kirgan. |
| `mtp-algebra-geometriya-064-04` | `Algebra_va_Geometriya61_90.pdf`, variant 64, savol 4 | Murakkab kasrlar, kub ildizlar va qavslar buzilgan; takroriy xom `\left`, `\right`, `\sqrt[3]` qolgan. |
| `mtp-algebra-geometriya-056-20` | `Algebra_va_Geometriya31_60.pdf`, variant 56, savol 20 | Ikki qatorli sistema qavsi yo'qolgan; `a_{1}` xom ko'ringan; `a_1^2` tartibi `a^2 1` bo'lib ketgan. |

### 2.3. Korpus bo'yicha aniqlangan signal sonlari

Quyidagi sonlar bir-birini qoplashi mumkin; ularni qo'shib umumiy xato soni deb bo'lmaydi. Ular avtomatik triage uchun boshlang'ich baseline:

| Kategoriya | Elementlar | Maydonlar |
|---|---:|---:|
| Xom `\operatorname` | 467 | 1 200 |
| `\pin` yoki `\pik` | 156 | 1 048 |
| `\sqrt[` shubhali holatlar | 1 077 | 3 824 |
| Xom `\left`/`\right` | 194 | 456 |
| ASCII control chars | 1 455 | 3 658 |
| `Variant-N Q.` sarlavha qoldig'i | 368 | 736 |
| Buzilgan daraja/indeks | 161 | 330 |
| `++`, `--`, `::` | 172 | 344 |
| Keyingi savol fragmenti ehtimoli | 361 | 724 |

### 2.4. Ildiz sabablar

1. Savol segmentatsiyasi fixed column va option completion evristikalariga suyanadi.
2. Formula tiklash font-size/baseline va regex aralashmasi bo'lib, aniq ifodaga bog'langan hardcodelar mavjud.
3. Extractor valid matematik tuzilma o'rniga aralash plain text + LaTeX string chiqaradi.
4. `MathText.tsx` xom yoki noto'g'ri buyruqlarni plain text sifatida ko'rsatadi.
5. Audit faqat oldindan "math" deb tanilgan segmentlarni tekshiradi; noto'g'ri token plain text bo'lib qochib ketadi.
6. 8 ta golden fixture real layout oilalarini va foydalanuvchi topgan 6 holatni yetarli qamramaydi.
7. Savol, variant va rasm elementlari uchun manba provenance hamda ownership isboti yo'q.

## 3. Ish hududi va fayl siyosati

### 3.1. Faqat staging v3 ichida ishlash

Yangi natijalar quyidagi joylarga yoziladi:

```text
content-banks/matematika/v3/
  math-print.json
  source-manifest.json
  provenance.ndjson
  manual-review.json
  source-errata.json
  audit-report.json
  corruption-candidates.json
  rollout-report.json
  rollback-manifest.json

public/math-print/v3/
  <externalId>-<hash8>.webp

tmp/pdfs/math-v3/
  page-models/
  source-crops/
  rendered-formulas/
  contact-sheets/
  reports/
```

Canonical fayllar gate o'tmaguncha o'zgarmaydi:

```text
content-banks/matematika/math-print.json
public/math-print/*.webp
```

### 3.2. Mavjud kuzatuvga olinmagan v3 fayllari

Ish boshlanishida `git status --short` bajarilsin. Hozirda quyidagilar kuzatuvga olinmagan holatda mavjud:

```text
content-banks/matematika/v3/source-manifest.json
scripts/build-math-v3-baseline.py
```

Ularni yo'q qilish yoki ustidan yozish taqiqlanadi. Avval tarkibi audit qilinsin. Hozirgi baseline skriptda kamida quyidagi xavflar tekshirilsin:

- `NatijaDB.db` uchun `D:\Matematika Test Print\NatijaDB.db` hardcoded yo'l.
- DBdagi `(external_id, id)` mapping yo'q.
- `generated_at` deterministik buildni buzishi mumkin.
- `source-errata.json` avtomatik yaratilishi va tasdiqlanmagan tuzatishlarni `confirmed` deb belgilashi mumkin.
- Source variant/page mappinglari va ikki o'xshash errata yozuvi vizual manba bilan qayta tekshirilmagan.

Ular foydalanuvchi ishlari sifatida saqlansin; kerak bo'lsa alohida patch bilan yaxshilansin.

## 4. Bosqich 0 - Preflight va o'zgarmas baseline

### 4.1. Ishni boshlashdan oldingi snapshot

Quyidagilar bitta deterministik manifestda saqlansin:

- Git commit SHA va dirty worktree ro'yxati.
- 13 ta source PDFning path, size, page count va SHA-256 hashi.
- Canonical JSONning SHA-256 hashi.
- Barcha 11 040 `externalId` sorted ro'yxati va uning SHA-256 hashi.
- 368 topic ID va har bir topicdagi 30 savol soni.
- `correctAnswer` mapping: `externalId -> A1|A2|A3|A4` va umumiy SHA-256.
- Production/test DB uchun `external_id -> questions.id` mapping va umumiy SHA-256.
- Hozirgi rasm path/hash mappingi.
- Source file -> variant range mappingi.

Manifestda absolut lokal yo'llar natija identifikatori sifatida ishlatilmasin. Repo-relative path saqlansin; tashqi `NatijaDB.db` yo'li CLI argument/env orqali berilsin.

### 4.2. Yangi CLI interfeysi

Baseline va extractor buyruqlari majburiy argumentlarni ochiq qabul qilsin:

```text
python scripts/build-math-v3-baseline.py \
  --source-dir <path> \
  --answer-db <path> \
  --canonical-json content-banks/matematika/math-print.json \
  --output content-banks/matematika/v3/source-manifest.json

python scripts/extract-math-print.py \
  --manifest content-banks/matematika/v3/source-manifest.json \
  --output content-banks/matematika/v3/math-print.json \
  --provenance content-banks/matematika/v3/provenance.ndjson \
  --images public/math-print/v3 \
  --strict
```

Har buyruq:

- input mavjudligini tekshiradi;
- source hash mos kelmasa to'xtaydi;
- canonical faylga yozishni rad etadi;
- vaqtinchalik faylga yozib, muvaffaqiyatda atomic rename qiladi;
- xatoda oldingi staging natijasini buzmaydi.

### 4.3. Baseline gate

Bosqich 0 faqat quyidagilar bo'lsa o'tadi:

- 13/13 source PDF topilgan;
- 368/368 variant javob kaliti topilgan;
- 11 040/11 040 external ID topilgan;
- har variantda 30 ta javob bor;
- duplicate/missing external ID 0;
- source va answer-key hashlar yozilgan;
- DB id mapping olingan yoki production credential bo'lmasa bu holat aniq `pending-production-snapshot` deb belgilangan.

## 5. Bosqich 1 - Extractorni modul arxitekturaga ajratish

`scripts/extract-math-print.py` faqat CLI/orchestrator bo'lib qolsin. Asosiy mantiq:

```text
scripts/math_pdf/
  __init__.py
  models.py
  source_reader.py
  layout_model.py
  question_segmenter.py
  formula_parser.py
  option_parser.py
  diagram_extractor.py
  validators.py
  reporting.py
```

### 5.1. `models.py`

Quyidagi typed dataclass/enumslar yaratiladi:

```text
Atom
  id
  source_pdf
  page_index
  kind: glyph|span|line|path|image
  bbox: x0,y0,x1,y1
  text/glyph
  font_name
  font_size
  baseline
  source_order
  role: unknown|header|footer|question_marker|option_marker|body|formula|diagram_label|diagram_path|ignored
  owner_external_id|null
  confidence
  ignore_reason|null

QuestionRegion
  external_id
  source_pdf
  page_indexes
  variant_number
  question_number
  anchor_atom_ids
  candidate_bbox
  eligible_atom_ids
  question_atom_ids
  option_slots
  diagram_ids
  confidence

OptionSlot
  logical_id: A1|A2|A3|A4
  marker_atom_ids
  content_atom_ids
  bbox
  visual_order
  confidence

DiagramRegion
  source_atom_ids
  label_atom_ids
  bbox_points
  crop_bbox
  output_path
  content_hash
  confidence
```

Har eligible atomning yakuniy holati aynan bittasi bo'lishi shart:

- bitta savol/variant/diagrammaga tegishli;
- yoki aniq sabab bilan ignored.

`unknown`, ikki owner yoki sababsiz ignored element auditni yiqitadi.

### 5.2. `source_reader.py`

Har sahifadan quyidagilar geometriyasi bilan olinadi:

- chars/glyphs;
- spans va lines;
- vector paths/drawings;
- embedded images;
- rotation, mediabox, cropbox;
- font metadata.

PDF extraction kutubxonasi qaytargan text order haqiqat deb olinmaydi. `source_order` faqat signal; final o'qish tartibi geometriya bilan tiklanadi.

### 5.3. Fontlar haqida qoida

CMR/CMMI/CMEX/CMSY, ularning subset-prefiksli nomlari va 6/8/10/12 o'lchamli variantlari mavjud. Font oilasi matematik rol uchun faqat signal hisoblanadi. Semantika quyidagilarning kombinatsiyasi bilan aniqlanadi:

- glyph shakli/unicode mapping;
- bbox;
- baseline;
- nisbiy font size;
- gorizontal/vertikal qo'shnilik;
- path/rule bilan aloqasi;
- parent expression geometriyasi.

Font nomi bitta o'zi daraja, indeks yoki formula degani emas.

## 6. Bosqich 2 - Dinamik sahifa va savol segmentatsiyasi

### 6.1. Header/footer exclusion

Har PDF/layout oilasi uchun header/footer zonalari data asosida topilsin:

- bir xil joyda ko'p sahifada takrorlangan matn;
- `Variant-N`, sahifa raqami va chop sarlavhalari;
- sahifa chegarasiga yaqin takroriy elementlar.

Header/footer elementlari `ignore_reason=page_header|page_footer` bilan belgilanadi. Regex yolg'iz qaror bermaydi; sahifalararo takrorlanish va geometriya ham shart.

### 6.2. Column detection

Fixed `x:28..298` va `x:300..585` ishlatilmaydi. Ustunlar:

- text/path x-density histogrami;
- markaziy gutterdagi uzoq bo'shliq;
- savol markerlari klasteri;
- reading-order sequence

orqali sahifa kesimida aniqlanadi.

Bir sahifada bitta, ikkita yoki notekis ustun bo'lishi mumkin. `Algebra1_30.pdf` birinchi sahifada chap 1-11, o'ng 12-21, ikkinchi sahifada 22-30 kabi dinamik taqsimotga ega; 1-15/16-30 taxmini taqiqlanadi.

### 6.3. Question anchor detection

Savol markerini aniqlash uchun:

- gutterga yaqin `1.`...`30.` ko'rinishidagi glyph/word;
- bir variant ichida ketma-ket sonlar;
- markerning savol/option layoutiga nisbati;
- source manifestdagi variant va savol kutilmasi

birga ishlatiladi.

Matn ichidagi `1.` yoki formula raqami marker bo'lmasligi kerak. Ketma-ketlik buzilsa yoki ikkita nomzod teng bo'lsa, manual reviewga yozilib strict run to'xtaydi.

### 6.4. Region boundary

Savol hududi faqat markerning pastidan boshlanmaydi. Katta sistema qavsi, kasr surati, ildiz indeksi yoki daraja marker baseline'idan yuqoriga chiqishi mumkin.

Region qurish tartibi:

1. Joriy va keyingi savol anchori aniqlanadi.
2. Ustundagi barcha eligible atomlar uchun yaqinlik va strukturaviy bog'liqlik grafigi quriladi.
3. Anchor bilan bog'langan komponent yuqoriga/pastga kengaytiriladi.
4. Keyingi savol komponenti bilan to'qnashuvda whitespace gap, option grid va structural ownership ishlatiladi.
5. Formula ichidagi bir-biriga bog'liq atomlar turli savollarga bo'linmaydi.
6. Page/column continuation faqat ketma-ketlik va element ownership bilan isbotlansa ruxsat etiladi.

### 6.5. Segmentatsiya invariantlari

- 11 040 ta `QuestionRegion`.
- Har `QuestionRegion`da bitta aniq source variant/question mapping.
- Har eligible atom bitta ownerga ega.
- Savol regionlari orasida overlap 0.
- Unassigned eligible atom 0.
- Ambiguous ownership 0.
- Savol matnida keyingi/oldingi anchor yoki option grid elementi 0.

## 7. Bosqich 3 - Geometriyadan matematik AST qurish

### 7.1. String emas, AST birinchi

Formula parser avval quyidagi AST turlarini quradi:

```text
Text
Symbol
Sequence
Group
Fraction(numerator, denominator)
Radical(index?, radicand)
Superscript(base, exponent)
Subscript(base, index)
SubSup(base, subscript, superscript)
Function(name, argument?)
Operator
Interval
Cases(rows)
Matrix(rows, columns)
Delimited(left, body, right)
```

LaTeX faqat AST validatsiyadan o'tgandan keyin serializatsiya qilinadi.

### 7.2. Kasrlar

Gorizontal rule nomzodi uchun:

- balandlik juda kichik;
- eni formula glyphiga mos;
- tepa va pastda x-overlap qiluvchi komponentlar bor;
- rule diagramma komponentiga tegishli emas.

Tepa komponent numerator, past komponent denominator bo'ladi. Nested fraction rekursiv ishlaydi. Rule faqat minus yoki diagramma chizig'i bo'lsa fraction qilinmaydi.

### 7.3. Ildizlar

- radical glyph aniqlanadi;
- uning overbar pathi yoki glyph davomiyligi aniqlanadi;
- overbar ostidagi bog'langan komponent radicand bo'ladi;
- chap-yuqoridagi kichik komponent optional index bo'ladi;
- `\sqrt[3]{...}` kabi indexed root AST orqali quriladi.

### 7.4. Daraja va indeks

Attachment qoidasi:

- eng yaqin chapdagi mos base;
- baseline offset;
- font size ratio;
- horizontal gap;
- boshqa operator/bracket boundary.

Bir baseda ikkalasi bo'lsa `SubSup` quriladi va `a_1^2` tartibi saqlanadi. `a^2 1` kabi flatten qilish taqiqlanadi.

### 7.5. Sistemalar va matritsalar

CMEX yoki pathlardan tashkil topgan katta figurali qavs bitta delimiter komponentiga birlashtiriladi. O'ng tomondagi qatorlar baseline klasterlari bilan ajratiladi:

```latex
\begin{cases}
  ... \\
  ...
\end{cases}
```

Qavsning bir bo'lagi boshqa savolga o'tishi mumkin emas. Qavs bor-u qator topilmasa yoki qator bor-u qavs yo'qolsa strict failure.

### 7.6. Katta qavslar

Yig'ma `(`, `)`, `[`, `]`, `{`, `}` komponentlari geometriya bilan birlashtiriladi. `\left` va `\right` faqat AST serializer tomonidan juft va balanced chiqariladi. Raw inputdan takroriy command ko'chirilmaydi.

### 7.7. Funksiya va operator mapping

Semantic mapping kamida quyidagilarni qamraydi:

- `sin`, `cos`, `tg`, `ctg`, `log`, `ln`, `lg`;
- `pi`, `alpha`, `beta`, `gamma`, `Delta`;
- `le`, `ge`, `ne`, `in`, `notin`, `infty`;
- `cup`, `cap`, `subset`, `parallel`, `perp`, `angle`;
- `cdot`, `times`, `div`, `pm`.

`tg`/`ctg` uchun bitta canonical serialization tanlanadi, masalan `\operatorname{tg}`. Renderer aynan shu buyruqni qo'llashi shart. `\pin` yoki `\pik` hech qachon valid output emas.

### 7.8. Explicit delimiters

Regenerated kontentda barcha formula fragmentlari aniq delimiter bilan chiqariladi:

- inline: `\(...\)`;
- display: `\[...\]`.

Plain Uzbek/Russian matn delimiter tashqarisida qoladi. Renderer butun stringni taxmin bilan math deb olishga majbur bo'lmaydi.

### 7.9. Confidence va fail-fast

Har AST node provenance va confidence saqlaydi. Quyidagi holatlar `manual-review.json`ga yoziladi va promotionni to'xtatadi:

- ikkita teng parent nomzodi;
- fraction rule noaniq;
- radical boundary noaniq;
- unmatched delimiter;
- noma'lum glyph;
- source ownership konflikti;
- serializationdan keyin strict KaTeX error/warning.

### 7.10. Source errata siyosati

Real PDF bosma xatosi faqat `source-errata.json` orqali boshqariladi. Har yozuv:

```json
{
  "id": "ERR-0001",
  "pdf": "...pdf",
  "page": 1,
  "variant": 1,
  "question": 1,
  "bbox": [0, 0, 0, 0],
  "original": "...",
  "decision": "preserve|correct|map-by-position",
  "replacement": null,
  "reason": "...",
  "evidence_crop_sha256": "...",
  "status": "proposed|approved|rejected",
  "approved_by": null
}
```

`approved` bo'lmagan errata promotionni yiqitadi. Extractor kodida aniq formula yoki javob qiymatiga bog'langan hardcode bo'lmaydi.

## 8. Bosqich 4 - Javob variantlari parseri

### 8.1. Marker va grid detection

Option markerlar matn regexi bilan yolg'iz topilmaydi. Quyidagi layoutlar qo'llanadi:

- 1x4 horizontal;
- 2x2 grid;
- 4x1 vertical;
- wrapped long option;
- marker glyphi tushib qolgan, lekin 4 ta aniq vizual slot mavjud bo'lgan source-errata holati.

Markerlar geometriya, qator/ustun alignmenti va visual order bilan tasdiqlanadi. Savol ichidagi `A`, `B`, `C`, `D` nuqta nomlari option marker bo'lmaydi.

### 8.2. Slot ownership

Har A1-A4 slot quyidagiga ega:

- source marker atomlari;
- content atomlari;
- bbox;
- visual order;
- provenance;
- confidence.

Slot contenti joriy savol regionidan tashqariga chiqmasligi kerak. Boshqa savoldan donor fallback mutlaqo taqiqlanadi.

### 8.3. Duplicate siyosati

- Bir xil joydagi overlap qiluvchi text-layer dublikati avtomatik dedupe qilinishi mumkin.
- Turli vizual slotlarda bir xil ko'rinadigan javoblar manbada haqiqatan mavjud bo'lishi mumkin; ular jim o'chirilmaydi.
- Noto'g'ri/takroriy marker manbada bo'lsa, visual slot order va approved errata ishlatiladi.
- Matnni matematik javob kalitiga qarab ixtiro qilish taqiqlanadi.

### 8.4. Option gate

- Har savolda aynan 4 slot.
- Har slot bo'sh emas.
- Marker/content ownership joriy savolga tegishli.
- Duplicate option warningi 0 yoki approved source errata bilan tushuntirilgan.
- Option oxirida keyingi savolning formula komponenti yo'q.

## 9. Bosqich 5 - Diagramma va grafiklarni ideal ajratish

### 9.1. Diagramma classification

Quyidagilar diagramma emas:

- fraction rule;
- radical overbar;
- underline/separator;
- katta formula qavsi;
- matn baseline artefakti.

Diagramma nomzodi:

- bir nechta bog'langan vector path;
- egri chiziq, o'q, poligon, aylana, burchak yoyi;
- embedded image;
- unga yaqin qisqa label klasterlari.

### 9.2. Diagram label ownership

`x`, `y`, `0`, `M`, `N`, `E`, `O`, `35°`, `25°`, `y=f(x)` singari qisqa belgilar diagramma komponentiga geometriya bilan bog'lansa:

- rasm cropiga kiritiladi;
- savol matniga kiritilmaydi.

Oddiy savol jumlasi yoki A-D variant qatori diagrammaga kiritilmasligi kerak.

### 9.3. Crop algoritmi

1. Connected diagram paths/images union bboxi olinadi.
2. Yaqin va semantik bog'langan label bboxlari qo'shiladi.
3. Question/option bboxlar bilan intersection tekshiriladi.
4. Source crop yuqori sifatda, kamida 3x scale yoki teng DPI bilan render qilinadi.
5. Oq fon bo'yicha non-white bbox aniqlanadi.
6. Har tomonga 6-8 px safety margin qo'shiladi.
7. Page boundary sabab padding yetmasa unresolved deb belgilanadi.
8. Lossless WebP yoziladi.

Output path content-addressed bo'ladi:

```text
/math-print/v3/<externalId>-<sha256-first-8>.webp
```

Bu eski Telegram/browser/CDN rasm keshini avtomatik chetlab o'tadi.

### 9.4. Avtomatik crop gate

- File mavjud va decode bo'ladi.
- Hash filename bilan mos.
- Non-white content crop ichida har tomondan kamida belgilangan paddingga ega.
- Source diagram atomlarining hammasi crop ichida.
- Question/option text bbox bilan intersection 0.
- Rasm faqat oq yoki juda kichik artefakt emas.
- Width/height manfiy, nol yoki haddan tashqari kichik emas.

### 9.5. Vizual QA

Har diagramma uchun side-by-side review kartasi yaratiladi:

- chapda PDFdagi source region, atrof kontekst bilan;
- o'ngda final WebP;
- externalId, PDF, page, bbox, hash;
- pass/fail/review holati.

Contact sheetlar source PDF, diagram turi va xavf kategoriyasi bo'yicha bo'linadi. Bitta juda katta sahifa yetarli emas. Har bir rasm ko'zdan kechirilgani review manifestida qayd etiladi.

## 10. Bosqich 6 - Frontend renderer va mobil UI

### 10.1. `MathText.tsx` contracti

Regenerated v3 matn uchun asosiy contract:

- faqat explicit `\(...\)` va `\[...\]` delimiterlar math sifatida parse qilinadi;
- plain text alohida segment bo'ladi;
- legacy heuristic faqat eski kontent compatibility yo'li sifatida izolyatsiya qilinadi;
- v3 kontent legacy heuristicga tushsa test/audit xato beradi.

Renderer kamida quyidagilarni to'g'ri ko'rsatadi:

- `\operatorname{tg}` va `\operatorname{ctg}`;
- `a_{1}`, `a^{2}`, `a_{1}^{2}`;
- `\sqrt[3]{...}`;
- nested `\frac`;
- `\begin{cases}`;
- matrices;
- `\left(...\right)` yoki normal balanced delimiters.

### 10.2. Xato siyosati

- Audit/test muhitida KaTeX strict error/warning buildni yiqitadi.
- Developmentda raw LaTeXni jim plain text ko'rsatish o'rniga ko'rinadigan diagnostic marker/log bo'ladi.
- Production fallback foydalanuvchi ekranini sindirmasligi mumkin, lekin monitoringga error yuboradi; fallback mavjudligi audit gateini yumshatmaydi.

### 10.3. Responsive layout

Formula container:

- `max-width: 100%`;
- kerak bo'lsa lokal `overflow-x: auto`;
- butun sahifada gorizontal scroll yaratmaydi;
- javob kartasidan tashqariga chiqmaydi;
- display math va cases qirqilmaydi.

Quyidagi viewportlar tekshiriladi:

- 320 px;
- 360 px;
- 390 px;
- Telegram WebApp safe-area;
- Android APK WebView.

Long formula, nested fraction, sistema, indexed root va uzun optionlar alohida screenshot regressionga ega bo'lsin.

## 11. Bosqich 7 - Mustaqil audit tizimi

Audit extractor ichidagi helperlarni qayta ishlatib o'zini o'zi tasdiqlamasin. U alohida implementation bo'lsin va source manifest/provenance/outputni mustaqil tekshirsin.

### 11.1. Strukturaviy audit

- 368 topic.
- Har topicda 30 item.
- Jami 11 040 item.
- External ID baseline set/hash bir xil.
- Duplicate/missing ID 0.
- Answer key baseline hash bir xil.
- Har savolda A1-A4 exactly once.
- Barcha image pathlar mavjud va hash mos.

### 11.2. Matn va formula auditi

Har UZ/RU question va option maydonida:

- ASCII control chars `[00-08,0B,0C,0E-1F]` 0;
- `Variant-\d+`, page header/footer qoldig'i 0;
- `\pin`, `\pik` 0;
- xom/takroriy `\left`, `\right` 0;
- xom katta qavs glyphlari 0;
- balanced delimiters;
- balanced braces;
- strict KaTeX error 0;
- strict KaTeX warning 0;
- delimiter tashqarisida math-like command 0;
- unidentified math-like fragment 0;
- `++`, `--`, `::`, `+.` kabi korruptsiya signali 0 yoki approved errata;
- savol oxiridagi next-question fragment 0.

### 11.3. Provenance/ownership auditi

- Har output segmentda source atom IDlari bor.
- Bir eligible atom ikki output segmentga yozilmagan.
- Bir atom sababsiz yo'qolmagan.
- A1-A4 atomlari shu savol regionidan.
- Diagram label atomlari textga qayta kirmagan.
- Header/footer atomlari outputga kirmagan.
- Orphan va ambiguous atom 0.

### 11.4. Rasm auditi

- File/hash/decode valid.
- Crop clipping 0.
- Question/option intersection 0.
- Diagram source coverage 100%.
- Empty/near-empty image 0.
- Review status pending 0.

### 11.5. Warning policy

Audit yakunida faqat ikki holat mumkin:

- `PASS`: 0 critical, 0 unexplained warning, 0 unresolved;
- `FAIL`: qolgan barcha holat.

Warning bor paytda "100% success" yozish taqiqlanadi. Approved source errata alohida son bilan ko'rsatiladi va warning hisoblanmaydi, lekin reportda ochiq turadi.

## 12. Bosqich 8 - Golden fixture va test strategiyasi

### 12.1. Golden fixture formati

Har fixture quyidagilarni saqlaydi:

```text
externalId
source PDF SHA-256
page index
variant/question number
question bbox
option bboxes
diagram bbox/null
source crop SHA-256
exact expected UZ text
exact expected RU text yoki translation policy
exact A1-A4
correctAnswer
expected image presence
normalized LaTeX yoki formula AST snapshot
```

Expected matn source PDFdan ko'chiriladi; paraphrase qilinmaydi. Punctuation, decimal separator, interval bracket va formula operatorlari saqlanadi.

### 12.2. Minimal coverage

- Hozirgi 8 ta fixture saqlanadi.
- Yuqoridagi 6 ta screenshot ID darhol qo'shiladi.
- Jami kamida 60 ta stratified fixture yaratiladi.
- 13 ta source PDFning har biri qamraladi.
- Har layout oilasi qamraladi.
- Page/column bosh va oxiridagi savollar qamraladi.
- Quyidagilarning har biri qamraladi: nested fraction, indexed radical, mixed fraction, cases, matrix, large delimiter, power+subscript, trig function, interval, long wrapped option, missing/takroriy source marker, graph, geometry diagram.

### 12.3. Python testlar

`tests/python/` yoki loyihadagi amaldagi Python test joylashuvida:

- layout/column detection test;
- anchor sequence test;
- one-atom-one-owner test;
- fraction/root/script/cases AST unit test;
- option grid test;
- diagram classification/crop test;
- serializer test;
- errata policy test;
- deliberate corrupted fixture audit-fails test;
- deterministic double-run test.

Deterministik test extractor bir xil source bilan ikki marta ishlaganda timestampdan mustaqil ravishda byte-identical JSON va bir xil image hashlar chiqishini tekshiradi. Runtime metadata alohida reportda bo'lsin, canonical candidate ichida emas.

### 12.4. TypeScript/Vitest testlar

- 11 040/368/30 structural invariant;
- external ID va answer-key hash;
- 60+ golden exact comparison;
- `MathText` explicit delimiter parsing;
- `operatorname`, sub/sup, indexed root, cases render;
- raw command fallbackning auditda fail bo'lishi;
- 320/360/390 px overflow regression;
- image URL version/hash contracti;
- audit false-positive va false-negative fixturelari.

### 12.5. Majburiy yakuniy komandalar

Repo script nomlari yangilangach package script qo'shilsin, masalan:

```text
npm run content:extract:math:v3
npm run content:audit:math:v3
npx vitest run tests/unit/config/math-print-bank.test.ts
npm test
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.server.json --noEmit
npm run build
```

Real DB talab qiladigan integration test faqat test DB migrate qilingandan keyin ishga tushiriladi. Production credential bilan test bajarilmaydi.

## 13. Bosqich 9 - Korpus triage va review UI

`scripts/find-math-corruption.ts` yaratiladi. U barcha question/option UZ/RU maydonlarini skan qilib:

- kategoriya;
- externalId;
- field;
- fragment;
- qoidaning nomi;
- source provenance;
- severity

bilan `corruption-candidates.json` chiqaradi.

Qo'shimcha HTML review report:

- filter: source PDF, category, error type, status;
- source crop;
- current canonical;
- v3 candidate;
- formula render;
- provenance bbox overlay;
- approve/reject/note uchun exportable review state.

Boshlang'ich signal sonlari 2.3-bo'limdagi qiymatlar bilan qayd etiladi. Yakunda har kategoriya 0 yoki approved errata bo'lishi shart.

## 14. Bosqich 10 - Candidate yaratish va promotion gate

### 14.1. Full extraction tartibi

1. Source hash preflight.
2. Page atom dump.
3. Dynamic layout/columns.
4. Question regions.
5. Option slots.
6. Formula AST.
7. Diagram regions/crops.
8. UZ source serialization.
9. RU policy bo'yicha mavjud tarjimani saqlash yoki alohida verified mapping; avtomatik tarjima bilan source ma'nosi o'zgartirilmaydi.
10. Provenance output.
11. Strict validators.
12. Candidate JSON atomic write.
13. Independent audit.
14. Golden tests.
15. Full deterministic second run.

### 14.2. Promotiondan oldingi diff

Machine-readable va HTML diff tayyorlansin:

- o'zgargan savol matnlari soni;
- o'zgargan optionlar soni;
- image added/removed/changed;
- unchanged correctAnswer count;
- unchanged externalId count;
- formula AST change categories;
- errata bilan bog'langan o'zgarishlar;
- old/new render side-by-side.

Har katta kategoriya sample emas, to'liq list bilan ko'rib chiqiladi.

### 14.3. Promotion gate

Canonicalga o'tkazish faqat quyidagilar bir vaqtda bo'lsa mumkin:

- strict audit PASS;
- manual-review empty;
- 60+ golden PASS;
- deterministic run PASS;
- barcha diagramma review qilingan;
- answer key hash unchanged;
- external ID set unchanged;
- DB ID dry-run unchanged;
- full test/typecheck/build PASS;
- foydalanuvchi yoki mas'ul shaxs promotionni aniq tasdiqlagan.

## 15. Bosqich 11 - Xavfsiz DB import

### 15.1. Import rejimlari

`scripts/import-math-bank.ts` ikki aniq rejimga ega bo'lsin:

```text
--bootstrap       # faqat bo'sh test DB uchun yangi row yaratadi
--update-existing # production uchun, yangi ID yaratmaydi
--dry-run          # transaction rollback + report
```

Production defaulti xavfsiz bo'lishi uchun rejim ko'rsatilmasa script ishlamasin.

### 15.2. `--update-existing` qoidalari

Importdan oldin:

- `math_db` bankida aynan 11 040 kutilgan external ID borligi;
- missing 0;
- extra 0;
- duplicate 0;
- `external_id -> id` snapshot;
- candidate answer-key hash;
- current content_version

tekshiriladi.

Update faqat mavjud rowlarni o'zgartiradi. `MAX(id)+1`, INSERT yoki delete/reinsert production pathda ishlatilmaydi. SQL taxminan `UPDATE ... FROM VALUES` yoki mavjudlikni qat'iy tekshirgan upsert bilan bajariladi, lekin affected row count aynan 11 040 bo'lishi shart.

### 15.3. Haqiqiy transaction

Dry-run ham, non-dry production run ham haqiqiy DB transaction ichida ishlaydi:

1. bank/rows lock;
2. precondition assert;
3. backup metadata;
4. 11 040 update;
5. row count/hash validation;
6. ID mapping before/after equality;
7. `question_banks.content_version = content_version + 1`;
8. commit.

Biror assert yiqilsa to'liq rollback.

### 15.4. Progress va sessiyalarni saqlash

`questions.id` saqlangani uchun progress, answer token, explanation va mistakes bog'lanishlari uzilmaydi. Lekin faol test sessiyalari eski kontent bilan ochilgan bo'lishi mumkin. `test_sessions.bank_version` bilan joriy `question_banks.content_version` solishtirilib:

- versiya mos bo'lsa davom etadi;
- mos bo'lmasa sessiya xavfsiz invalid/refresh holatiga o'tadi;
- foydalanuvchiga tushunarli qayta boshlash xabari ko'rsatiladi;
- natija yozishda eski session yangi savolga aralashmaydi.

### 15.5. Kesh invalidatsiyasi

Hozirgi savol repositorysi taxminan 5 daqiqalik in-memory cache, public endpoint esa `max-age=300`, `s-maxage=600`, `stale-while-revalidate=3600` kabi CDN siyosatiga ega. Faqat kutish yetarli emas.

Rolloutda:

- server cache keyiga `content_version` qo'shish yoki deploydan keyin `invalidateCache()` chaqirish;
- API response/cache keyga bank content versionni bog'lash;
- CDN uchun versioned URL/query yoki aniq purge/deploy strategiyasi;
- yangi content-addressed image pathlar;
- rolloutdan keyin ikki mustaqil clientda yangi versiya ko'rinishini tekshirish

majburiy.

## 16. Bosqich 12 - Backup va rollback

Productiondan oldin:

- `math_db` savollarining to'liq exporti;
- `(external_id,id)` map;
- bank metadata/content_version;
- eski canonical JSON hash;
- image manifest;
- rollback SQL yoki rollback candidate JSON

saqlanadi.

Rollback:

1. old row valuesni mavjud IDlar bo'yicha transactionda update qiladi;
2. content_versionni yana bump qiladi, orqaga kamaytirmaydi;
3. keshni yangi rollback versiyasi bilan invalid qiladi;
4. ID mapping va answer-key hashni tekshiradi;
5. rollback report chiqaradi.

Eski image fayllar promotion vaqtida darhol o'chirilmaydi; kamida rollback oynasi tugaguncha saqlanadi.

## 17. Observability va hisobotlar

Extractor har run uchun quyidagilarni report qiladi:

- source/page/variant/question counts;
- atomlar: total/owned/ignored/unresolved;
- formula AST node counts;
- option layout distribution;
- diagrams added/removed/changed;
- confidence distribution;
- errata usage;
- warning/error list;
- runtime va peak memory;
- input/output hashlar.

Production rollout report:

- old/new content version;
- updated row count;
- unchanged ID count;
- cache invalidation action;
- smoke test natijalari;
- rollback package path/hash.

## 18. Ish ketma-ketligi va har bosqichning Definition of Done'i

### Phase A - Baseline va diagnostika (0.5-1 kun)

- Dirty worktree inventarizatsiya qilindi.
- Mavjud untracked v3 fayllar audit qilindi.
- Deterministik source manifest yaratildi.
- 6 screenshot + 8 eski fixture source PDF bilan aniq transkripsiya qilindi.
- Corruption candidate report yaratildi.

DoD: baseline hashlar to'liq; canonical/DBga write yo'q.

### Phase B - Layout va ownership engine (1.5-2 kun)

- Atom modeli.
- Dynamic header/footer/column/anchor.
- One-atom-one-owner.
- Page/column edge fixturelari.

DoD: barcha 11 040 region topiladi; unresolved ownership 0 yoki aniq review list.

### Phase C - Formula AST (2-3 kun)

- Fraction/root/script/cases/delimiter/function parser.
- Serializer.
- Unit/golden tests.

DoD: 6 screenshot formulalari va stratified fixturelar strict KaTeXda 0 warning/error.

### Phase D - Option va diagramma pipeline (1.5-2 kun)

- Grid-based option parser.
- Donor fallback olib tashlangan.
- Diagram/label classification va content-addressed crop.
- Contact sheets.

DoD: 4 option invariant; crop audit PASS; barcha rasm reviewga tayyor.

### Phase E - Renderer, audit va full-corpus correction (1.5-2.5 kun)

- Explicit delimiter renderer.
- Mustaqil audit.
- 60+ fixture.
- Full candidate extraction va deterministic rerun.
- Manual review queue tozalangan.

DoD: 0 critical, 0 unexplained warning, 0 unresolved.

### Phase F - Rollout va verification (1-1.5 kun)

- Test DB dry-run va real import.
- ID/contentVersion/cache/session testlari.
- Full tests/typecheck/build.
- Tasdiqdan keyin production update.
- Smoke test va rollback tayyorligi.

DoD: production yangi kontentni ko'rsatadi; ID/progress saqlangan; rollout report to'liq.

### Umumiy real baho

- Normal holat: 8-12 ish kuni.
- Layout oilalari yoki source errata ko'p chiqsa: 10-15 ish kuni.
- Faqat regex bilan tez patch qilish 1-2 kun ko'rinishi mumkin, lekin qabul qilinmaydi: u 11 040 savol sifati va regressiyasini isbotlamaydi.

## 19. AI uchun kunlik ishlash protokoli

Har iteratsiyada:

1. `git status --short` va tegishli diffni tekshir.
2. Bir kichik layout/formula muammosini fixture bilan reproduksiya qil.
3. Eng tor mas'ul modulda tuzat.
4. Shu fixture va qarshi negative testni ishlat.
5. Korpus auditidagi kategoriya sonini oldin/keyin solishtir.
6. Yangi warning paydo bo'lmaganini tekshir.
7. Provenance va visual cropni ko'r.
8. Faqat keyin keyingi kategoriya/layoutga o't.

Bir xatoni tuzatish uchun global replace qilinmasin. Har tuzatishning regression testi bo'lishi shart.

## 20. Stop conditions

AI darhol to'xtab, aniq blocker report qilishi kerak, agar:

- source PDF yoki answer DB hashi baselinega mos kelmasa;
- source fayl yetishmasa;
- external ID yoki answer keyni o'zgartirish talab qilinsa;
- productionda missing/extra savol topilsa;
- DB ID mapping o'zgarsa;
- source bosma xatosi uchun inson qarori kerak bo'lsa;
- diagramma labeli va savol matni ownershipi ishonchli ajralmasa;
- canonical fayl yoki production DB tasodifan o'zgargan bo'lsa.

Blocker paytida jim fallback yoki taxmin bilan davom etilmaydi.

## 21. Yakuniy deliverablelar

Vazifa yakunida quyidagilar topshiriladi:

1. `content-banks/matematika/v3/math-print.json`.
2. To'liq `source-manifest.json`.
3. Har output uchun `provenance.ndjson`.
4. Bo'sh `manual-review.json`.
5. Faqat approved yozuvli `source-errata.json`.
6. `audit-report.json` va odam o'qiydigan HTML hisobot.
7. `corruption-candidates.json`, barcha kategoriyalar 0/approved.
8. `public/math-print/v3/` content-addressed rasmlar.
9. Barcha diagrammalar uchun side-by-side contact sheets va review manifest.
10. Kamida 60 ta golden fixture va barcha testlar.
11. Determinism report.
12. DB dry-run, rollout va rollback reportlari.
13. Old/new visual diff.
14. Canonical promotion patch.

## 22. Yakuniy acceptance checklist

```text
[ ] Source PDFs: 13/13 hash verified
[ ] Topics/variants: 368
[ ] Questions: 11 040
[ ] Questions per topic: exactly 30
[ ] External IDs: unchanged, hash matches
[ ] Correct answers: unchanged, hash matches
[ ] Options: exactly 4 from the same source region
[ ] Unknown/orphan/ambiguous eligible atoms: 0
[ ] Header/footer leakage: 0
[ ] Adjacent-question leakage: 0
[ ] ASCII control chars: 0
[ ] Unsupported/raw math commands: 0
[ ] KaTeX strict errors: 0
[ ] KaTeX strict warnings: 0
[ ] Unexplained duplicate options: 0
[ ] Unapproved source errata: 0
[ ] Manual review entries: 0
[ ] Diagram clipping: 0
[ ] Diagram/question-option overlap: 0
[ ] All diagrams visually reviewed
[ ] Golden fixtures: >=60, all pass
[ ] Deterministic double run: pass
[ ] Frontend 320/360/390 px checks: pass
[ ] Full tests/typecheck/build: pass
[ ] Test DB import: pass
[ ] Production ID map before/after: identical
[ ] content_version bumped atomically
[ ] Server/CDN/image cache invalidated/versioned
[ ] Active-session version behavior verified
[ ] Backup and rollback package verified
[ ] Explicit promotion approval received
```

Ushbu checklistdagi bitta band bajarilmasa ham loyiha "tayyor" deb belgilanmaydi.
