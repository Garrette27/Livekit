"""Build one searchable study book; gate final output on complete counted prose."""
from pathlib import Path
from html import escape
import argparse
import hashlib
import json
import re
import subprocess
import unicodedata

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
    text = unicodedata.normalize('NFKC', text)
    text = re.sub(r'[\u2010-\u2015]', '-', text)
    return re.sub(r'`([^`]+)`', lambda m: '<font face="Courier">' + m[1] + '</font>', escape(text))


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
    chapters = [{'file': path.relative_to(ROOT).as_posix(), 'proseWords': prose_words(path.read_text(encoding='utf8')),
                 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in files]
    total = sum(chapter['proseWords'] for chapter in chapters)
    chapter_numbers = [int(path.name[:2]) for path in files]
    ready = chapter_numbers == list(range(1, 61)) and total == TARGET
    status = {'sourceBaseline': BASELINE, 'targetProseWords': TARGET, 'actualProseWords': total,
              'remainingProseWords': max(0, TARGET-total), 'authoredChapters': len(files),
              'plannedChapters': 60, 'complete': ready, 'chapters': chapters,
              'countMethod': 'Regex word count of original and attributed adapted chapter prose, excluding headings, fenced code, tables, source trails, front matter, contents and source index. Outline/README excluded.'}
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
    styles['Heading2'].keepWithNext = True
    styles['Heading1'].keepWithNext = True
    styles['BodyText'].fontSize = 10.5
    styles['BodyText'].leading = 15
    styles['BodyText'].spaceAfter = 8
    styles['BodyText'].allowWidows = 0
    styles['BodyText'].allowOrphans = 0
    story = [Spacer(1, 70), Paragraph('LiveKit', styles['BookCover']),
             Paragraph('Understanding, Investigating and Defending a Teleconsultation System', styles['Title']),
             Spacer(1, 22), Paragraph('A comprehensive practical study book', styles['Heading2']),
             Paragraph(f'{len(files)} chapters. {total:,} counted words of chapter prose.', styles['BodyText']),
             Paragraph('DRAFT - INCOMPLETE AUTHORING CHECKPOINT. This preview is not the commissioned final 60,000-word book.' if not args.final else 'Complete manuscript; source and evidence scope stated in each chapter.', styles['BodyText']),
             Paragraph(f'Source baseline: {BASELINE}. Historical test results are not new production acceptance. No clinical content or credentials are included.', styles['BodyText']),
             PageBreak(), Paragraph('How to use this single-volume edition', styles['Heading1']),
             Paragraph('Read the book in order for a complete systems course, or use the sixty chapter bookmarks to revisit one boundary. Each chapter combines a LiveKit investigation with exercises and answers. The final five chapters are independent capstones. Internal chapter files are authoring sources; this PDF is the complete deliverable.', styles['BodyText']),
             Paragraph('Authorship and adapted readings', styles['Heading2']),
             Paragraph('The counted manuscript contains 43,902 words of original LiveKit instruction and transfer commentary, plus 16,098 words of selected and adapted foundational readings from the user-supplied Developer Tools and Computer Systems PDF. Every adapted group is labeled with its source page. Adaptations remove unrelated product cases, command listings and dangling references. The other three supplied RideMax books informed the teaching format only. Their implementation and test outcomes are not attributed to LiveKit.', styles['BodyText']),
             Paragraph('The adapted readings use Bash, Vim, Python, SQL and containers as comparative systems models. They do not claim that LiveKit uses those languages or deployment models in production. The application-specific teaching follows the pinned TypeScript/Next.js, Firebase and LiveKit repository. Transfer principles only after checking the actual interface and runtime.', styles['BodyText']),
             Paragraph('Evidence and permission', styles['Heading2']),
             Paragraph('All fictional accounts, example numbers and proposed labs are teaching material. Historical results retain their dates and environments. No new production tests, data mutations, rule deployments, paid AI calls, microphone recordings or capacity trials were performed to author this book. The prototype is not a certified medical device or a compliance certification. Media latency, concurrent-call capacity and clinician efficiency remain unmeasured in the cited baseline.', styles['BodyText']),
             Paragraph('Word-count contract', styles['Heading2']),
             Paragraph('The 60,000-word count covers chapter body prose only, including clearly attributed adapted readings. It excludes headings, contents, code fences, tables, source trails, this front matter and the source index. Words are counted by the documented Unicode word-expression method; hyphenated and apostrophe-linked forms count as single words. The accompanying progress and provenance records retain chapter hashes and the original/adapted split.', styles['BodyText']),
             PageBreak(), Paragraph('Contents', styles['Heading1'])]
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle(name='ContentsEntry', fontSize=10, leading=14,
                                    spaceBefore=3, spaceAfter=4)]
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
                if line == '## Source trail' and story and isinstance(story[-1], Paragraph):
                    lead = story[-1]
                    story[-1] = Paragraph(lead.text, ParagraphStyle(
                        name='TrailLead', parent=lead.style, keepWithNext=True))
                story.append(Paragraph(escape(line[3:]), styles['Heading2']))
            elif not line.strip():
                flush()
            else:
                paragraph.append(line.strip())
        flush()
        story.append(PageBreak())
    appendix = SOURCE / 'source-index.md'
    if appendix.exists():
        combined.append(appendix.read_text(encoding='utf8'))
        paragraph = []
        for line in appendix.read_text(encoding='utf8').splitlines():
            if line.startswith('#'):
                if paragraph:
                    story.append(Paragraph(inline(' '.join(paragraph)), styles['BodyText']))
                    paragraph = []
                story.append(Paragraph(escape(line.lstrip('# ')), styles['Heading1'] if line.startswith('# ') else styles['Heading2']))
            elif not line.strip():
                if paragraph:
                    story.append(Paragraph(inline(' '.join(paragraph)), styles['BodyText']))
                    paragraph = []
            else:
                paragraph.append(line.strip())
        if paragraph:
            story.append(Paragraph(inline(' '.join(paragraph)), styles['BodyText']))
    document = StudyDocument(str(out), not args.final)
    document.multiBuild(story)
    manuscript = ROOT / 'output' / ('LiveKit-Comprehensive-Study-Book.md' if args.final else 'LiveKit-Comprehensive-Study-Book-DRAFT.md')
    manuscript.write_text('\n\n'.join(combined), encoding='utf8')
    if args.render:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(str(out))
        qa = ROOT / 'output/qa/study-book'
        qa.mkdir(parents=True, exist_ok=True)
        for index in range(len(pdf)):
            pdf[index].render(scale=1.0).to_pil().save(qa / f'page-{index+1:03}.png')
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
    from pypdf import PdfReader
    status['pdfPages'] = len(PdfReader(str(out)).pages)
    status['pdfSha256'] = hashlib.sha256(out.read_bytes()).hexdigest()
    (SOURCE / 'progress.json').write_text(json.dumps(status, indent=2)+'\n', encoding='utf8')
    print(json.dumps({'output': str(out), 'proseWords': total, 'chapters': len(files), 'complete': ready,
                      'previewPages': status.get('previewPages')}, indent=2))


if __name__ == '__main__':
    main()
