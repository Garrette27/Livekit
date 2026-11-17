"""Render every generated report page for visual quality review."""
from pathlib import Path
import pypdfium2 as pdfium
root=Path(__file__).resolve().parents[2]
pdf=pdfium.PdfDocument(str(root/'output/pdf/TeleConsole-Security-Remediation-Thesis-Report.pdf'))
out=root/'output/qa/remediation'
out.mkdir(parents=True,exist_ok=True)
for index in range(len(pdf)):
    pdf[index].render(scale=1.4).to_pil().save(out/f'page-{index+1}.png')
print(f'Rendered {len(pdf)} pages')
