"""Check published defense artifacts and render the companion brief for review.

This is a document-integrity check, never a clinical/security/load benchmark.
It does not open the private source manuscript or production clinical records.
"""
import hashlib
import json
from pathlib import Path
import re
import sys

sys.path.insert(0, r"C:/Users/garre/AppData/Local/Temp/teleconsole-pdf-deps")
import pymupdf as fitz
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "docs/thesis-defense"
latest_report = PACK / "evidence/admin-defense-2026-11-27/pdf-verification.json"
report_path = latest_report if latest_report.exists() else PACK / "evidence/pdf-verification.json"
report = json.loads(report_path.read_text(encoding="utf-8"))
thesis = PACK / "TeleConsole-Revised-259-Pages.pdf"
assert hashlib.sha256(thesis.read_bytes()).hexdigest() == report["output_sha256"]
assert len(fitz.open(thesis)) == 259 and all(report["assertions"].values())
assert report["public_copy"]
manifest = json.loads((PACK / "revision-manifest.json").read_text(encoding="utf-8"))
assert len(report["edits"]) == len(manifest)
assert {edit["pdf_page"] for edit in report["edits"]} == {edit["page"] for edit in manifest}
assert {edit["id"] for edit in report["edits"]} == {edit["id"] for edit in manifest}

missing_links = []
for source in PACK.glob("*.md"):
    for match in re.finditer(r"\[[^\]]*\]\(([^)]+)\)", source.read_text(encoding="utf-8")):
        target = match.group(1).split("#")[0]
        if target and not re.match(r"[a-z]+://", target) and not (source.parent / target).exists():
            missing_links.append(f"{source.name}: {target}")
assert not missing_links, missing_links

brief_path = ROOT / "output/pdf/TeleConsole-Capacity-Cost-and-Defense-Team-Brief.pdf"
brief = fitz.open(brief_path)
qa = ROOT / "tmp/pdfs/defense-brief-qa"
qa.mkdir(parents=True, exist_ok=True)
tiles = []
for index, page in enumerate(brief):
    assert page.get_text().strip(), f"Empty brief page {index + 1}"
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            rect = fitz.Rect(line["bbox"])
            assert rect.x0 >= 45 and rect.x1 <= page.rect.width - 45, (index + 1, rect)
            assert rect.y0 >= 15 and rect.y1 <= page.rect.height - 15, (index + 1, rect)
    pix = page.get_pixmap(matrix=fitz.Matrix(1.3, 1.3), alpha=False)
    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    image.save(qa / f"page-{index + 1:02}.png")
    image.thumbnail((245, 347))
    tile = Image.new("RGB", (265, 372), "#e9edf0")
    tile.paste(image, (10, 5))
    ImageDraw.Draw(tile).text((10, 354), str(index + 1), fill="black")
    tiles.append(tile)
for start in range(0, len(tiles), 12):
    sheet = Image.new("RGB", (4 * 265, 3 * 372), "white")
    for offset, tile in enumerate(tiles[start:start + 12]):
        sheet.paste(tile, ((offset % 4) * 265, (offset // 4) * 372))
    sheet.save(qa / f"contact-{start + 1:02}.png")
print(json.dumps({"thesis_pages": 259, "substantive_edits": len(manifest), "substantive_pages": len({edit["page"] for edit in manifest}),
    "brief_pages": len(brief), "local_markdown_links_valid": True,
    "brief_text_within_margins": True, "thesis_sha256_matches_report": True}, indent=2))
