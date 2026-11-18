"""Render the thesis remediation report as a printable, paginated PDF."""
from pathlib import Path
from html import escape
import re
import sys
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter

root = Path(__file__).resolve().parents[2]
source = root / (sys.argv[1] if len(sys.argv) > 1 else 'docs/testing/remediation-report.md')
out = root / (sys.argv[2] if len(sys.argv) > 2 else 'output/pdf/TeleConsole-Security-Remediation-Thesis-Report.pdf')
out.parent.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
styles['Title'].fontName = 'Helvetica-Bold'
styles['Title'].fontSize = 21
styles['Title'].leading = 26
styles['Title'].alignment = TA_LEFT
for name in ['Title', 'Heading1', 'Heading2']:
    styles[name].textColor = colors.black
    styles[name].keepWithNext = True
styles['BodyText'].fontSize = 10.5
styles['BodyText'].leading = 15
styles['BodyText'].spaceAfter = 8
styles['BodyText'].allowWidows = 0
styles['BodyText'].allowOrphans = 0
styles.add(ParagraphStyle(name='Cell', fontName='Helvetica', fontSize=9, leading=12, wordWrap='CJK'))
story = []
lines = source.read_text(encoding='utf8').splitlines()
def text(value):
    return escape(value.replace('`','')).replace('—','-').replace('–','-')
i=0
while i < len(lines):
    line=lines[i].strip()
    if not line:
        i+=1
        continue
    if line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            cells=[c.strip() for c in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r'[- :]+',c) for c in cells):
                rows.append([Paragraph(text(c),styles['Cell']) for c in cells])
            i+=1
        table=Table(rows,colWidths=[155,127,186],repeatRows=1,hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eeeeee')),('GRID',(0,0),(-1,-1),0.4,colors.HexColor('#cccccc')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
        story.extend([table,Spacer(1,12)])
        continue
    if line.startswith('# '):
        story.append(Paragraph(text(line[2:]),styles['Title']))
    elif line.startswith('## '):
        if line == '## References':
            story.append(PageBreak())
        story.append(Paragraph(text(line[3:]),styles['Heading1']))
    else:
        chunk=[line]
        while i+1<len(lines) and lines[i+1].strip() and not lines[i+1].startswith(('#','|','- ')):
            i+=1
            chunk.append(lines[i].strip())
        story.append(Paragraph(text(' '.join(chunk)),styles['BodyText']))
    i+=1
def footer(canvas,doc):
    canvas.setFont('Helvetica',8)
    canvas.setFillColor(colors.HexColor('#555555'))
    canvas.drawString(54,30,'TeleConsole | Security remediation and thesis testing')
    canvas.drawRightString(558,30,str(doc.page))
SimpleDocTemplate(str(out),pagesize=letter,leftMargin=72,rightMargin=72,topMargin=54,bottomMargin=85,title='TeleConsole Security Remediation and Thesis Testing',author='TeleConsole thesis team').build(story,onFirstPage=footer,onLaterPages=footer)
print(out)
