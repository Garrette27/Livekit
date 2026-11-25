# TeleConsole defense downloads

Published 26 November 2026 (Asia/Singapore). These are the existing reviewed defense materials packaged for easier downloading. This publication introduces no application change or new security/load acceptance result.

## Download the public-safe pack

[Download all shareable defense files as a ZIP](https://github.com/Garrette27/Livekit/raw/refs/heads/main/docs/thesis-defense/TeleConsole-Public-Defense-Pack.zip)

The archive includes the redacted 259-page manuscript, editable PowerPoint with notes, panel Q&A, teammate teaching guide, slide handout, comprehensive capacity/cost briefing, full written answers, page-change register and this index. It also includes SHA-256 fingerprints for its contents.

## Individual downloads

- [259-page public manuscript PDF](https://github.com/Garrette27/Livekit/raw/refs/heads/main/docs/thesis-defense/TeleConsole-Revised-259-Pages.pdf)
- [Panel questions and answers PDF](https://github.com/Garrette27/Livekit/raw/refs/heads/main/docs/thesis-defense/TeleConsole-Panel-Questions-and-Answers.pdf)
- [Editable PowerPoint with speaker notes](https://github.com/Garrette27/Livekit/raw/refs/heads/main/docs/thesis-defense/TeleConsole-Waiting-Queue-and-Title-Defense.pptx)
- [Waiting-queue and title teammate guide PDF](https://github.com/Garrette27/Livekit/raw/refs/heads/main/docs/thesis-defense/TeleConsole-Waiting-Queue-and-Title-Team-Guide.pdf)
- [Slides as a PDF](https://github.com/Garrette27/Livekit/raw/refs/heads/main/docs/thesis-defense/TeleConsole-Waiting-Queue-and-Title-Slides.pdf)
- [Comprehensive capacity, costs and defense briefing PDF](https://github.com/Garrette27/Livekit/raw/refs/heads/main/output/pdf/TeleConsole-Capacity-Cost-and-Defense-Team-Brief.pdf)

## Full written answers

- [Capacity, quality, pricing and timed teammate scripts](capacity-quality-costs-and-team-scripts.md)
- [AI, chat/history load, security, RBAC and revision explanation](load-security-rbac-and-revision-answer.md)
- [Messenger messages and three-writer briefing](messenger-and-three-writer-brief.md)
- [Exact revised page numbers and reasons](page-change-register.md)
- [Panel questions and answers source](panel-questions-and-answers.md)
- [Waiting queue and official-title rationale](waiting-queue-and-title-defense.md)

## Private submission copy

This is a public GitHub repository. The private 259-page submission manuscript and private local ZIP contain original personal appendices and are deliberately not uploaded here. Obtain them through the authorized authors' private handoff and adviser review. The public manuscript preserves 259 pages but replaces personal CV images with omission notices and masks selected screenshot identifiers. It is not interchangeable with the private submission copy when an institution requires those appendices.

The official title, pagination and financial amounts are unchanged. Provider quotas are not measured application capacity. The documented atomic waiting-capacity and unique-visit isolation gaps remain unresolved; this packaging does not establish production or clinical acceptance.

Rebuild the archive with `python scripts/thesis/build-public-defense-download.py` from the repository root. The builder uses an explicit allowlist and rejects changed tracked inputs rather than accidentally including private files or local evidence.
