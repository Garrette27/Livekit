# Survey and interview protocol

Updated 18 November 2026. For the teammates running user evaluation. Read
`docs/thesis-team-guide.md` first. The adviser approves the final instruments,
sample sizes and consent form; this document is a ready-to-adapt draft, not a
substitute for that approval.

## 1. What the evaluation must answer

| Thesis objective | Question | Who answers | Method |
| --- | --- | --- | --- |
| Usability (web/HCI) | Can doctors and patients complete a consultation without help, and how usable does it feel? | Patients, doctors | Observed tasks + SUS + TUQ + short interview |
| Security perception and policy fit | Do users understand the waiting room and why a link alone is not identity? Does the design match IT security practice? | Patients, doctors, IT experts | Interview + ISO/IEC 25010 security items |
| Software quality (overall) | How does the system rate on the quality framework the adviser chose? | IT experts | ISO/IEC 25010 evaluation sheet + interview |
| AI documentation | Is the AI draft useful and safe after clinician review? | Doctors only | Fixed fictional transcripts, review time, error count (see section 8) |

Survey scores are **perceptions**. They cannot prove security or measure video
latency. Keep them in their own subsection of Chapter IV, separate from the
automated test results.

## 2. Participant groups

| Group | Who | Suggested size (adviser to confirm) | Account they use |
| --- | --- | --- | --- |
| A. Patients | Adults able to use a smartphone or laptop; mix of ages and tech comfort | At least 15–30 | Join as **guest** (no account). No personal sign-in needed |
| B. Doctors / dentists | Practising or trainee clinicians | At least 5 | A **test doctor account** prepared by the app owner |
| C. IT evaluators | IT staff, developers, IT faculty | At least 5 | A test doctor account (to see the doctor side) and the guest link |

Five to eight participants per group usually reveal most usability problems in
observed testing. SUS and TUQ averages become steadier with larger groups, so
patients are the group to grow if time allows. Report the actual number of
people who completed each instrument; never round up or extrapolate.

## 3. Ethics and data handling (non-negotiable)

- Written informed consent before anything else. Participation is voluntary
  and they may stop at any time. Get the adviser's or ethics committee's
  approval of the consent form if the program requires it.
- **No real health information.** Every consultation is a role-play using a
  fictional scenario card (section 6). Tell participants not to mention their
  own symptoms or anyone's real data.
- Patients join as guests, so their names and emails are not stored in
  Firebase. Ask them to type a pseudonym such as `P07` if a name is requested.
- Doctors and IT evaluators use prepared test accounts, not their own.
- Transcription is optional. Turn it on only in sessions where the
  participant has agreed; the scenario text is fictional either way.
- Store survey answers under participant codes (P01, D01, IT01). Keep the
  code-to-name list separately, offline, and delete it after grading.
- Do not take screenshots that show emails, invitation links or tokens.

## 4. Firebase free-tier plan: when and how to run sessions

The database allows **50,000 reads and 20,000 writes per day** on the free
plan. The counter resets at **midnight US Pacific time = 4:00 p.m.
Philippine/Singapore time** (3:00 p.m. while the US is on daylight saving time,
March to early November). If reads run out, every login fails until the next
reset. That is what happened on 18 November.

### 4.1 Measure before scheduling (pilot day)

1. Right after 4:00 p.m., open Firebase Console → Firestore → **Usage** and
   note the read and write counts. (The chart lags by several minutes.)
2. Run **one complete practice session** with two teammates: doctor login,
   create invitation, patient joins, admit, 10-minute call, end, open history.
3. Wait 15 minutes, then note the counts again. The difference is your
   **reads per session (R)** and **writes per session (W)**.
4. Daily session capacity = the smaller of
   `(50,000 − 10,000 safety margin) ÷ R` and `(20,000 − 4,000) ÷ W`.

Illustrative only: if the pilot showed R = 2,000, capacity would be 20
sessions per day. Use the measured value, and write the measured R and W in
the methodology section; it is a useful, honest performance observation.

### 4.2 Daily schedule

| Time (PH/SG) | Activity |
| --- | --- |
| 4:00 p.m. | Quota resets. Check the Usage tab shows a fresh day |
| 4:15 p.m. | Facilitator logs in as the test doctor once and keeps **one** dashboard tab open |
| 4:30 p.m. – 9:30 p.m. | Sessions every 45 minutes (about 6 sessions) |
| After each session | Glance at Usage; stop for the day at 80% of either limit |
| Morning (before 4 p.m.) | No live sessions. Do interviews, questionnaires on paper/Google Forms, data entry, and AI-documentation reviews that do not need the live app |

If the quota is exhausted mid-day, do not keep retrying logins: each retry
uses more reads. Switch to the paper/interview parts and resume after the reset.

### 4.3 Habits that save reads

- Keep only one doctor dashboard open. Close it between sessions. (Since
  18 November, hidden tabs stop polling, but closed is still better.)
- Do not refresh the History page repeatedly.
- Never run load or speed tests against the live site; those belong on a
  separate staging project.
- Reuse one invitation per session block instead of creating a new one per
  participant, when the scenario allows.

### 4.4 If time is too short for the free tier

The project owner may switch the Firebase project to the **Blaze** pay-as-you-go
plan. It keeps the same free allowance and charges only for usage above it,
but there is no hard spending cap; a budget alert only sends an email. This is
the owner's decision, not the survey team's.

## 5. Session script (about 45 minutes per participant)

| Minutes | Step | Facilitator notes |
| --- | --- | --- |
| 0–5 | Welcome, consent form, participant code | Explain it is a prototype and the scenario is fictional |
| 5–8 | Briefing | Read the task card aloud; do not demonstrate the app |
| 8–25 | Observed tasks (section 6) | Note time, errors and every request for help. Do not help unless they are stuck for 2 minutes; record any help as "assisted" |
| 25–35 | Questionnaires | SUS, then TUQ (patients and doctors) or the ISO/IEC 25010 sheet (IT) |
| 35–45 | Semi-structured interview (section 7) | Audio-record only with consent; transcribe without names |

