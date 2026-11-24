"""Extract page-addressable thesis text for a bounded, layout-preserving review."""
import argparse
import json
from pathlib import Path
import re

from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("--pages", default="")
parser.add_argument("--index", action="store_true")
args = parser.parse_args()
reader = PdfReader(args.source)
pages = [page.extract_text() or "" for page in reader.pages]
destination = Path(__file__).resolve().parents[2] / "tmp" / "pdfs"
destination.mkdir(parents=True, exist_ok=True)
(destination / "thesis-pages.json").write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
print(f"PHYSICAL PAGES: {len(pages)}")
if args.index:
    pattern = re.compile(r"capac|concurren|participant|scalab|latency|resolution|video quality|frames|bandwidth|cost|pricing|free tier|storage|dental|encrypt|HIPAA|retention|ISO|performance|efficien", re.I)
    for index, page in enumerate(pages, 1):
        hits = [line.strip() for line in page.splitlines() if pattern.search(line)]
        if hits:
            print(f"PDF PAGE {index}: " + " | ".join(hits[:5]))
if args.pages:
    for part in args.pages.split(","):
        bounds = [int(value) for value in part.split("-")]
        for number in range(bounds[0], bounds[-1] + 1):
            print(f"\n===== PDF PAGE {number} =====\n{pages[number - 1]}")
