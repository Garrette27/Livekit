# TeleConsole defense pack

**Start here (28 Nov 2026, latest):** [PANEL-QA-LATEST.md](PANEL-QA-LATEST.md) · [100 panel answers](panel-questions-and-answers.md) ([PDF](TeleConsole-Panel-Questions-and-Answers.pdf)) · [team test plan for the top 40](TEAM-TEST-TOP-40.md) ([PDF](TeleConsole-Team-Test-Top-40.pdf)) · [demo script](one-day-defense-guide.md).

Prepared 25 November 2026 (Asia/Singapore). Scope: minimally revise the supplied thesis and give three writers a coherent, reproducible explanation of capacity, costs, quality, security and remaining limitations. No examination outcome is guaranteed.

## Latest (28 November 2026) — start here

1. **[PANEL-QA-LATEST.md](PANEL-QA-LATEST.md)** — short rehearsal route, evidence boundaries and current demo. Priority is preparation judgment, not measured panel-question frequency.
2. [One-day guide](one-day-defense-guide.md) — schedule, five-box explanation, objectives→evidence, demo script, slide plan, CCTV answer.
3. [Presentation risk register](presentation-risk-register.md) — what could break the demo and the fallback.
4. [Exact page changes 28 Nov](page-changes-2026-11-28.md) — manuscript pages changed (same 259 pages).
5. [Q&A Q1–Q100](panel-questions-and-answers.md), [number map](panel-question-number-map.md), [current findings/Claude prompt](admin-entry-findings-and-claude-handoff.md) and [attachment plan](attachment-plan.md).

The 28 November source follow-up separates doctor, clinic-admin and platform-owner entry and adds researched administration answers. `/doctor/login`, `/admin/login` and `/super-admin/login` serve different staff audiences; both administrative levels reuse server-scoped `/admin`. The [administrative oversight design](../admin-oversight-design.md) distinguishes current provisioning from future tenant lifecycle, paginated audits and aggregate operating/business views. No new analytics dashboard, production deployment or blanket clinical-data permission is claimed. Doctor-booked scheduling remains default-off and hidden pending release gates; it was not surveyed. This manuscript follow-up changes physical pages 66/86/98/106/111 (printed 54/74/86/94/99). The panel/demo slides retain their earlier checkpoint and are not rebuilt by this update.

## Send these first

For direct browser downloads, use the [download index](DOWNLOADS.md) or [public-safe ZIP](TeleConsole-Public-Defense-Pack.zip). The ZIP uses the redacted manuscript and deliberately excludes the private submission copy and personal appendices.

Current panel/demo supplement: [editable PowerPoint with speaker notes](TeleConsole-Waiting-Queue-and-Title-Defense.pptx), [offline slide handout](TeleConsole-Waiting-Queue-and-Title-Slides.pdf), [teammate teaching PDF](TeleConsole-Waiting-Queue-and-Title-Team-Guide.pdf), [100 panel answers](TeleConsole-Panel-Questions-and-Answers.pdf) and [quick answers](TeleConsole-Panel-Quick-Answers.pdf). Current slide content is [panel-demo-slides.json](panel-demo-slides.json); `queue-title-slides.json` remains a historical source. The official thesis title stays unchanged.

1. [Messenger messages and three-writer briefing](messenger-and-three-writer-brief.md): quickest shared explanation, five-minute emergency version, speaker assignments and reading route.
2. [Exact page-change register](page-change-register.md): printed and physical page numbers, preserved expense total, and separate public-copy privacy redactions.
3. [Revised 259-page public-copy manuscript](TeleConsole-Revised-259-Pages.pdf): same physical page count and existing numbering; original remains untouched. CV images are omitted only in this GitHub copy. Obtain adviser/author approval for the actual academic submission, especially if personal appendices are required.
4. [Offline researched briefing PDF](../../output/pdf/TeleConsole-Capacity-Cost-and-Defense-Team-Brief.pdf): capacity/cost/quality explanation and timed teaching scripts, separate from the manuscript's 259 pages.

## Complete written answers to both requests

- [Capacity, quality, costs and 5/20-minute team scripts](capacity-quality-costs-and-team-scripts.md): LiveKit/Firebase/Vercel limits, regional planning costs, storage, video quality, clinic versus dental scope, one-day preparation, assumptions and misunderstandings.
- [PDF/app revisions, security, RBAC, AI/chat/history load and panel answers](load-security-rbac-and-revision-answer.md): actual implementation corrections, test limitations, doctor provisioning, provider security/load, design patterns, remaining release gates and concise rebuttals.
- [Dated evidence index](evidence/README.md) and [repository verification ledger](../testing/verification-status.md): exact commands, environment and pass/fail scope. Public-price calculations are in [cost-model.json](../testing/evidence/2026-11-25-defense-planning/cost-model.json).