Two facilitators per session works best: one plays the other side of the call
(doctor or patient), the other observes and times.

## 6. Tasks and fictional scenario cards

### 6.1 Patient tasks (group A)

The facilitator plays the doctor and sends the link.

| # | Task | Success when |
| --- | --- | --- |
| P1 | Open the invitation link you received | The waiting room appears |
| P2 | Read the waiting-room message and explain in your own words what is happening | Participant says they are waiting for the doctor to let them in |
| P3 | Join when admitted; turn camera and microphone on | Both people see and hear each other |
| P4 | Describe the scenario-card symptoms to the doctor | Conversation completes |
| P5 | Send one chat message | Doctor sees it |
| P6 | Leave the consultation | Participant is out of the room |

Scenario card example (fictional): "You are 'Alex', 34. For three days you have
had a mild toothache on the lower left side, worse with cold drinks. No fever.
No medications."

### 6.2 Doctor tasks (group B)

The facilitator plays the patient.

| # | Task | Success when |
| --- | --- | --- |
| D1 | Sign in with the test doctor account | Dashboard appears |
| D2 | Create an invitation valid for 1 hour and copy the link | Link copied; status shows Active |
| D3 | Find the waiting patient and admit them | Patient enters the call |
| D4 | Hold a 5-minute consultation using the scenario card | Call completes |
| D5 | End the call and open the consultation in History | Record is visible |
| D6 | If transcription was on: open the AI summary on the dashboard, correct one item and save | Saving a clinician edit marks the summary reviewed |
| D7 | Revoke the invitation | Status shows Revoked; the link stops working |

### 6.3 IT evaluator tasks (group C)

Do the doctor tasks D1–D3 and D7, then try these checks and record what
happened (expected result in brackets):

- Open the revoked link from step D7 (access denied page).
- Open a link with one character changed (access denied, invalid invitation).
- As a guest, type an allowlisted email if asked (still waits; a typed email
  never grants direct entry).
- Review the Security section of `docs/thesis-team-guide.md` and the test
  results in the brief, then rate the ISO/IEC 25010 sheet.

## 7. Instruments

### 7.1 System Usability Scale (SUS) — patients and doctors

Ten standard statements, 1 (strongly disagree) to 5 (strongly agree). Use the
original wording (Brooke, 1996) and cite it. Scoring: odd items score − 1, even
items 5 − score, sum × 2.5, giving 0–100. About 68 is the commonly cited
average. Report mean, standard deviation and n.

### 7.2 Telehealth Usability Questionnaire (TUQ) — patients and doctors

Parmanto et al. (2016), 21 items on a 7-point scale, covering usefulness, ease
of use and learnability, interface quality, interaction quality, reliability,
and satisfaction and future use. It is designed specifically for telehealth,
which makes it a stronger fit than SUS alone. Report each component's mean.

### 7.3 ISO/IEC 25010 evaluation sheet — IT evaluators

The adviser named ISO/IEC 25010 as the quality framework. Use a 5-point
Likert sheet with 2–4 items per characteristic. The 2011 edition has eight
characteristics: functional suitability, performance efficiency, compatibility,
usability, reliability, security, maintainability, portability. The 2023
revision renames usability to interaction capability and portability to
flexibility, and adds safety. Confirm the edition with the adviser and keep it
consistent. Example security items:

- Users can access only the consultations and records that belong to them.
- An invitation link alone does not let an unknown person into a consultation.
- The system explains clearly why access was denied or delayed.

Write in the paper that this is expert perception, and point to the automated
test results for the measured evidence.

## 8. AI documentation evaluation (doctors, no live call needed)

This can run in the morning without using the live database.

1. Prepare 5–10 **fictional** transcripts of different quality (clear, short,
   mostly silence, off-topic).
2. For each, the doctor writes a manual note and separately reviews the AI
   draft, counter-balancing which comes first.
3. Record: minutes spent, unsupported statements the AI added, important facts
   it missed, wrong speaker attribution, and whether "insufficient evidence"
   appeared for the silent transcript.
4. Report the AI model name and date. Do not claim clinical accuracy beyond
   these cases.

## 9. Interview guides (10 minutes, semi-structured)

**Patients**
1. What did you think was happening while you were in the waiting room?
2. Was anything confusing or worrying when you opened the link?
3. How did you feel about the doctor having to let you in?
4. Would you use this for a real consultation? What would need to change?

**Doctors**
1. How does admitting patients from a queue compare with your current practice?
2. Was the invitation status (active, expired, revoked) clear?
3. Would you trust an AI summary that you must review? What would make you
   reject one?
4. What would stop you from using this in practice?

**IT evaluators**
1. Which security control here do you consider strongest, and which weakest?
2. Is treating the link as a ticket rather than an identity appropriate? Why?
3. What would you require before real patient data is allowed?
4. How should the free-tier database limit be handled in a real deployment?

Analyse interviews with simple thematic coding: two teammates code
independently, compare, and agree on themes. Quote participants only by code.

## 10. Recording results

For each session record: participant code, group, date and time with time
zone, app version (the commit shown in the brief), device and browser, task
outcomes (success / assisted / failed and time), questionnaire scores, any
technical problem (with the time, so it can be matched to logs), and the
Firebase usage before and after. Use PASS, FAIL, BLOCKED, NOT TESTED and
NOT APPLICABLE consistently with the technical results.

If a session fails because of the quota or a bug, record it as BLOCKED with the
reason. Do not drop it; it belongs in the limitations section.
