"""Verify the commissioned manuscript's length, provenance and navigable PDF.

This checks the document artifact, not application security or production state.
Visual page review remains a separate required human/agent inspection.
"""
from pathlib import Path
import collections
import hashlib
import json
import re
import sys

from pypdf import PdfReader
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[2]
spec = spec_from_file_location('book_builder', ROOT / 'scripts/thesis/build-study-book.py')
builder = module_from_spec(spec)
spec.loader.exec_module(builder)
chapters = sorted((ROOT / 'docs/study-book').glob('[0-9][0-9]-*.md'))
total = sum(builder.prose_words(p.read_text(encoding='utf8')) for p in chapters)
duplicates = collections.defaultdict(list)
missing = []
suspect = []
for path in chapters:
    text = path.read_text(encoding='utf8')
    for paragraph in text.split('\n\n'):
        if len(paragraph.split()) > 25 and not paragraph.startswith('#'):
            duplicates[re.sub(r'\s+', ' ', paragraph).strip()].append(path.name)
    trail = text.split('## Source trail')[-1]
    for candidate in re.findall(r'(?:lib|app|tests|scripts|docs|hooks|components)/[\w/.*-]+\.(?:ts|tsx|mjs|md|json)', trail):
        if '*' not in candidate and not (ROOT / candidate).exists():
            missing.append({'chapter': path.name, 'path': candidate})
    if re.search(r'eyJ[A-Za-z0-9_-]{30,}|ya29\.[A-Za-z0-9_-]+|-----BEGIN .*PRIVATE KEY|[A-Za-z0-9._%+-]+@(?:gmail|yahoo|outlook)\.com', text):
        suspect.append(path.name)
pdf_path = ROOT / 'output/pdf/LiveKit-Comprehensive-Study-Book.pdf'
reader = PdfReader(pdf_path)
texts = [p.extract_text() or '' for p in reader.pages]
destinations = [reader.get_destination_page_number(item) for item in reader.outline]
toc_links = sum(len(p.get('/Annots', [])) for p in reader.pages[2:5])
toc_targets = {annotation.get_object()['/Dest'][0].idnum
               for page in reader.pages[2:5] for annotation in page.get('/Annots', [])
               if '/Dest' in annotation.get_object()}
chapter_start_matches = all(str(i+1)+'.' in texts[n][:250] for i,n in enumerate(destinations))
provenance = json.loads((ROOT / 'docs/study-book/provenance.json').read_text(encoding='utf8'))
result = {
    'chapterCount': len(chapters), 'chapterProseWords': total,
    'provenanceWordSum': provenance['originalLiveKitCoreWords'] + provenance['originalTransferCommentaryWords'] + provenance['adaptedFoundationalWords'],
    'pdfPages': len(reader.pages), 'chapterBookmarks': len(reader.outline),
    'searchablePages': sum(bool(t.strip()) for t in texts),
    'duplicateLongParagraphs': [v for v in duplicates.values() if len(v) > 1],
    'missingSourcePaths': missing,
    'pdfSha256': hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
    'replacementGlyphPages': [i+1 for i,t in enumerate(texts) if '\ufffd' in t or '\u25a0' in t],
    'suspectedCredentialOrPersonalEmailFiles': suspect,
    'contentsLinks': toc_links,
    'distinctContentsChapterDestinations': len(toc_targets),
    'bookmarksReachChapterStarts': chapter_start_matches,
    'scope': 'Document verification only; not new application, production or clinical acceptance.',
}
result['pass'] = (len(chapters) == 60 and total == 60000 and result['provenanceWordSum'] == total
                  and len(reader.outline) == 60 and result['searchablePages'] == len(texts)
                  and not result['duplicateLongParagraphs'] and not missing and not result['replacementGlyphPages']
                  and not suspect and len(toc_targets) == 60 and chapter_start_matches)
(ROOT / 'docs/study-book/document-qa.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf8')
print(json.dumps(result, indent=2))
sys.exit(0 if result['pass'] else 1)
