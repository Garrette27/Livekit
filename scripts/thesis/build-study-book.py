"""Build a clearly labelled study-book checkpoint; gate final output on real prose length."""
from pathlib import Path
from html import escape
import argparse
import hashlib
import json
import re
import subprocess

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, Preformatted
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/study-book'
TARGET = 60000
BASELINE = 'c43b76f08886e8fc329d815c3ae3254d185656dd'


def prose_words(text):
    """Exclude fenced code, headings and source trails rather than inflate the target."""
    text = re.sub(r'```.*?```', '', text, flags=re.S)
    text = text.split('## Source trail')[0]
    lines = [line for line in text.splitlines() if not line.lstrip().startswith(('#', '|'))]
    return len(re.findall(r"\b[\w]+(?:['-][\w]+)*\b", '\n'.join(lines)))


def inline(text):
    return re.sub(r'`([^`]+)`', lambda m: '<font face="Courier">' + escape(m[1]) + '</font>', escape(text))


class StudyDocument(BaseDocTemplate):
    """One pagination owner supplies running furniture, bookmarks and TOC notifications."""
    def __init__(self, filename, draft):
        super().__init__(filename, pagesize=A4, leftMargin=54, rightMargin=54,
                         topMargin=59, bottomMargin=55, title='LiveKit: Understanding, Investigating and Defending a Teleconsultation System',
                         author='LiveKit thesis study edition')
        self.draft = draft
        self.heading_number = 0
        self.addPageTemplates(PageTemplate(id='body', frames=[Frame(self.leftMargin, self.bottomMargin,
                              self.width, self.height, id='text', leftPadding=0, rightPadding=0,
                              topPadding=0, bottomPadding=0)], onPage=self.decorate))

    def decorate(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor('#526274'))
        canvas.setFont('Helvetica', 8)
        canvas.drawString(54, A4[1]-33, 'LIVEKIT / SYSTEMS STUDY')
        canvas.drawRightString(A4[0]-54, A4[1]-33, 'AUTHORING CHECKPOINT' if self.draft else 'STUDY EDITION')
        canvas.setStrokeColor(colors.HexColor('#D9E1E8'))
        canvas.line(54, 42, A4[0]-54, 42)
        canvas.drawString(54, 29, f'Source baseline {BASELINE[:7]} | 24 November 2026')
        canvas.drawRightString(A4[0]-54, 29, str(doc.page))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == 'Chapter':
            self.heading_number += 1
            key = f'chapter-{self.heading_number}'
            title = flowable.getPlainText()
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(title, key, 0, False)
            self.notify('TOCEntry', (0, title, self.page, key))

    def beforeDocument(self):
        self.heading_number = 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--final', action='store_true')
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args()
    files = sorted(SOURCE.glob('[0-9][0-9]-*.md'))
    chapters = [{'file': str(path.relative_to(ROOT)), 'proseWords': prose_words(path.read_text(encoding='utf8')),
                 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in files]
    total = sum(chapter['proseWords'] for chapter in chapters)
    chapter_numbers = [int(path.name[:2]) for path in files]
    ready = chapter_numbers == list(range(1, 61)) and total >= TARGET
    status = {'sourceBaseline': BASELINE, 'targetProseWords': TARGET, 'actualProseWords': total,
              'remainingProseWords': max(0, TARGET-total), 'authoredChapters': len(files),
              'plannedChapters': 60, 'complete': ready, 'chapters': chapters,
              'countMethod': 'Regex word count excluding headings, fenced code, tables and source trails. Outline/README excluded.'}
    (SOURCE / 'progress.json').write_text(json.dumps(status, indent=2)+'\n', encoding='utf8')
    if args.final and not ready:
        raise SystemExit(f'FINAL BLOCKED: {len(files)}/60 chapters; {total:,}/{TARGET:,} prose words.')
    out = ROOT / 'output/pdf' / ('LiveKit-Comprehensive-Study-Book.pdf' if args.final else 'LiveKit-Comprehensive-Study-Book-DRAFT.pdf')
    out.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='Chapter', fontName='Helvetica-Bold', fontSize=23, leading=29,
                              textColor=colors.HexColor('#14344B'), spaceAfter=22, keepWithNext=True))
    styles.add(ParagraphStyle(name='BookCover', parent=styles['Chapter'], fontSize=36, leading=42))
    styles['Heading2'].fontSize = 13
    styles['Heading2'].leading = 17
    styles['Heading2'].spaceBefore = 13
    styles['Heading2'].spaceAfter = 7
    styles['BodyText'].fontSize = 10.5
    styles['BodyText'].leading = 15
    styles['BodyText'].spaceAfter = 8
    styles['BodyText'].allowWidows = 0
    styles['BodyText'].allowOrphans = 0
    story = [Spacer(1, 70), Paragraph('LiveKit', styles['BookCover']),
             Paragraph('Understanding, Investigating and Defending a Teleconsultation System', styles['Title']),
             Spacer(1, 22), Paragraph('A comprehensive practical study book', styles['Heading2']),
             Paragraph(f'{len(files)} of 60 chapters authored. {total:,} of at least {TARGET:,} prose words.', styles['BodyText']),
             Paragraph('DRAFT - INCOMPLETE AUTHORING CHECKPOINT. This preview is not the commissioned final 60,000-word book.' if not args.final else 'Complete manuscript; source and evidence scope stated in each chapter.', styles['BodyText']),
             Paragraph(f'Source baseline: {BASELINE}. Historical test results are not new production acceptance. No clinical content or credentials are included.', styles['BodyText']),
             PageBreak(), Paragraph('Contents', styles['Heading1'])]
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle(name='ContentsEntry', fontSize=11, leading=17, spaceBefore=10)]
    story.extend([toc, PageBreak()])
    combined = []
    for path in files:
        text = path.read_text(encoding='utf8')
        combined.append(text)
        lines = text.splitlines()
        paragraph = []
        def flush():
            if paragraph:
                story.append(Paragraph(inline(' '.join(paragraph)), styles['BodyText']))
                paragraph.clear()
        for line in lines:
            if line.startswith('# '):
                flush()
                story.append(Paragraph(escape(line[2:]), styles['Chapter']))
            elif line.startswith('## '):
                flush()
                story.append(Paragraph(escape(line[3:]), styles['Heading2']))
            elif not line.strip():
                flush()
            else:
                paragraph.append(line.strip())
        flush()
        story.append(PageBreak())
    document = StudyDocument(str(out), not args.final)
    document.multiBuild(story)
    manuscript = ROOT / 'output' / 'LiveKit-Comprehensive-Study-Book-DRAFT.md'
    manuscript.write_text('\n\n'.join(combined), encoding='utf8')
    if args.render:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(str(out))
        qa = ROOT / 'output/qa/study-book'
        qa.mkdir(parents=True, exist_ok=True)
        for index in range(len(pdf)):
            pdf[index].render(scale=1.2).to_pil().save(qa / f'page-{index+1:03}.png')
        from PIL import Image, ImageOps, ImageDraw
        for start in range(0, len(pdf), 6):
            sheet = Image.new('RGB', (900, 870), 'white')
            draw = ImageDraw.Draw(sheet)
            for offset in range(min(6, len(pdf)-start)):
                page = Image.open(qa / f'page-{start+offset+1:03}.png')
                page.thumbnail((285, 400))
                x, y = (offset % 3)*300, (offset // 3)*435
                sheet.paste(page, (x, y))
                draw.text((x+8, y+407), str(start+offset+1), fill='black')
            sheet.save(qa / f'contact-{start//6+1:02}.png')
        status['previewPages'] = len(pdf)
    print(json.dumps({'output': str(out), 'proseWords': total, 'chapters': len(files), 'complete': ready,
                      'previewPages': status.get('previewPages')}, indent=2))


if __name__ == '__main__':
    main()
