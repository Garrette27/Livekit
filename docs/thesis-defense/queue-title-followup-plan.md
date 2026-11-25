# Waiting queue and title defense delivery plan

> Native continuation requested by the owner. Preserve the established pack and push directly to main; no new PR or app behavior change.

Goal: give three thesis writers an implementation-grounded explanation of the official title and waiting queue, with a panel Q&A PDF, teaching PDF, editable PowerPoint, and exact minimal manuscript corrections.

Approach: extend the existing teal/white document style. Keep the official title unchanged. Distinguish the study book's title, the institution's thesis title, and the rehearsal pack's label. Use one canonical slide-content JSON with speaker notes for reproducible editable slides. Keep all 259 manuscript pages, original financial amounts and prior privacy masks.

Alternatives considered: a full thesis rewrite would disturb pagination and study results; a generic conferencing deck would conceal implementation limitations. This supplement keeps the existing thesis structure and corrects only unsupported queue/access wording. The owner already requested continuation without another design-selection round.

Files: `waiting-queue-and-title-defense.md`, `panel-questions-and-answers.md`, `queue-title-slides.json`, the two new rehearsal PDFs and editable PPTX in this folder; extend `revision-manifest.json`, page register, README and the verification ledger. Use scripts under `scripts/thesis/` and private rendering intermediates under `tmp/`.

- [x] Verify title and queue policy against current source, with exact paths/hashes and a synthetic capacity-boundary check. No production data or paid load.
- [x] Write the comprehensive rationale, short/team scripts, panel Q&A and slide notes. State capacity/replay/refresh limitations visibly.
- [x] Apply bounded manuscript changes, regenerate public and private copies, verify 259 pages and all unchanged regions.
- [x] Build and inspect every slide and PDF page; validate PPTX structure, editable content, notes, local links and PDF text fit.
- [ ] Review scoped changes, push to main using the authenticated owner account, and distinguish CI/deployment reports from production acceptance.

Review focus: direct admission exception; sorted queue versus guaranteed FIFO; waiting versus granted versus connected; per-invitation target versus atomic/global capacity; doctor invalidation versus patient polling; preservation of private CV/source material and unchanged budget. Existing unique-visit replay isolation remains a release gate. A document correction is not a capacity fix.
