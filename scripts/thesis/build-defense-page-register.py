"""Derive exact page indexes from the same bounded-edit manifest as the PDF."""
import json
from pathlib import Path

pack = Path(__file__).resolve().parents[2] / 'docs/thesis-defense'
items = json.loads((pack / 'revision-manifest.json').read_text(encoding='utf-8'))
pages = sorted({item['page'] for item in items})
intro = f'''# Exact same-page manuscript changes

27 November 2026. The manuscript remains **259 physical pages**, with the original title, page sizes, numbering, objectives, survey figures and expense amounts unchanged. This register records **{len(items)} bounded substantive edits across {len(pages)} physical pages**. Printed chapter page = PDF page minus 12. This is an editorial supplement, not new study results.

This follow-up revises PDF **66, 71, 75 and 106** / printed **54, 59, 63 and 94**: administrator separation; opt-in retention and future attachment cleanup; encounter finalization; responsive consultation context and consent. Retention also remains qualified at PDF **105** / printed **93**. Scheduling remains disabled, as stated at PDF66 and111; the selected doctor-booked design is future work until implementation and testing.

All substantive PDF pages: {', '.join(map(str, pages))}.

## Exact edits

| PDF page | Printed page | Stable edit id | Reason |
| --- | --- | --- | --- |
'''
rows = [f"| {x['page']} | {x['page'] - 12} | `{x['id']}` | {x['reason'].replace('|', '/')} |\n" for x in sorted(items, key=lambda x: (x['page'], x['id']))]
tail = '''
## Verification and privacy

The [current PDF verification](evidence/admin-defense-2026-11-27/pdf-verification.json) records exact selected rectangles, hashes and all-page checks. The manifest contains every replacement. Historical reports are retained under their original dated folders; their artifact hashes are not current.

Public-copy identifier masks and CV image omissions are additional privacy edits, not changes to the private academic submission. The public copy omits CV images on PDF249-259 and masks selected screenshot identifiers. The private copy remains local. Both retain259 pages. Expense total7,856.69 and its component amounts remain unchanged at PDF94 / printed82. No objective or ChapterIV survey value is replaced. Advisers/authors must approve the final academic submission.
'''
(pack / 'page-changes-2026-11-27.md').write_text(intro + ''.join(rows) + tail, encoding='utf-8', newline='\n')
(pack / 'page-change-register.md').write_text(intro.split('## Exact edits')[0] + '\nSee the [complete exact table](page-changes-2026-11-27.md), [replacement manifest](revision-manifest.json) and [current all-page verification](evidence/admin-defense-2026-11-27/pdf-verification.json).\n' + tail, encoding='utf-8', newline='\n')
print(json.dumps({'edits': len(items), 'substantive_pages': len(pages), 'physical_pages': pages}))
