"""Make bounded thesis copy edits without reflowing or renumbering any page.

The source stays immutable. Each edit selects existing lines by exact normalized
anchors, refuses ambiguous matches or text overflow, and leaves drawings alone.
Verification compares every untouched page and every changed page outside its
approved rectangles at render time. This is not an application/security retest.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata

sys.path.insert(0, r"C:/Users/garre/AppData/Local/Temp/teleconsole-pdf-deps")
import pymupdf as fitz
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
# Same Times face on Windows or from WSL; the font must match the source's.
FONT = next((p for p in (Path("C:/Windows/Fonts/times.ttf"), Path("/mnt/c/Windows/Fonts/times.ttf")) if p.exists()),
            Path("C:/Windows/Fonts/times.ttf"))


def normalized(value):
    # The embedded Windows Times face maps the visible hyphen to soft hyphen.
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).replace("\u00ad", "-")).strip()


def text_lines(page):
    result = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            result.append({"text": normalized("".join(s["text"] for s in line["spans"])),
                           "rect": fitz.Rect(line["bbox"])})
    return sorted(result, key=lambda item: (round(item["rect"].y0, 1), item["rect"].x0))


def locate(page, edit):
    lines = text_lines(page)
    starts = [i for i, line in enumerate(lines) if normalized(edit["start"]) in line["text"]]
    if len(starts) != 1:
        raise ValueError(f"Ambiguous start on page {page.number + 1}: {edit['start']}")
    first = starts[0]
    ends = [i for i in range(first, len(lines)) if normalized(edit["end"]) in lines[i]["text"]]
    if not ends:
        raise ValueError(f"Missing end on page {page.number + 1}: {edit['end']}")
    last = ends[0]
    selected = lines[first:last + 1]
    rect = fitz.Rect(selected[0]["rect"])
    for line in selected[1:]:
        rect |= line["rect"]
    # An explicit cell/paragraph rectangle must never expand to another page.
    rect = fitz.Rect(edit.get("box", [90.024, rect.y0 - .3, 543.2, rect.y1 + 4.0]))
    return rect, " ".join(line["text"] for line in selected)


def raster(page, scale=1):
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--public-copy", action="store_true", help="Redact demo identifiers and personal CV images before GitHub publication")
    parser.add_argument("--date", default="2026-11-27", help="Revision date recorded in the verification report")
    parser.add_argument("--baseline", default="aa041fe", help="Source-review checkpoint for this revision, not proof of active deployment")
    args = parser.parse_args()
    source_hash = hashlib.sha256(args.source.read_bytes()).hexdigest()
    original = fitz.open(args.source)
    document = fitz.open(args.source)
    if len(document) != 259:
        raise ValueError("Expected the approved 259-page thesis")
    edits = json.loads(args.manifest.read_text(encoding="utf-8"))
    approved = {}
    log = []
    failures = []
    for edit in edits:
        page = document[edit["page"] - 1]
        try:
            rect, old_text = locate(original[page.number], edit)
        except ValueError as error:
            failures.append(f"{edit['id']}: {error}")
            continue
        approved.setdefault(page.number, []).append(rect)
        page.add_redact_annot(rect, fill=(1, 1, 1))
        # Keep screenshots, figures, and table lines; remove only selected text.
        page.apply_redactions(images=0, graphics=0, text=0)
        size = edit.get("size", 12)
        remaining = page.insert_textbox(rect, edit["replacement"], fontname="TC_Times",
            fontfile=str(FONT), fontsize=size, lineheight=edit.get("lineheight", 2.0),
            align=edit.get("align", 3), color=(0, 0, 0))
        if remaining < 0:
            failures.append(f"Text overflow ({remaining:.2f}) on page {edit['page']}: {edit['id']} rectangle={list(rect)}")
        log.append({"id": edit["id"], "pdf_page": edit["page"], "printed_page": edit["page"] - 12,
                    "rect": list(rect), "old_text": old_text, "replacement": edit["replacement"],
                    "reason": edit["reason"], "spare_height_pt": remaining, "font_size": size})
    if failures:
        raise ValueError("\n".join(failures))
    privacy_redactions = []
    if args.public_copy:
        # These are privacy masks on the source's screenshots, not clinical or
        # research-result edits. Personal CVs are omitted only in the public copy.
        masks = {99: [(0.03, .02, .40, .09), (.03, .48, .55, .76)],
                 101: [(.36, .59, .72, .72)], 104: [(.35, .21, .72, .30)],
                 105: [(.83, .53, 1.0, .88)]}
        for number in [*masks, *range(249, 260)]:
            page = document[number - 1]
            images = [fitz.Rect(block["bbox"]) for block in original[number - 1].get_text("dict")["blocks"] if block["type"] == 1]
            # Some CVs are split into multiple bitmaps, including a small
            # contact-information footer. Do not redact only the largest one.
            frames = [box for box in images if box.y0 >= 125] if number >= 249 else [max(images, key=lambda box: box.get_area())]
            for frame_index, frame in enumerate(frames):
                approved.setdefault(number - 1, []).append(frame)
                relative_boxes = masks.get(number, [(0, 0, 1, 1)])
                for x0, y0, x1, y1 in relative_boxes:
                    rect = fitz.Rect(frame.x0 + x0 * frame.width, frame.y0 + y0 * frame.height,
                                     frame.x0 + x1 * frame.width, frame.y0 + y1 * frame.height)
                    if number == 255:
                        # Preserve the separate respondent heading over white
                        # space at the top of this particular bitmap.
                        rect.y0 = max(rect.y0, 200.0)
                    page.add_redact_annot(rect, fill=(.93, .94, .94))
                    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS, graphics=0, text=fitz.PDF_REDACT_TEXT_NONE)
                    if number >= 249 and frame_index == 0:
                        page.insert_textbox(fitz.Rect(rect.x0 + 15, rect.y0 + 30, rect.x1 - 15, rect.y1 - 15),
                            "Personal curriculum vitae omitted from the public repository copy.\nThe submitted original remains unchanged.",
                            fontname="tiro", fontsize=12, align=1)
                    privacy_redactions.append({"pdf_page": number, "printed_page": number - 12,
                        "rect": list(rect), "reason": "Personal CV" if number >= 249 else "Demo identity / invitation information"})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    document.save(args.output, garbage=4, deflate=True)
    revised = fitz.open(args.output)
    qa = ROOT / "tmp" / "pdfs" / "defense-qa"
    qa.mkdir(parents=True, exist_ok=True)
    assertions = {"page_count_259": len(revised) == 259,
                  "page_sizes_unchanged": True, "page_labels_unchanged": original.get_page_labels() == revised.get_page_labels(),
                  "bookmarks_unchanged": original.get_toc() == revised.get_toc(),
                  "untouched_pages_pixel_identical": True,
                  "changed_pages_outside_rectangles_pixel_identical": True,
                  "original_unchanged": source_hash == hashlib.sha256(args.source.read_bytes()).hexdigest()}
    thumbnails = []
    outside_differences = []
    for index in range(259):
        before, after = original[index], revised[index]
        assertions["page_sizes_unchanged"] &= before.rect == after.rect
        old_image, new_image = raster(before), raster(after)
        if index in approved:
            raster(after, 1.5).save(qa / f"revised-{index + 1:03}.png")
            raster(before, 1.5).save(qa / f"original-{index + 1:03}.png")
            for rect in approved[index]:
                box = (int(rect.x0) - 2, int(rect.y0) - 2, int(rect.x1) + 3, int(rect.y1) + 3)
                ImageDraw.Draw(old_image).rectangle(box, fill="white")
                ImageDraw.Draw(new_image).rectangle(box, fill="white")
            difference = ImageChops.difference(old_image, new_image).getbbox()
            assertions["changed_pages_outside_rectangles_pixel_identical"] &= difference is None
            if difference:
                outside_differences.append({"page": index + 1, "difference_box": difference})
        else:
            assertions["untouched_pages_pixel_identical"] &= ImageChops.difference(old_image, new_image).getbbox() is None
        thumb = raster(after)
        thumb.thumbnail((153, 198))
        tile = Image.new("RGB", (165, 220), "#e9edf0")
        tile.paste(thumb, (6, 4))
        ImageDraw.Draw(tile).text((7, 204), str(index + 1), fill="black")
        thumbnails.append(tile)
    for start in range(0, len(thumbnails), 48):
        sheet = Image.new("RGB", (8 * 165, 6 * 220), "white")
        for offset, tile in enumerate(thumbnails[start:start + 48]):
            sheet.paste(tile, ((offset % 8) * 165, (offset // 8) * 220))
        sheet.save(qa / f"contact-{start + 1:03}.png")
    for edit in edits:
        actual = re.sub(r"\s+", "", normalized(revised[edit["page"] - 1].get_text()))
        expected = re.sub(r"\s+", "", normalized(edit["replacement"]))
        if expected not in actual:
            raise ValueError(f"Replacement extraction verification failed: {edit['id']}")
    report = {"source_sha256": source_hash, "output_sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
              "baseline": args.baseline, "date": args.date, "assertions": assertions,
              "edits": log, "changed_pages": [i + 1 for i in approved],
              "public_copy": args.public_copy, "privacy_redactions": privacy_redactions,
              "outside_differences": outside_differences,
              "not_performed": ["No provider load trial", "No application tests run by this PDF script", "No production data write", "No survey recalculation"]}
    report_file = ROOT / "output" / "qa" / "defense-revision-verification.json"
    report_file.parent.mkdir(parents=True, exist_ok=True)
    report_file.write_text(json.dumps(report, indent=2), encoding="utf-8")
    if not all(assertions.values()):
        raise ValueError(f"Verification failed: {assertions}")
    print(json.dumps({"pages": len(revised), "edit_count": len(log), "changed_pages": report["changed_pages"], "assertions": assertions}, indent=2))


if __name__ == "__main__":
    main()
