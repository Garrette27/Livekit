"""Render every generated report page for visual quality review."""
from pathlib import Path
import pypdfium2 as pdfium
import sys
root=Path(__file__).resolve().parents[2]
pdf=pdfium.PdfDocument(str(root/(sys.argv[1] if len(sys.argv)>1 else 'output/pdf/TeleConsole-Security-Remediation-Thesis-Report.pdf')))
out=root/(sys.argv[2] if len(sys.argv)>2 else 'output/qa/remediation')
out.mkdir(parents=True,exist_ok=True)
for index in range(len(pdf)):
    pdf[index].render(scale=1.4).to_pil().save(out/f'page-{index+1}.png')
print(f'Rendered {len(pdf)} pages')
