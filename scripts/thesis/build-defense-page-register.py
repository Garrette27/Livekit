"""Derive exact page indexes from the same bounded-edit manifest as the PDF."""
import json
from pathlib import Path

pack = Path(__file__).resolve().parents[2] / 'docs/thesis-defense'
items = json.loads((pack / 'revision-manifest.json').read_text(encoding='utf-8'))
pages = sorted({item['page'] for item in items})
intro = f'''# Exact same-page manuscript changes

28 November 2026. The manuscript remains **259 physical pages**, with the original title, page sizes, numbering, objectives, survey figures and expense amounts unchanged. This register records **{len(items)} bounded substantive edits across {len(pages)} physical pages**. Printed chapter page = PDF page minus 12. This is an editorial supplement, not new study results.

This follow-up changes physical PDF **66, 86, 98, 106 and 111** / printed chapter **54, 74, 86, 94 and 99**: separate doctor, clinic-administrator and platform-owner entry; server role/scope checks; metadata-only administrative oversight as future work; hidden, default-off scheduling release gates; and isolated LiveKit device-menu styles with synthetic browser/hardware boundaries. It adds three bounded regions and revises two existing regions. The cumulative count below includes earlier changes and does not mean 37 pages changed today. These later source changes do not change the original survey results.

The PDF has no machine-readable page-label rules. Printed chapter numbers are visible page text; for these chapter pages the printed value equals physical page minus 12. Do not apply that arithmetic to front matter.

All substantive PDF pages: {', '.join(map(str, pages))}.

## Exact edits

| PDF page | Printed page | Stable edit id | Reason |
| --- | --- | --- | --- |
'''
rows = [f"| {x['page']} | {x['page'] - 12} | `{x['id']}` | {x['reason'].replace('|', '/')} |\n" for x in sorted(items, key=lambda x: (x['page'], x['id']))]
tail = '''
## Verification and privacy

The [current PDF verification](evidence/admin-oversight-2026-11-28/pdf-verification.json) records exact selected rectangles, hashes and all-page checks. The cumulative manifest contains every replacement. The incremental 28 November manifest is `revision-manifest-2026-11-28.json`. Its baseline is the already-redacted public PDF (SHA-256 in the report), because the private original was unavailable on this machine. Earlier privacy masks and substantive edits were preserved; this run did not reprocess private appendices. Historical reports are retained under their original dated folders; their artifact hashes are not current.

Public-copy identifier masks and CV image omissions are additional privacy edits, not changes to the private academic submission. The public copy omits CV images on PDF249-259 and masks selected screenshot identifiers. The private copy remains local. The current public copy retains 259 pages. Expense total 7,856.69 and its component amounts remain unchanged at PDF 94 / printed 82. No objective or Chapter IV survey value is replaced. Advisers/authors must approve the final academic submission.
'''
(pack / 'page-changes-2026-11-28.md').write_text(intro + ''.join(rows) + tail, encoding='utf-8', newline='\n')
(pack / 'page-change-register.md').write_text(intro.split('## Exact edits')[0] + '\nSee the [complete exact table](page-changes-2026-11-28.md), [replacement manifest](revision-manifest.json) and [current all-page verification](evidence/admin-oversight-2026-11-28/pdf-verification.json).\n' + tail, encoding='utf-8', newline='\n')
print(json.dumps({'edits': len(items), 'substantive_pages': len(pages), 'physical_pages': pages}))
