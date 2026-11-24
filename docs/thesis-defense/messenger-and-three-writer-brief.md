# Messenger handoff and three-writer rehearsal

25 November 2026. These messages summarize the two full answers in this folder. They do not replace the limitations or evidence. Send one short message at a time; do not ask teammates to read a technical report in a Messenger bubble.

## Message 1: send now

Team, may minimal revision tayo sa TeleConsole thesis. Same 259 pages and same numbering. Hindi binago ang expense amounts or PHP 7,856.69 total. Clarified lang na project/development expenses iyon, hindi guaranteed monthly bill ng clinic. May page-change list sa `docs/thesis-defense/page-change-register.md`. Public GitHub PDF masks demo identifiers and omits CV images; original private PDF is unchanged. Adviser approval pa rin for the final submission copy.

## Message 2: the capacity answer everyone must agree on

Equivalent ng “ilang CCTV?” natin: “ilang simultaneous doctor-patient consultations, at anong delivered video quality, devices/network, database/AI load, at walang record/access errors?” Intended encounter natin = 1 doctor + 1 patient. **Hindi pa measured ang maximum simultaneous calls.** LiveKit's published free ceiling is 100 connected endpoints, 5,000 participant-minutes/month and 50 GB downstream. Hindi ibig sabihin nito tested na tayo for 50 simultaneous appointments. One 20-minute call with two people = 40 participant-minutes; 125 visits is time-only math, not measured capacity. Bandwidth can run out earlier.

## Message 3: security and AI

Google login proves account/email control, not a medical license or doctor privilege. Trusted provisioning + server role/ownership checks ang authority. Invitation link is signed, not identity proof. Summary is an AI draft requiring clinician review. It uses consented transcript evidence; displayed chat is NOT automatically in the summary prompt. Empty/poor evidence can produce deterministic “insufficient evidence” without calling AI. Revoke/leave is not an unconditional OpenAI billing switch. Optional AI failure must not break the call.

## Message 4: what we actually tested

May new local tests for sender-only chat saving, same-message retry deduplication, wrong-principal denial, old-buffer/queue safety, bounded history reads and rate refusals. Those are synthetic/local implementation tests, not a real cloud concurrent-video benchmark. May remaining unique-visit credential/replay isolation issue, so **do not say full production security acceptance passed**. Need fresh visit-bound credentials and staging acceptance before unrestricted clinic use. History has limits, not unlimited lifetime pagination. Chat delivery and durable saving are separate.

## Message 5: costs and what to read

Don't remove our internet/travel/documentation costs. Separate prototype project budget from recurring clinic operations. Example only: 440 visits/month × 20 minutes × two people at assumed 1.7 Mbps gives 17,600 participant-minutes and 224.4 GB. Published LiveKit Ship + one Vercel Pro seat gives about USD 70 base modeled subtotal before AI, other usage, backup, support, taxes and our local expenses. Hindi ito complete business quote. Full calculations and sources are in `capacity-quality-costs-and-team-scripts.md`; current app/security explanation is in `load-security-rbac-and-revision-answer.md`.

## What to send as attachments / links

Send the revised 259-page **public-copy** PDF, this short briefing, and `page-change-register.md` first. Then send the companion researched briefing PDF for offline reading. The two full Markdown answers are the reproducible source of the explanations. Use GitHub file links rather than screenshots of patient history. Do not share raw invitation tokens, real clinical chats, CV contact details, provider keys or the excluded earlier individual-call inspection.

## Exactly three writers: ownership and backup

| Writer | Primary part | Must also be able to answer |
| --- | --- | --- |
| 1: research/methodology | Problem, dental scope, questionnaire versus objective measurements, unchanged budget, limitations | Why no measured max exists and why we did not fabricate one |
| 2: system/security | Architecture, provisioning, ownership/admission, consent/evidence, demo, known unique-visit gap | Why Google login is not a doctor license and AI is not clinical authority |
| 3: capacity/economics | Participant-minute and bandwidth calculations, database/AI load, pricing assumptions, evidence index | Why 100 endpoints is not our own measured 50-pair result |

Have one writer answer and another add only the missing boundary. Avoid three inconsistent numerical claims. If an account-specific limit is unavailable, say it was not verified rather than substituting the public plan number as account evidence.

## Five-minute emergency briefing

Minute 1: problem and scope. TeleConsole supports the studied dental teleconsultation workflow, not every medical specialty or physical examination. One doctor and one patient is the intended encounter. The formal questionnaire is perceived quality evidence, not a concurrency benchmark.

Minute 2: architecture. Browser UI asks the backend; backend verifies role/ownership/invitation. LiveKit carries media. Firestore stores domain records/text. OpenAI assists documentation from consented evidence. These four responsibilities have different limits and costs.

Minute 3: capacity math. Twenty minutes times two endpoints equals forty participant-minutes. Five thousand divided by forty equals 125 time-only visits. A modeled 1.7 Mbps stream each way uses about 0.51 GB per visit, so fifty GB is roughly 98 visits before overhead. Neither number is concurrent-call evidence.

Minute 4: security and failure. Link is not identity. Google is not doctor approval. The server decides. AI draft needs review, and the call works without it. Explain that different-principal denial improved but unique-visit binding is still a release blocker. Never answer “fully secure” or “unlimited.”

Minute 5: honest evidence and next steps. Local/regression/emulator checks establish specified implementation behavior. Real paired-call load, measured audiovisual delay and clinician time savings are not newly measured. Next: isolated staging, synthetic accounts, repeated 1/3/5-pair trials, predefined quality/correctness criteria, then report the highest tested passing row. Budget is preserved, not relabeled as a clinic quote.

## Twenty-minute rehearsal

Use the timed script in the main researched brief: minutes 0-3 scope; 3-6 four responsibilities/meters; 6-9 capacity math; 9-12 cost exclusions; 12-15 quality/storage/retention; 15-18 panel role-play; 18-20 teach-back and corrections. Writer 2 adds the unique-visit and archive-durability limitations from the current answer. The teaching script includes questions and pauses; its word count is not a claim of twenty minutes of continuous speech.

## Thirty-minute reading route

Spend approximately 15 minutes on the main brief's capacity, budget, video and one-day-plan sections; 10 minutes on the follow-up's app changes, remaining visit boundary, chat/history and AI/RBAC sections; and five minutes on the page register plus the Q&A table. Reading speed varies. The full two-answer pack is deliberately longer for reference; do not claim everyone can carefully read every word in thirty minutes. In rehearsal, make each writer explain a calculation, a security boundary and an unperformed test without looking.

## Two statements to avoid at the panel

Do not say “our app supports 100 patients simultaneously” or “we passed load testing because the PDF says so.” Say: “The provider publishes an endpoint ceiling; our application maximum is not yet experimentally established. Here is our intended use, exact local evidence, remaining release gates and controlled measurement protocol.”

Do not say “we will definitely pass.” The goal is accurate, coherent evidence and a functioning bounded demonstration, not a guaranteed grade or evasive rebuttal.
