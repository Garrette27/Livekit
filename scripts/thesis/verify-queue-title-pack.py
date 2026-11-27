"""Verify the queue/title handoff without reading production or private records."""
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from zipfile import ZipFile

sys.path.insert(0, r"C:/Users/garre/AppData/Local/Temp/teleconsole-pdf-deps")
import pymupdf as fitz
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "docs/thesis-defense"
EVIDENCE = PACK / "evidence/appointments-defense-2026-11-27"
EVIDENCE.mkdir(parents=True, exist_ok=True)
QA = ROOT / "tmp/queue-title-pack-qa"
QA.mkdir(parents=True, exist_ok=True)
normalize = lambda value: re.sub(r"\s+", "", unicodedata.normalize("NFKC", value).replace("\u00ad", "-"))
slides = json.loads((PACK / "panel-demo-slides.json").read_text(encoding="utf-8"))
pptx_path = PACK / "TeleConsole-Waiting-Queue-and-Title-Defense.pptx"
ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main", "p": "http://schemas.openxmlformats.org/presentationml/2006/main"}
with ZipFile(pptx_path) as package:
    assert len([p for p in package.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", p)]) == 14
    for number, item in enumerate(slides["slides"], 1):
        note = ET.fromstring(package.read(f"ppt/notesSlides/notesSlide{number}.xml"))
        note_text = " ".join(n.text or "" for n in note.findall(".//a:t", ns))
        assert normalize(item["notes"]) in normalize(note_text), f"Notes missing on slide {number}"
    cover = ET.fromstring(package.read("ppt/slides/slide1.xml"))
    assert normalize(slides["official_title"]) in normalize(" ".join(n.text or "" for n in cover.findall(".//a:t", ns)))
    assert len(ET.fromstring(package.read("ppt/slides/slide4.xml")).findall(".//p:cxnSp", ns)) == 6
    assert len(ET.fromstring(package.read("ppt/slides/slide7.xml")).findall(".//a:tbl", ns)) == 1
receipt = json.loads((ROOT / "tmp/queue-title-deck/validation.json").read_text(encoding="utf-8"))
assert hashlib.sha256(pptx_path.read_bytes()).hexdigest() == receipt["finalSha256"]
assert receipt["packageIntegrity"]["findingCount"] == 0
assert receipt["presentationLayout"]["findingCount"] == 0
assert receipt["firstPartyImport"]["passed"]

panel = (PACK / "panel-questions-and-answers.md").read_text(encoding="utf-8")
assert [int(n) for n in re.findall(r"^### (\d+)\.", panel, re.M)] == list(range(1, 98))
assert set(map(int, re.findall(r"<!-- legacy-question: (\d+) -->", panel))) == set(range(1, 98))
manifest = json.loads((PACK / "revision-manifest.json").read_text(encoding="utf-8"))
assert len(manifest) == 45 and len({edit["page"] for edit in manifest}) == 37
pdf_report = json.loads((EVIDENCE / "pdf-verification.json").read_text(encoding="utf-8"))
assert all(pdf_report["assertions"].values()) and pdf_report["public_copy"]
thesis_path = PACK / "TeleConsole-Revised-259-Pages.pdf"
assert hashlib.sha256(thesis_path.read_bytes()).hexdigest() == pdf_report["output_sha256"]
thesis = fitz.open(thesis_path)
assert len(thesis) == 259
assert normalize(slides["official_title"]) in normalize(thesis[0].get_text())
for number in [66, 71, 75, 85, 86, 101, 102, 106, 111]:
    thesis[number - 1].get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False).save(QA / f"public-manuscript-{number}.png")
for amount in ["7,856.69", "356.69", "3,000.00", "2,000.00", "1,500.00", "1,000.00"]:
    assert amount in thesis[93].get_text(), amount

pdfs = ["TeleConsole-Waiting-Queue-and-Title-Team-Guide.pdf", "TeleConsole-Panel-Questions-and-Answers.pdf", "TeleConsole-Panel-Quick-Answers.pdf", "TeleConsole-Waiting-Queue-and-Title-Slides.pdf"]
counts = {}
for filename in pdfs:
    document = fitz.open(PACK / filename)
    counts[filename] = len(document)
    tiles = []
    for index, page in enumerate(document):
        assert page.get_text().strip(), (filename, index + 1)
        if not filename.endswith("Slides.pdf"):
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    rect = fitz.Rect(line["bbox"])
                    assert 45 <= rect.x0 <= rect.x1 <= page.rect.width - 45, (filename, index + 1, rect)
                    assert 15 <= rect.y0 <= rect.y1 <= page.rect.height - 15, (filename, index + 1, rect)
        pix = page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False)
        picture = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        picture.save(QA / f"{filename[:-4]}-{index + 1:02}.png")
        picture.thumbnail((240, 330))
        tile = Image.new("RGB", (260, 355), "#e9edf0")
        tile.paste(picture, (10, 4))
        ImageDraw.Draw(tile).text((10, 336), str(index + 1), fill="black")
        tiles.append(tile)
    for start in range(0, len(tiles), 12):
        sheet = Image.new("RGB", (4 * 260, 3 * 355), "white")
        for offset, tile in enumerate(tiles[start:start + 12]):
            sheet.paste(tile, ((offset % 4) * 260, (offset // 4) * 355))
        sheet.save(QA / f"{filename[:-4]}-contact-{start + 1:02}.png")
assert counts[pdfs[-1]] == 14
report = {
    "date": "2026-11-27", "source_baseline": "69f9c85", "slide_count": 14, "speaker_notes_verified": 14,
    "editable_admission_connectors": 6, "native_evidence_table_slide": 7, "panel_question_count": 97,
    "pdf_pages": counts, "manuscript_pages": 259, "substantive_edits": 45, "substantive_pages": 37,
    "official_title_unchanged": True, "budget_amounts_unchanged": True, "pdf_text_within_margins": True,
    "first_party_pptx_reimport_passed": True, "pptx_package_findings": 0, "pptx_layout_findings": 0,
    "sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [pptx_path, thesis_path, *[PACK / name for name in pdfs]]},
    "native_powerpoint_application_opened": False,
    "app_behavior_changes": True, "hard_atomic_queue_capacity": "See dated local emulator evidence, not a cloud capacity result", "cloud_media_load": "NOT TESTED",
};
(EVIDENCE / "artifact-verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
