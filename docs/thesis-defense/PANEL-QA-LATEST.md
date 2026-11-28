# Panel Q&A: start here

28 November 2026. Full ranked bank: [panel-questions-and-answers.md](panel-questions-and-answers.md) (100 questions; Q1–Q89 retain their order; old→new numbers in [panel-priority-order-v2-map.json](panel-priority-order-v2-map.json)). Team test plan for the top 40: [TEAM-TEST-TOP-40.md](TEAM-TEST-TOP-40.md). Demo script: [one-day-defense-guide.md §4](one-day-defense-guide.md).

Every answer follows **rule → reason → evidence → boundary**, in 20–40 seconds.

## The ten answers everyone says from memory

1. **Title.** Every phrase maps to something we built and can show: designed and developed (Chapter III → deployed system), secure (layered server-enforced controls, dated automated/security evidence, Security rated *Highly Acceptable* by all four groups), LiveKit video, AI summarization with clinician review, and three flexible ways in. "Secure" is the ISO/IEC 25010 quality we designed and evaluated, not a certification. *(Q1)*
2. **Secure with limitations?** Secure is the objective and the implemented, tested controls; no honest system claims "impossible to attack". Next step for a clinic: independent penetration test and RA 10173 privacy impact assessment. *(Q2)*
3. **What did you build if LiveKit does video?** The clinic workflow around the video: who may enter, who admits, per-encounter records, consented evidence, reviewed AI drafts. *(Q3)*
4. **Does AI diagnose?** No — it drafts from consented transcript evidence; the dentist reviews; no evidence means an *insufficient evidence* record with no AI call. *(Q4, Q5)*
5. **One invitation, several history rows?** An invitation is a door key; an encounter is each time someone walks through the door. FHIR keeps Appointment and Encounter separate; Zoom gives every start of a recurring meeting its own report. Merging would overwrite a reviewed summary and mix visits. *(Q6)*
6. **Consent asked again on rejoin?** Consent belongs to the encounter. Zoom/Teams announce recording every meeting; RA 10173 needs specific consent. One click. *(Q7)*
7. **How many simultaneous consultations?** Provider ceiling 100 connections = 50 pairs; 5,000 participant-minutes ≈ 125 twenty-minute visits a month; our own trial result from the Call quality panel *[fill in]*. *(Q8, Q9)*
8. **How many can wait?** Default 10, doctor sets 1–100, enforced in one transaction. Measured: 25 at once into 10 → exactly 10; 12 waves of 10 into 100 → exactly 100, 18 refused. Raising applies to the next arrival; lowering removes nobody. *(Q10–Q13)*
9. **Revoked doctor?** Cut on the next request: refresh tokens revoked and every protected API checks revocation. An already-open call ends when they leave or are removed. *(Q20)*
10. **Data after 30 days / OpenAI?** Daily opt-in deletion, default 30 days, 200 per run; OpenAI API data is not used for training and is kept up to 30 days for abuse monitoring. Chat is never sent to the AI. *(Q18, Q19, Q21)*

**Encrypted?** Yes. Media and chat are end-to-end encrypted (AES-GCM) in the browser, so LiveKit forwards only ciphertext. The key is released only to consultation credentials, never to waiting visitors. Trial result: an eavesdropper with the wrong key decoded 0 frames. Our own server could derive the key but never receives media. *(Q17)*

## New administration and scheduling answers

- **Three staff entries.** `/doctor/login` is doctor-only, `/admin/login` is clinic-administrator entry, `/super-admin/login` is platform-owner entry. Both administrative levels use the server-scoped `/admin` workspace; a login page never grants a role. *(Q31, Q97)*
- **Proven pattern.** AWS/Azure separate provider control-plane duties from tenant work. We adapt that to clinic-scoped staff administration and separate doctor ownership. Full tenant lifecycle, audit review and business metrics are future work. *(Q28, Q90)*
- **Monitor the service, preserve privacy.** Proposed aggregate invitation/queue/encounter/summary outcomes, quotas and estimated costs; bounded audit pages show actor/action/target/outcome ids. No blanket access to clinical content. Current successful role-change events are narrower, with no audit dashboard. *(Q91–Q96)*
- **Where is scheduling?** Hidden while its default-off server flag is unset. The later module needs rules/indexes, data/contact-retention review and signed-in staging; booking never grants admission. It was not surveyed. *(Q22, Q98)*
- **Evidence.** Source and local checks show only their tested cases; current deployment and authenticated production acceptance need separate proof. The [researched design note](../admin-oversight-design.md) records scope and primary sources. *(Q99)*

**Device menu.** Vendor LiveKit selection/positioning is preserved; toolbar and popup styles are isolated. Real-component browser checks use synthetic devices at 1280/390/320 px; hardware and connected-call acceptance remain separate. *(Q100)*

## Demo order (each step answers a question)

Use separate synthetic identities: doctor entry, clinic admin entry and platform owner entry → `/admin` grant (Q28, Q40) → create invitation, limit 2 (Q10) → guest types patient email and waits (Q14, Q29) → third guest refused, raise to 3 (Q11, Q12) → visit breakdown → verified patient enters directly (Q14) → call with Call quality panel open, reading *End-to-end encrypted* (Q8, Q9, Q17) and consent shown (Q5, Q7) → leave and rejoin to show a second encounter (Q6) → summary draft with Unknown risk (Q4).

## Manuscript

Still 259 pages, with the same title, objectives, survey data and budget. This follow-up revises physical PDF 66/86/98/106/111 (printed 54/74/86/94/99); cumulative changes remain on 37 pages. The page register is [page-change-register.md](page-change-register.md).
