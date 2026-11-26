# Manuscript pages changed (same 259 pages, same numbering)

Physical PDF page = page in the PDF viewer. Printed page = number at the bottom of the page.
Printed page = physical page − 12 for Chapters I–V (the front matter uses roman numerals).

Rebuilt 27 November 2026 from the original submission with `scripts/thesis/revise-defense-thesis.py`;
all 259 page sizes, labels and bookmarks are unchanged and every page outside the edited boxes is
pixel-identical to the original. Objectives (printed pages 7–8) and Chapter IV survey numbers are not edited.

| PDF page | Printed page | Edit id | What changed and why |
|---|---|---|---|
| 15 | 3 | `intro-current-admission` | The implemented admission never used device, browser or location validation; describe the actual verified-account or doctor-admission policy. Objectives unchanged. |
| 22 | 10 | `capacity-scope` | State an intended encounter size without inventing a concurrent-call result. |
| 27 | 15 | `rrl-bandarra-storage` | Summaries are not ephemeral or patient-restricted; they are stored clinician-reviewed drafts bound to one encounter. |
| 27 | 15 | `rrl-bandarra-transcription` | Transcription runs in short chunks during the call with per-participant consent, not once at session end. |
| 35 | 23 | `rrl-cordero-transport-encryption` | Application-level end-to-end encryption was never enabled; state the actual transport encryption. |
| 54 | 42 | `iso-instrument-labels` | The 2023 model renamed Usability to Interaction Capability and Portability to Flexibility, while Compatibility remains separate; explain the instrument labels without changing the instrument or data. |
| 64 | 52 | `capacity-deployment` | Distinguish documented allowance from measured system capacity; preserve the continuation on the next page. |
| 66 | 54 | `queue-actor-and-summary-scope` | Align the actor description with verified direct entry, clinician admission, disabled attachments and conditional AI finalization. |
| 68 | 56 | `context-inactive-services` | Remove claims that removed geolocation is an active access control. |
| 70 | 58 | `dfd-access` | Align the diagram explanation with actual verified-account admission policy. |
| 71 | 59 | `records-disabled-attachments` | Separate patient history, clinician-only summary content, disabled files, and actual prompt evidence. |
| 71 | 59 | `retention-opt-in` | Do not promise enabled or complete 30-day deletion. |
| 71 | 59 | `stores-logical-not-enabled` | Avoid treating prepared storage paths as operational uploads or SQL constraints. |
| 74 | 62 | `architecture-boundary` | Replace obsolete geolocation and unconditional security/scalability assurance. |
| 75 | 63 | `summary-not-every-call` | Clarify triggers versus eligibility and provider invocation. |
| 77 | 65 | `flow-disabled-attachments` | Correct disabled files, direct admission, and lifecycle trigger description. |
| 81 | 69 | `erd-no-cascade` | Explain document relationships and lack of automatic relational cascade. |
| 82 | 70 | `network-sdk-boundaries` | Correct media topology and disabled direct uploads without claiming a fixed TLS version or E2EE. |
| 83 | 71 | `network-storage` | Distinguish stored records from transported video and inactive storage. |
| 83 | 71 | `network-geolocation` | Preserve figure context while clearly disabling the legacy branch. |
| 85 | 73 | `queue-invite-direct-exception` | Do not imply every valid invitation holder must wait. |
| 86 | 74 | `queue-clinician-navigation` | Describe the actual dashboard and locate queue actions in the invitation and room surfaces. |
| 87 | 75 | `room-features` | Do not advertise disabled uploads or validated group consultations. |
| 88 | 76 | `version-next-materials` | Match the current package manifest major/minor without claiming the deployed runtime. |
| 88 | 76 | `version-react-materials` | Match the current source dependency range. |
| 89 | 77 | `storage-table` | Correct the capability-status table. |
| 89 | 77 | `geolocation-table` | Remove geolocation as an active security mechanism. |
| 90 | 78 | `persistence-stack` | Remove unsupported compliance implications and inactive uploads; preserve next-page continuation. |
| 91 | 79 | `stack-no-compliance-guarantee` | Remove an explicit unsupported compliance/high-performance guarantee. |
| 92 | 80 | `version-next-budget` | Align the budget inventory with the current manifest. |
| 92 | 80 | `version-react-budget` | Align the budget inventory with the current manifest. |
| 93 | 81 | `budget-legacy-geolocation` | Keep the zero-cost development row while identifying an inactive dependency. |
| 94 | 82 | `free-not-unlimited` | Distinguish development estimates from a commercial clinic operating plan. |
| 94 | 82 | `operating-budget-boundary` | Preserve every reported expense and the total; clarify development versus recurring operating costs without inserting new provider prices into the thesis. |
| 95 | 83 | `ai-expense-not-measured-benefit` | An API expense is not evidence of productivity savings. |
| 98 | 86 | `main-entry-no-scheduling` | Scheduling is disabled, and guests wait for admission rather than joining directly. |
| 101 | 89 | `queue-patient-waiting-description` | Clarify the direct-entry exception, manual worklist ordering and admitted-versus-connected semantics without replacing historical screenshots. |
| 102 | 90 | `queue-refresh-implementation` | Correct the claim that the patient waiting spinner demonstrates continuous Firestore-listener synchronization. |
| 103 | 91 | `create-room-allowlist-meaning` | A typed email never bypasses waiting; only a provider-verified signed-in account on the allowlist does. |
| 104 | 92 | `signed-not-encrypted` | JWT signatures protect integrity, not payload confidentiality or patient identity. |
| 105 | 93 | `consent-retention-claim` | Describe the historical screenshot without presenting its retention promise as verified fact. |
| 106 | 94 | `queue-panel-capacity-boundary` | Explain the queue's actual purpose, operational states, per-invitation target and verified non-atomic capacity limitation. Updated 27 Nov 2026: the per-invitation target is now enforced atomically (emulator evidence), so the earlier race disclaimer was removed. |
| 111 | 99 | `integration-current-enabled-scope` | Make the deployment plan consistent with currently enabled features and remaining readiness work. |
| 173 | 161 | `test-recommendation-specific` | Give a reproducible next test without inserting fabricated Chapter IV results. |
| 193 | 181 | `appendix-historical-status` | Explicitly disclose stale security-sensitive appendix code without rewriting or repaginating the appendix. |

Public copy only (not in the private submission): PDF page 99 (demo identifiers masked) and
PDF pages 249–259 (curriculum vitae images omitted).

Files: private `output/pdf/TeleConsole-Revised-259-Pages-Private-Submission.pdf` (not committed),
public `docs/thesis-defense/TeleConsole-Revised-259-Pages.pdf`.
