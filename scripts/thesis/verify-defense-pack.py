"""Check published defense artifacts and render the companion brief for review.

This is a document-integrity check, never a clinical/security/load benchmark.
It does not open the private source manuscript or production clinical records.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import tempfile

sys.path.insert(0, r"C:/Users/garre/AppData/Local/Temp/teleconsole-pdf-deps")
import pymupdf as fitz
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "docs/thesis-defense"
incremental_report = PACK / "evidence/admin-oversight-2026-11-28/pdf-verification.json"
previous_report = PACK / "evidence/appointments-defense-2026-11-27/pdf-verification.json"
report_path = next(path for path in (incremental_report, previous_report, PACK / "evidence/pdf-verification.json") if path.exists())
report = json.loads(report_path.read_text(encoding="utf-8"))
thesis = PACK / "TeleConsole-Revised-259-Pages.pdf"
assert hashlib.sha256(thesis.read_bytes()).hexdigest() == report["output_sha256"]
assert len(fitz.open(thesis)) == 259 and all(report["assertions"].values())
manifest = json.loads((PACK / "revision-manifest.json").read_text(encoding="utf-8"))
if report_path == incremental_report:
    # The current run starts from the verified public copy and preserves every
    # untouched pixel. Its five regions are not the cumulative 48-region history.
    baseline = json.loads(previous_report.read_text(encoding="utf-8"))
    assert baseline["public_copy"] and all(baseline["assertions"].values())
    assert report["source_sha256"] == baseline["output_sha256"]
    selected_manifest = json.loads((PACK / "revision-manifest-2026-11-28.json").read_text(encoding="utf-8"))
    assert {edit["id"] for edit in manifest} == {edit["id"] for edit in baseline["edits"]} | {edit["id"] for edit in selected_manifest}
else:
    assert report["public_copy"]
    selected_manifest = manifest
assert len(report["edits"]) == len(selected_manifest)
assert {edit["pdf_page"] for edit in report["edits"]} == {edit["page"] for edit in selected_manifest}
assert {edit["id"] for edit in report["edits"]} == {edit["id"] for edit in selected_manifest}
for edit in selected_manifest:
    assert next(item for item in manifest if item["id"] == edit["id"])["replacement"] == edit["replacement"]

artifact_report_path = PACK / "evidence/admin-oversight-2026-11-28/artifact-verification.json"
if report_path == incremental_report:
    artifacts = json.loads(artifact_report_path.read_text(encoding="utf-8"))["artifacts"]
    for name, artifact in artifacts.items():
        artifact_path = PACK / name
        assert hashlib.sha256(artifact_path.read_bytes()).hexdigest() == artifact["sha256"], name
        assert len(fitz.open(artifact_path)) == artifact["pages"], name
    bank = (PACK / "panel-questions-and-answers.md").read_text(encoding="utf-8")
    assert list(map(int, re.findall(r"^### (\d+)\.", bank, re.M))) == list(range(1, 101))
    question_pages = artifacts["TeleConsole-Panel-Questions-and-Answers.pdf"]["question_heading_pages"]
    assert set(map(int, question_pages)) == set(range(1, 101))

missing_links = []
for source in PACK.glob("*.md"):
    for match in re.finditer(r"\[[^\]]*\]\(([^)]+)\)", source.read_text(encoding="utf-8")):
        target = match.group(1).split("#")[0]
        if target and not re.match(r"[a-z]+://", target) and not (source.parent / target).exists():
            missing_links.append(f"{source.name}: {target}")
assert not missing_links, missing_links

brief_path = ROOT / "output/pdf/TeleConsole-Capacity-Cost-and-Defense-Team-Brief.pdf"
brief = fitz.open(brief_path)
qa = Path(tempfile.gettempdir()) / "teleconsole-defense-brief-qa"
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
    "current_run_edits": len(selected_manifest), "current_run_physical_pages": sorted({edit["page"] for edit in selected_manifest}),
    "brief_pages": len(brief), "local_markdown_links_valid": True,
    "brief_text_within_margins": True, "thesis_sha256_matches_report": True}, indent=2))
