# 28 November document integrity evidence

Local source/document review only. No production write, feature enablement or deployment was performed by this document update. Application checks are recorded separately in `docs/testing/evidence/2026-11-28-device-login/`.

- `pdf-verification.json`: exactly 259 thesis pages; source hash is the previously verified/redacted 27 November public copy. Physical pages 66, 86, 98, 106 and 111 changed, corresponding to printed chapter pages 54, 74, 86, 94 and 99. All other pages are pixel-identical; pixels outside approved regions, page dimensions, page-label rules, bookmarks and source integrity passed. All five renders were visually reviewed.
- `artifact-verification.json`: current artifact hashes, page counts and all 100 question heading locations. Full Q&A 18 pages; quick answers 2; unchanged top-40 plan rerendered to 3 pages. New questions Q90 on page 16; Q91–Q96 on page 17; Q97–Q100 on page 18. Q100 answer remains on page 18. New Q&A pages 16–18 were visually reviewed, and 16 external HTTPS links remain clickable.
- The cumulative manifest has 48 bounded regions across 37 pages. This run has five regions, including revisions to two earlier regions and three added regions. The incremental manifest uses the already-redacted public baseline; it does not require or expose the private manuscript source.

Final document check:

```sh
PYTHONPATH=/tmp/teleconsole-pdf-deps python3 scripts/thesis/verify-defense-pack.py
```

It passed the exact current hashes, 259-page count, incremental/cumulative manifest provenance, 100-question numbering, local Markdown links and historical 14-page companion-brief margins. Python syntax and renderer JavaScript syntax passed. Verifier renders now go to the operating-system temporary directory. PDF raster review used temporary local files only. Earlier ZIP and slides remain their dated checkpoint and were not republished.

The thesis script used installed Times New Roman, PyMuPDF 2.2 and Pillow 13. The Q&A renderer used Playwright 1.58.2 with the already-installed Chromium 1223 executable override. Chromium needed the approved unsandboxed local launch because the sandbox denied its startup socket; this was a rendering environment requirement, not a website/deployment action.
