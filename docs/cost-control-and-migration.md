# Cost control, backup, and moving to another project

Written after the billing account went from $0.18 in July to $66.44 in August
and kept climbing into September. It covers what actually caused that, how to
take a portable backup, how to restore into a different account, and the
settings that stop it recurring.

## What the spike was not

The application was the first suspect, so it was measured before anything was
changed. On 6 September the Firestore database looked like this:

| Collection | Documents |
| --- | ---: |
| `admin-activity-feed` | 1,837 |
| `audit-logs` | 1,837 |
| `rooms` | 206 |
| `invitations` | 198 |
| `waitingPatients` | 143 |
| everything else | < 120 each |

Total: about 5,100 documents and 11 MB. The audit pipeline recorded **zero
events in the previous 24 hours and one in the previous seven days**.

A database that size, that idle, costs cents per month. Firestore's free tier
alone covers 50,000 reads and 20,000 writes per day. Nothing in the application
can produce a $70 bill at this volume, and the recent changes reduced load
rather than added to it — the waiting-queue coordinator collapsed three or four
duplicate pollers into one, and the doctor's queue moved from polling to a
single Firestore listener.

**So the charge is not Firestore, and not the app.** Attributing it to the app
would have led to optimising something that already costs nothing while the
real meter kept running.

## What it almost certainly is

The Cloud Logging entries from 5 August show, under this project:

```
10:42  Cloud Run  CreateService  dry-run-region-validation-xlu8abvubyna
10:43  Cloud Run  CreateService  dry-run-region-validation-cjlu96cpc5zs
10:45  Cloud Run  CreateService  test
10:45  Ready condition status changed to True for Revision test-00001-l9c
10:45  Starting new instance. Reason: MANUAL_OR_CUSTOMER_MIN_INSTANCE
       ... four instances, running the nginx "getting-started-1" container
```

A Cloud Run service named **`test`** was created on 5 August running the Cloud
Run quickstart sample, with **minimum instances configured**. That is what
`MANUAL_OR_CUSTOMER_MIN_INSTANCE` means: the instance did not start because a
request arrived, it started because the service is configured never to scale to
zero.

A Cloud Run service with `min-instances` above zero is billed for reserved CPU
and memory **continuously**, whether or not anyone ever calls it. Four idle
nginx containers left running for a month is exactly the shape of this bill,
and the dates line up precisely: $0.18 for July, the service created 5 August,
$66.44 for August.

This could not be confirmed from here — the Firebase Admin service account is
scoped to Firebase and is refused `run.services.list` — so **verify it before
concluding**, using the steps below.

### Confirm and stop it

1. Open **console.cloud.google.com → Billing → Cost breakdown**, select the
   `livekit-5eef6` project, and group by **Service**. Whatever holds the
   largest slice is the answer; look for *Cloud Run*.
2. Open **console.cloud.google.com/run** and check every region, not just the
   default — the region selector defaults to one region and a service in
   another will not be listed.
3. Delete `test` and any `dry-run-region-validation-*` service. They are
   quickstart leftovers and nothing in this application calls them.
4. Check **Artifact Registry** as well. Deploying to Cloud Run pushes container
   images, and those are billed for storage after the free allowance.

Deleting a Cloud Run service is immediate and stops its charges. It does not
affect Firebase Authentication, Firestore, or the Vercel deployment.

## Take the backup first

Do this before changing billing, closing an account, or deleting anything. A
declined card can lead to project suspension, and a suspended project is a bad
time to discover there is no copy of the data.

```bash
node scripts/firestore-export.js
```

This writes to `C:\Users\garre\firestore-backups\firestore-export-<timestamp>\`
— deliberately **outside the repository**, because this repository is public and
the export contains patient email addresses and consultation content.

It produces one JSON file per collection, including subcollections, plus
`_auth-users.json` and `_manifest.json`. Firestore types (timestamps,
references, geopoints, byte fields) are encoded so they survive JSON and can be
rebuilt exactly.

The 6 September run captured **5,157 documents and 21 auth accounts, 11.05 MB**.

### Why not the managed export?

`gcloud firestore export` writes to a Cloud Storage bucket in the same Google
account, in a proprietary format that only `gcloud firestore import` can read.
That is a fine backup, and one already exists at
`gs://livekit-firestore-backups`. It is a poor **migration** tool, because the
whole point here is to be able to leave the account. The JSON export restores
into any project, including the Firebase emulator.

## Restore into a new project

You can review what an export contains before a target project even exists,
without any credentials:

```bash
node scripts/firestore-import.js --from "<exportDir>" --plan-only
```

Then:

