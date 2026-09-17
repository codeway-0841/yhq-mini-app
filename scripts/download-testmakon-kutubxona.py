import os
import sys
import json
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "content-banks", "testmakon", "kutubxona"))
SCRATCH_BOOKS = r"C:\Users\PC\.gemini\antigravity\brain\2bb113f1-eb39-4736-bab6-c09a4873a333\scratch\books.json"

os.makedirs(BASE_DIR, exist_ok=True)

with open(SCRATCH_BOOKS, "r", encoding="utf-8") as f:
    books = json.load(f)

print(f"Total books to process: {len(books)}")
print(f"Target directory: {BASE_DIR}")

def download_file(url, target_path, retries=3, timeout=30):
    if not url:
        return False, 0, "No URL"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    temp_path = target_path + ".part"

    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                expected_size = resp.headers.get('Content-Length')
                expected_size = int(expected_size) if expected_size else None
                
                # Check if target already exists with correct size
                if os.path.exists(target_path) and expected_size and os.path.getsize(target_path) == expected_size:
                    return True, os.path.getsize(target_path), "Cached"

                with open(temp_path, 'wb') as out_f:
                    downloaded = 0
                    while True:
                        chunk = resp.read(65536)
                        if not chunk:
                            break
                        out_f.write(chunk)
                        downloaded += len(chunk)

                # Verify size if expected_size was known
                if expected_size and downloaded != expected_size:
                    raise Exception(f"Size mismatch: downloaded {downloaded} != expected {expected_size}")

                if os.path.exists(target_path):
                    os.remove(target_path)
                os.rename(temp_path, target_path)
                return True, downloaded, "Downloaded"
        except urllib.error.HTTPError as e:
            if e.code == 404:
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except:
                        pass
                return False, 0, f"HTTP 404 Not Found"
            time.sleep(attempt * 2)
        except Exception as e:
            if attempt == retries:
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except:
                        pass
                return False, 0, str(e)
            time.sleep(attempt * 2)

    return False, 0, "Max retries exceeded"

def process_book(b, idx, total):
    grade_dir = os.path.join(BASE_DIR, b["grade_name"])
    os.makedirs(grade_dir, exist_ok=True)
    
    slug = b["slug"]
    
    # 1. Cover
    cover_ext = ".webp"
    if ".png" in b["cover_url"]:
        cover_ext = ".png"
    elif ".jpg" in b["cover_url"] or ".jpeg" in b["cover_url"]:
        cover_ext = ".jpg"
        
    cover_filename = f"{slug}-cover{cover_ext}"
    cover_target = os.path.join(grade_dir, cover_filename)
    
    c_ok, c_size, c_msg = download_file(b["cover_url"], cover_target)
    
    # 2. PDF
    pdf_filename = f"{slug}.pdf"
    pdf_target = os.path.join(grade_dir, pdf_filename)
    
    p_ok, p_size, p_msg = download_file(b["pdf_url"], pdf_target)
    
    rel_cover = os.path.relpath(cover_target, BASE_DIR).replace("\\", "/")
    rel_pdf = os.path.relpath(pdf_target, BASE_DIR).replace("\\", "/")
    
    status_str = f"[{idx:3d}/{total}] {b['grade_name']} | {b['title']}"
    if p_ok and c_ok:
        print(f"OK: {status_str} (PDF: {p_size/(1024*1024):.1f}MB, Cover: {c_size/1024:.0f}KB)")
    elif c_ok and not p_ok:
        print(f"PARTIAL (PDF 404): {status_str} (Cover: {c_size/1024:.0f}KB)")
    else:
        print(f"FAILED: {status_str} (PDF: {p_msg}, Cover: {c_msg})")

    return {
        **b,
        "cover_local": rel_cover if c_ok else None,
        "cover_downloaded": c_ok,
        "cover_size_bytes": c_size,
        "pdf_local": rel_pdf if p_ok else None,
        "pdf_downloaded": p_ok,
        "pdf_size_bytes": p_size,
        "pdf_status": p_msg,
        "cover_status": c_msg
    }

def main():
    start_time = time.time()
    results = []
    total = len(books)
    
    # Download with ThreadPoolExecutor (8 concurrent workers)
    print(f"\n--- Starting download with 8 parallel workers ---\n")
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(process_book, b, i+1, total): b for i, b in enumerate(books)}
        for fut in as_completed(futures):
            results.append(fut.result())
            
    # Sort results by grade and title
    results.sort(key=lambda x: (int(x["grade_name"].split("-")[0]) if "-" in x["grade_name"] else 99, x["title"]))
    
    catalog_path = os.path.join(BASE_DIR, "catalog.json")
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
        
    # Generate README summary
    total_downloaded_pdfs = sum(1 for r in results if r["pdf_downloaded"])
    total_downloaded_covers = sum(1 for r in results if r["cover_downloaded"])
    total_pdf_bytes = sum(r["pdf_size_bytes"] for r in results)
    total_cover_bytes = sum(r["cover_size_bytes"] for r in results)
    elapsed = time.time() - start_time
    
    readme_path = os.path.join(BASE_DIR, "README.md")
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("# TestMakon Kutubxonasi — Darsliklar va Muqovalar\n\n")
        f.write(f"- **Yuklangan sana:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- **Jami kitoblar:** {len(results)} ta\n")
        f.write(f"- **Yuklangan PDF darsliklar:** {total_downloaded_pdfs} / {len(results)} ta ({total_pdf_bytes / (1024**3):.2f} GB)\n")
        f.write(f"- **Yuklangan muqovalar:** {total_downloaded_covers} / {len(results)} ta ({total_cover_bytes / (1024**2):.2f} MB)\n")
        f.write(f"- **Umumiy sarflangan vaqt:** {elapsed / 60:.1f} daqiqa\n\n")
        
        missing_pdfs = [r for r in results if not r["pdf_downloaded"]]
        if missing_pdfs:
            f.write("### Saytda PDF fayli mavjud bo'lmagan darsliklar:\n\n")
            for m in missing_pdfs:
                f.write(f"- **{m['grade_name']}** — {m['title']} ({m['href']}) [Server status: {m['pdf_status']}]\n")
            f.write("\n*(Izoh: Ushbu kitoblarning sahifasida yuklab olish tugmasi yo'q yoki server 404 qaytargan, faqat muqovalari yuklandi)*\n\n")
            
        f.write("## Sinflar bo'yicha taqsimot\n\n")
        f.write("| Sinf | Kitoblar soni | PDF mavjud | Muqova mavjud |\n")
        f.write("| :--- | :---: | :---: | :---: |\n")
        
        grades = {}
        for r in results:
            g = r["grade_name"]
            if g not in grades:
                grades[g] = {"total": 0, "pdf": 0, "cover": 0}
            grades[g]["total"] += 1
            if r["pdf_downloaded"]:
                grades[g]["pdf"] += 1
            if r["cover_downloaded"]:
                grades[g]["cover"] += 1
                
        for g, counts in grades.items():
            f.write(f"| {g} | {counts['total']} | {counts['pdf']} | {counts['cover']} |\n")

    print("\n==========================================")
    print(f"Download complete in {elapsed/60:.1f} minutes!")
    print(f"PDFs: {total_downloaded_pdfs}/{len(results)} ({total_pdf_bytes / (1024**3):.2f} GB)")
    print(f"Covers: {total_downloaded_covers}/{len(results)} ({total_cover_bytes / (1024**2):.2f} MB)")
    print(f"Catalog saved to: {catalog_path}")
    print(f"README saved to: {readme_path}")
    print("==========================================")

if __name__ == "__main__":
    main()
