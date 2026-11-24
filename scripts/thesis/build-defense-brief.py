"""Render the researched team briefing with legible tables and active sources."""
from html import escape
from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parents[2]
FONTDIR = Path("C:/Windows/Fonts")
for name, filename in [("Brief", "arial.ttf"), ("Brief-Bold", "arialbd.ttf"), ("Brief-Italic", "ariali.ttf")]:
    pdfmetrics.registerFont(TTFont(name, str(FONTDIR / filename)))
pdfmetrics.registerFontFamily("Brief", normal="Brief", bold="Brief-Bold", italic="Brief-Italic", boldItalic="Brief-Bold")
styles = getSampleStyleSheet()
for name in ["Title", "Heading1", "Heading2", "BodyText"]:
    styles[name].fontName = "Brief-Bold" if name != "BodyText" else "Brief"
    styles[name].textColor = colors.HexColor("#173141")
styles["Title"].fontSize, styles["Title"].leading = 24, 29
styles["Title"].alignment = TA_LEFT
styles["Heading1"].fontSize, styles["Heading1"].leading = 15, 19
styles["Heading1"].spaceBefore, styles["Heading1"].spaceAfter = 14, 8
styles["Heading2"].fontSize, styles["Heading2"].leading = 11.5, 16
styles["BodyText"].fontSize, styles["BodyText"].leading = 10, 14.4
styles["BodyText"].spaceAfter = 8
styles["BodyText"].allowWidows = styles["BodyText"].allowOrphans = 0
styles.add(ParagraphStyle("Cell", fontName="Brief", fontSize=8.5, leading=11.8, textColor=colors.HexColor("#173141"), splitLongWords=True))
styles.add(ParagraphStyle("CellHead", parent=styles["Cell"], fontName="Brief-Bold", textColor=colors.white))


def markup(raw):
    raw = raw.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-")
    value = escape(raw)
    value = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<link href="\2" color="#126b78"><u>\1</u></link>', value)
    value = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"`([^`]+)`", r"<font name='Brief'>\1</font>", value)
    return value


source = ROOT / "docs/thesis-defense/capacity-quality-costs-and-team-scripts.md"
output = ROOT / "output/pdf/TeleConsole-Capacity-Cost-and-Defense-Team-Brief.pdf"
lines = source.read_text(encoding="utf-8").splitlines()
story = []
width = A4[0] - 102
i = 0
while i < len(lines):
    line = lines[i].strip()
    if not line:
        i += 1
        continue
    if line.startswith("|"):
        raw_rows = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
            if not all(re.fullmatch(r"[- :]+", cell) for cell in row):
                raw_rows.append(row)
            i += 1
        cols = len(raw_rows[0])
        if cols >= 7:
            # Split one wide planning table into two simple, readable tables.
            groups = [[0, 1, 2, 3], [0, 4, 5, 6, 7]]
        else:
            groups = [list(range(cols))]
        for group in groups:
            rows = [[Paragraph(markup(row[col]), styles["CellHead"] if n == 0 else styles["Cell"]) for col in group] for n, row in enumerate(raw_rows)]
            count = len(group)
            ratios = ([.24, .28, .48] if count == 3 else [.25, .25, .25, .25] if count == 4 else [1 / count] * count)
            table = Table(rows, colWidths=[width * r for r in ratios], repeatRows=1, hAlign="LEFT")
            table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#173f4c")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f0f5f6"), colors.white]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -1), .35, colors.HexColor("#c4d2d7")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
            story.extend([table, Spacer(1, 12)])
        continue
    if line.startswith("# "):
        story.append(Paragraph(markup(line[2:]), styles["Title"]))
    elif line.startswith("## "):
        title = line[3:]
        if title.startswith(("Five-minute", "Twenty-minute")):
            story.append(PageBreak())
        story.append(Paragraph(markup(title), styles["Heading1"]))
    elif line.startswith("### "):
        story.append(Paragraph(markup(line[4:]), styles["Heading2"]))
    else:
        chunks = [line]
        while i + 1 < len(lines) and lines[i + 1].strip() and not lines[i + 1].startswith(("#", "|")):
            i += 1
            chunks.append(lines[i].strip())
        story.append(Paragraph(markup(" ".join(chunks)), styles["BodyText"]))
    i += 1


def furniture(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#c4d2d7"))
    canvas.line(51, 43, A4[0] - 51, 43)
    canvas.setFont("Brief", 8)
    canvas.setFillColor(colors.HexColor("#4c6570"))
    canvas.drawString(51, 30, "TeleConsole | Dated planning evidence, not measured capacity | 25 Nov 2026")
    canvas.drawRightString(A4[0] - 51, 30, str(doc.page))
    canvas.restoreState()


output.parent.mkdir(parents=True, exist_ok=True)
SimpleDocTemplate(str(output), pagesize=A4, leftMargin=51, rightMargin=51, topMargin=48, bottomMargin=60,
    title="TeleConsole Capacity, Quality, Costs and Defense Brief", author="TeleConsole thesis team").build(story, onFirstPage=furniture, onLaterPages=furniture)
print(output)
print(f"Source words: {len(source.read_text(encoding='utf-8').split())}")
