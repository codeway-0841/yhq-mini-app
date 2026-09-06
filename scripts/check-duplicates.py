import json
import sys
from collections import defaultdict

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

with open('content-banks/fizika/physics-print.json', 'r', encoding='utf-8') as f:
    bank = json.load(f)

text_to_items = defaultdict(list)
for item in bank['items']:
    q = item['questionUz'].strip()
    text_to_items[q].append(item['externalId'])

duplicates = {k: v for k, v in text_to_items.items() if len(v) > 1}
total_duplicate_occurrences = sum(len(v) for v in duplicates.values())
unique_questions = len(text_to_items)

print(f"Total items in bank: {len(bank['items'])}")
print(f"Unique question texts: {unique_questions}")
print(f"Duplicate question text groups: {len(duplicates)}")
print(f"Total items that have duplicates: {total_duplicate_occurrences}")

# Check breakdown: topic vs umumiy
print("\nSample duplicate occurrences:")
for i, (q, ids) in enumerate(list(duplicates.items())[:10]):
    print(f"{i+1}. \"{q[:70]}...\"")
    print(f"   Occurs {len(ids)} times in: {ids}")
