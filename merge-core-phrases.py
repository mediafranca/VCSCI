import json
from pathlib import Path

# List of JSON files in order
files = [
    "core-phrase-list-01-request.json",
    "core-phrase-list-02-reject.json",
    "core-phrase-list-03-direct.json",
    "core-phrase-list-04-accept.json",
    "core-phrase-list-05-interact.json",
    "core-phrase-list-06-express.json",
    "core-phrase-list-07-comment.json",
    "core-phrase-list-08-ask.json"
]

merged = []

for file in files:
    with open(file, "r", encoding="utf-8") as f:
        data = json.load(f)
        merged.append(data)

# Save merged file
output_file = "core-phrase-list-all.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)

print(f"Merged {len(files)} JSON files into {output_file}")