1. Create the new Firebase project. Enable **Firestore** and the sign-in
   providers currently in use (**Email/Password** and **Google**).
2. **Project settings → Service accounts → Generate new private key.** Save the
   JSON somewhere outside the repository.
3. Dry run first — it prints the plan and refuses to run if the target project
   is the same one the export came from:

```bash
node scripts/firestore-import.js --from "C:\Users\garre\firestore-backups\firestore-export-<timestamp>" --creds "C:\path\to\new-service-account.json"
```

4. Apply when the plan looks right:

```bash
node scripts/firestore-import.js --from "<exportDir>" --creds "<newKey.json>" --apply
```

5. Deploy the rules and indexes the data depends on:

```bash
firebase use <new-project-id>
firebase deploy --only firestore:rules,firestore:indexes,storage
```

6. Update the environment variables in Vercel (below) and redeploy.

### Auth accounts need a decision

Passwords cannot be exported — Firebase stores them hashed with a
project-specific key. `_auth-users.json` records every uid, email, provider and
verification state, but restoring identity means one of:

- **Let people sign in again.** Google accounts work immediately. Password
  accounts use "forgot password". Simplest, and fine for a thesis demo.
- **Recreate accounts with the same uid** using `admin.auth().importUsers()`,
  then have password users reset. This matters because **profiles are keyed by
  uid** — see [identity-and-record-integrity.md](./identity-and-record-integrity.md).
  If uids change, every `users/{uid}`, `patientUserId`, and `doctorUserId` in
  the restored data points at nobody.

If you take the first option, plan to re-link the restored data, or accept that
old consultations show as unidentified.

## A new account does not clear the balance

Worth being plain about: the $74.62 is owed on the existing billing account.
Creating a new project or account does not remove it, and Google links payment
profiles by identity and payment method. Settle or dispute the balance with
Google Billing support directly — a spike from an accidentally-provisioned
always-on service is a common and reasonably sympathetic support case.

Move projects for a clean slate and better limits, not to avoid the bill.

## Settings that prevent a repeat

### Google Cloud

1. **Budget and alerts** — Billing → Budgets & alerts → Create budget. Set a
   small monthly amount (say $5) with alerts at 50/90/100%. Alerts are email
   only; they notify, they do not cap.
2. **A hard cap needs automation.** Google has no "stop at $X" switch. The
   documented pattern is a budget with a Pub/Sub topic and a Cloud Function
   that calls `projects.updateBillingInfo` to detach billing. Deliberate and
   destructive — everything stops — so use it only as a true backstop.
3. **Quotas** — IAM & Admin → Quotas. Cap Cloud Run's CPU allocation for the
   project so a stray service cannot reserve capacity.
4. **Cost anomaly detection** — Billing → Anomalies. On by default; make sure
   its notifications reach an address that is actually read.
5. **Delete unused projects.** The billing account also has a `notely` project
   attached. If it is unused, unlink or delete it.

### Firebase

- **Never leave `min-instances` above zero** on anything created while
  exploring. That single setting converts a free, scale-to-zero service into a
  continuously billed one.
- The Cloud Functions in this project are fine: seven Firestore triggers and a
  daily retention job, all scale-to-zero, effectively free at this volume.
- **Blaze is required** for this app (Cloud Functions and outbound calls to
  OpenAI and LiveKit need it), so downgrading to Spark is not an option while
  the functions are deployed.

### Vercel

Vercel is not the source of this bill — it bills separately from Google — but
the same accident is possible there:

1. **Settings → Billing → Spend Management.** Set a spend amount and enable
   **Pause deployments** when it is reached. This is a genuine cap, which
   Google does not offer.
2. **Settings → Functions → set a low default max duration.** The consultation
   routes that need longer already declare `maxDuration = 60` in code.
3. **Turn off deployment protection bypass** for preview builds if it is on;
   each preview is a live deployment that can be crawled.
4. **Delete unused preview deployments.** They are cheap but not free at scale.
5. Keep the **log drain** decision in mind: Axiom's free tier is fine, but a
   paid drain bills per GB, and the structured request logging added earlier
   emits one line per API request.

### The habit that matters most

Check **Billing → Cost breakdown, grouped by service** once a week. This bill
ran for roughly 30 days before it was noticed. A weekly glance would have
caught it on day two, when it was worth about $2.

## Files

| Path | Purpose |
| --- | --- |
| `scripts/firestore-export.js` | Portable JSON export of every collection, subcollection, and auth account |
| `scripts/firestore-import.js` | Restores an export into a different project; dry run by default, `--plan-only` needs no credentials, and it refuses to write back into the project the export came from |
| `C:\Users\garre\firestore-backups\` | Where exports are written; outside the repository on purpose |
