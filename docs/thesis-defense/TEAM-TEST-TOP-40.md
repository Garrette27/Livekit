# Team test plan: prove the top-40 answers before the defense

Use only synthetic accounts: **Doctor** (provisioned), **Patient A** (Google, verified, on the invitation list), **Guest 1–3** (separate incognito windows or browser profiles), and the **Admin** account. Never use real patients. Record each result as PASS / FAIL plus a screenshot in a shared folder.

## Message to send the team

> Hi team — the latest build is on production. Before tonight's rehearsal, please each run your block of the test plan in `docs/thesis-defense/TEAM-TEST-TOP-40.md` (GitHub). Use only the synthetic accounts. For every row, mark PASS/FAIL and attach a screenshot. Writer 3: please run the 1/3/5-pair call trial and fill in the numbers sheet; those numbers go into answer 8. If anything fails, post the row number and a screenshot right away — don't work around it in the demo. Thank you!

## Block A — Writer 1 (title, AI, consent, encounters)

| Q | What to do | Expected truth |
|---|---|---|
| 1, 3 | Walk the title table in Q1 and point to each screen | Each phrase has a visible screen or test |
| 4, 5 | Join a call with patient consent **unticked**, talk, leave; open history | Record says insufficient evidence / no AI draft from the patient's audio |
| 4 | Repeat with both consents ticked, end the call | Draft labelled *AI draft · review required*; Risk can be **Unknown** |
| 6 | With one invitation: consult (A), leave; doctor reopens alone (B); patient returns (C) | Three history rows; the active one shows **Not finalized** while someone is inside |
| 7 | Doctor ticks consent, joins, leaves, rejoins | Consent box is unticked again on rejoin |
| 18 | Send chat messages in a call, check the summary | Chat appears in history, not in the summary text |

## Block B — Writer 2 (security, admission, limits, revocation)

| Q | What to do | Expected truth |
|---|---|---|
| 2, 20 | Admin revokes a test doctor while the doctor has Invitations open; doctor clicks Create/Refresh | The next action fails with "Your access has changed. Please sign in again." |
| 10, 11 | New invitation, limit **2**; Guests 1–2 join; Guest 3 joins | Guest 3 sees "Waiting room is full" |
| 12 | Raise limit to **3**, Guest 3 retries; lower to **2** | Guest 3 now waits; after lowering, nobody is removed |
| 14 | Guest types Patient A's email | Guest waits (typed email is not proof) |
| 14 | Patient A opens the link signed in with Google | Enters directly, even when the queue is full |
| 15 | While waiting, check camera light / browser permission prompt | No camera or microphone use until admitted |
| 26 | Two incognito tabs in the same browser on the same Wi-Fi | Two separate queue rows |
| 27, 35 | Reject Guest 1; Guest 1 reopens the link | Back of the queue, still waiting; Revoke the invitation → link refused |
| 31, 40 | Open `/admin` with the clinic admin account | No Invitations link; cannot open doctor pages; can grant a doctor only in their clinic |
| 34 | Doctor has queue open; Guest leaves and rejoins; doctor clicks Admit on the old row | Conflict message asking to refresh |

## Block C — Writer 3 (numbers, quality, devices, language)

| Q | What to do | Expected truth |
|---|---|---|
| 8, 9 | In a call, open **Call quality** (top-left) and click *Copy measurement* | Shows RTT ms, jitter ms, loss %, received/sent resolution and fps |
| 8 | **Paired-call trial:** run 1, then 3, then 5 doctor–patient pairs on separate devices for 5 minutes each; at minute 4 copy the measurement from one patient device per pair | Fill the sheet below; report the highest level that stayed acceptable |
| 22 | Doctor-booked appointments are off in production | No Appointments link in production; explain the feature flag |
| 23 | Open the doctor room and invitations page on a real phone | No sideways scrolling; queue/session panels open on demand; the camera menu shows full device names |
| 24 | Speech notes with Filipino/Tagalog selected, speak Taglish | Transcript captured; summary in English |
| 39 | Open Consultation History | Summaries appear first; chat transcripts fill in after |
| — | Click **Join as Doctor** and sign in as doctor | Skeleton "Preparing your secure room…" / "Checking your doctor access…" instead of a blank or login screen |

### Paired-call numbers sheet (paste into answer 8)

| Pairs | Network | RTT (ms) | Jitter (ms) | Loss (%) | Received video | Dropped calls |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 3 | | | | | | |
| 5 | | | | | | |

Acceptable = RTT under 300 ms, loss under 2 %, no dropped call, video at least 360p. Report only levels you actually ran.

## Automated evidence anyone can rerun

```bash
npm run typecheck && npm run lint && node --test tests/*.test.mjs && npm run build
```

```bash
firebase emulators:exec --only firestore --project demo-teleconsole "node scripts/thesis/emulator-queue-capacity.mjs"
```
