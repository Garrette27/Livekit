# 21. Read Firestore safely through bounded masked observations

## The LiveKit boundary to trace

A current-data audit should request the smallest field set needed for a
decision. Counting lifecycle states does not require names, emails, messages
or transcripts. The existing recon script uses field masks, bounded pages
and aggregate output. It records whether pagination completed, because a
partial scan must not be reported as a complete collection count.

Choose the project and database explicitly. A familiar collection name is
not sufficient evidence that you reached the intended environment. Inspect
database edition and location when they affect the work. Do not provision a
new database or change a project alias merely to inspect an existing system.
Read-only investigation and infrastructure mutation are different authorities.

## A worked investigation

The November snapshot contained stored-active invitations whose expiry times
were already past. The useful conclusion was that effective availability
must consider expiry, not that every such document should be deleted. Queue
rows similarly contained admitted and waiting lifecycle values from older
visits. Those counts did not establish live participants.

For a narrow usage question, request registration and session timestamps,
then aggregate by the relevant timezone. In the earlier follow-up, the profile
field was registeredAt rather than createdAt. A missing createdAt result
therefore could not establish that nobody registered. Verify schema names in
source before interpreting an all-missing field as a product defect.

## Exercise with answer

How should you answer whether anyone used the video feature yesterday?
Separate new profile records, invitation creation, admission events and
session start/end records. State the timezone and window. A session record
can indicate consultation activity, but it does not independently prove audio
or video was exchanged successfully. Transport statistics or an observed
paired journey are needed for that stronger conclusion.

Now inspect a generic recon counter called missingConsentVersion. Is it a
defect on every collection? No. A waiting row or rate-limit record may have no
reason to contain that field. Interpret counters only against the schema
contract of the collection being examined. Automated summaries are useful
instruments, not substitutes for domain meaning.

## Source trail

Read scripts/thesis/firebase-recon.mjs and the dated aggregate evidence. Do
not run production writes merely to learn a field shape. If access is blocked,
record the boundary and continue from repository contracts without inventing
current database facts.