The full pack is reference material, not thirty minutes of compulsory reading. The Messenger brief gives a selected thirty-minute route. The twenty-minute script includes explanation, questions, calculation and teach-back pauses, not twenty minutes of uninterrupted prose.

## Four facts to keep coherent

1. Intended encounter: **one doctor and one patient**. A maximum simultaneous-call capacity has **not been measured**. Published provider ceilings are not our own benchmark.
2. The PHP **7,856.69** development/demonstration expense total is unchanged. Recurring clinic operating scenarios are separate, assumption-based USD estimates with exclusions.
3. Specific local security/operation-count tests passed, not blanket production acceptance. Unique-visit credential/replay isolation is unresolved; real-clinic release is not approved by this pack.
4. AI output is a draft from consented evidence requiring clinician review. Optional AI failure must not prevent a call; displayed chat is not automatically summary-prompt evidence.

## Reproduce the document changes

The immutable source is the user's `TeleConsole_Formatted_SEMI_Final3 (2).pdf`, SHA-256 `82cbc8b27d932cb88364decb66a155f4d19089932154526ef1e936a5cb4c7eb1`. It is intentionally not duplicated in this public folder. The bounded changes are [revision-manifest.json](revision-manifest.json).

On a Windows machine with Python, PyMuPDF, Pillow, ReportLab and the Times New Roman/Arial fonts, use:

```text
python scripts/thesis/revise-defense-thesis.py <source.pdf> docs/thesis-defense/revision-manifest.json docs/thesis-defense/TeleConsole-Revised-259-Pages.pdf --public-copy
python scripts/thesis/build-defense-brief.py
python scripts/thesis/defense-cost-model.py
```

The scripts currently select Windows fonts and the original author's local optional PyMuPDF dependency directory. Install those packages in the interpreter or adjust that documented dependency path on another workstation. The source-inspection helper writes private extracts under `tmp/`; never publish those extracts. Running the revision script without `--public-copy` produces a private copy containing the original personal appendices; do not publish it by accident.

PDF checks cover all 259 pages, extracted replacements, unchanged dimensions/labels/bookmarks, pixel-identical untouched pages, unchanged pixels outside approved regions and original-source integrity. The cumulative manuscript has 48 bounded edits on 37 physical pages. The [current verification](evidence/admin-oversight-2026-11-28/pdf-verification.json) covers the five-page incremental follow-up from the already-redacted public baseline; the private original is unavailable on this workstation. The [incremental manifest](revision-manifest-2026-11-28.json) and report retain exact anchors, baseline hash and rectangles. Earlier reports describe their own historical artifacts. These checks do not turn proposed load tests into results. Application commands and the clean validation snapshot are documented in the evidence index.

The historical 25 November queue audit found a capacity race; the 27 November transaction correction has separate emulator evidence. Do not reuse the earlier failed-capacity statement as the current source result, or treat queue fencing as proof of universal replay isolation. Production authenticated acceptance and provider capacity remain separate from document checks.

To reproduce this incremental document pass, use the exact prior public baseline matching the report's source hash, the 28 November manifest and `revise-defense-thesis.py --date 2026-11-28 --baseline public-pdf-2026-11-27 --report <report.json> --render-dir <private-render-dir>`. Omit `--public-copy` for this already-redacted baseline: its existing privacy masks are preserved. Run `node scripts/thesis/render-panel-qa-pdf.mjs` for the current Q&A/quick/team PDFs. Do not infer that older ZIP, slide or study-book artifacts contain this update.

## Maintenance and publication checklist

At every verified security/performance checkpoint: update the dated evidence, this pack if its facts changed, and the single [verification ledger](../testing/verification-status.md); review the staged privacy/secret scope; commit and push code **with** its changed docs. Never replace a failed baseline with a passing log or carry an old PASS into a different environment. Confirm remote CI separately from production deployment and authenticated acceptance.

Excluded by explicit request: the earlier individual-call inspection is not reproduced in this folder, evidence or commit. No raw production patient records, transcripts, chats, invitation tokens, provider secrets or private CV source images are intended for publication here. Original local files and unrelated AGENTS.md edits are preserved.
