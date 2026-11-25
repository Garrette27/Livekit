# Waiting-queue/title follow-up evidence

25 November 2026, Asia/Singapore. Source baseline `9d53610`; application code, rules, dependencies and existing app tests are unchanged by this checkpoint. No production clinical reads/writes, paid AI calls, media capture or cloud load were performed.

## Verified observations

| Item | Result | Evidence boundary |
| --- | --- | --- |
| Capacity pre-check race | REPRODUCED; hard atomic-capacity guarantee NOT PASSED | `source-audit.json`: actual source with synthetic adapters, nine waiting rows, target ten, two arrivals, final eleven; no production incident or maximum overshoot claim |
| Invitation-use count | Two increments for two successful reservations in that fixture | Atomic use counting does not prove atomic waiting-slot accounting |
| Official thesis title | Retained verbatim | Read from original manuscript physical page 1; the study book's teaching title remains separate |
| Manuscript | PASS document checks, 259 pages | `pdf-verification.json`: 38 bounded edits on 31 pages, including six new queue corrections; original source, sizes, numbering/labels/bookmarks and outside-region pixels preserved |
| Financial amounts | Preserved | All six project amounts/total explicitly checked on physical page 94; no new clinic-price substitutions |
| PowerPoint | 14 editable slides, all 14 notes verified | Package and geometry checks have zero findings; Artifact Tool re-import passes; native admission connectors and race-example table present |
| Companion PDFs | 6-page teaching guide, 5-page Q&A, 14-page slide handout | Text/margin checks plus visual review; 32 numbered questions verified |
| Lint and authoring syntax | PASS | `lint.log`; Node syntax checks and Python compile checks also pass |
| Unique-visit replay isolation / measured media maximum | UNRESOLVED / NOT TESTED | No new acceptance claim; prior policy/CI passes retain their original source and scope |

`artifact-verification.json` records content counts, title/financial checks and artifact hashes. The initial 32-edit manuscript report at `../pdf-verification.json` is historical for the PDF at commit `25cd516`; the new report here matches the current updated manuscript. Git history preserves the earlier PDF. The private local submission copy retains original personal appendices and is not committed.

## Reproduction

Run from the repository root with Node 22 and existing dependencies:

```text
node scripts/thesis/audit-queue-contract.mjs
npm run lint
node --check scripts/thesis/audit-queue-contract.mjs
node --check scripts/thesis/build-queue-title-deck.mjs
```

The source audit's assertions deliberately reproduce a known failing product invariant. A zero exit means the *reproduction* matched its fixture, not that the product capacity guarantee passed. Do not weaken that distinction in a presentation. Fixing the app should add contention/reconnect/release regressions and replace the dated finding through a new checkpoint rather than relabeling this historical result.

Document commands, with Python/PyMuPDF/Pillow/ReportLab and the documented Windows fonts/runtime:

```text
python scripts/thesis/revise-defense-thesis.py <original.pdf> docs/thesis-defense/revision-manifest.json docs/thesis-defense/TeleConsole-Revised-259-Pages.pdf --public-copy --baseline 9d53610
python scripts/thesis/build-defense-brief.py --source docs/thesis-defense/waiting-queue-and-title-defense.md --output docs/thesis-defense/TeleConsole-Waiting-Queue-and-Title-Team-Guide.pdf --title "TeleConsole Waiting Queue and Title Team Guide"
python scripts/thesis/build-defense-brief.py --source docs/thesis-defense/panel-questions-and-answers.md --output docs/thesis-defense/TeleConsole-Panel-Questions-and-Answers.pdf --title "TeleConsole Panel Questions and Answers"
node scripts/thesis/build-queue-title-deck.mjs
python scripts/thesis/verify-queue-title-pack.py
python scripts/thesis/verify-defense-pack.py
```

The presentation builder uses the bundled `@oai/artifact-tool`, not python-pptx. It selects Arial as a design choice and retains editable text/diagrams/table plus notes. Its private finalizer runs on native Windows temporary storage because the WSL UNC bridge does not support the required hard link, then copies the validated bytes to the repository artifact. Runtime locations can be supplied with `TELECONSOLE_RUNTIME` and `TELECONSOLE_PRESENTATION_SKILL`. PowerPoint desktop itself was not opened; no native application rendering claim is made.

During authoring, missing finalizer runtime-path configuration and the WSL hard-link limitation caused infrastructure failures. The builder now supplies the documented runtime paths and native temporary validation location. It did not bypass structural/layout/re-import checks. Automated checks do not prove semantic accuracy: the source audit, exact title/page comparison and human visual review are separate checks.

All fourteen slide renders were inspected individually. The six new manuscript pages and both new document PDFs were inspected after rendering. The public copy retains demo/CV privacy masks; raw original extracts, private PDF, QA screenshots, temporary payloads and unrelated local artifacts remain uncommitted. No earlier individual-call inspection is added.

## Publication and continuation

Publish this document set with its changed scripts, artifacts, source audit and verification ledger as one coherent direct-main checkpoint. Record the remote SHA/CI receipt separately after publication. A Ready deployment reported by the owner or GitHub is deployment evidence, not an application-load, privacy, clinical or complete-security acceptance result.

Next unfinished app work: atomically enforced waiting capacity, immutable visit-bound grants, hidden waiting preflight/device review, bounded archive queries and authenticated staging acceptance before controlled paired-media trials. This task documents those boundaries and does not implement them.
