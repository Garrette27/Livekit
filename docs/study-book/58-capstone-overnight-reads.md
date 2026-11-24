# 58. Capstone: a long-lived doctor tab spends reads overnight

## The report is a clue, not a diagnosis

A fictional test team leaves several clinician tabs open after a demonstration. The next morning the database quota is exhausted. Someone blames Firestore listeners; someone else proposes a larger plan. Neither conclusion follows from the symptom alone. Reads may come from periodic HTTP polling, realtime listeners, initial query snapshots, multiple consumers, retries after failure, or unrelated activity. The application may be using an inefficient query even if each tab issues only one request per interval. The next step is to construct an accounting model and then discriminate its terms with isolated measurements.

Do not recreate the incident by leaving production tabs running overnight. That spends real quota and interferes with legitimate use. Work with synthetic staging or an in-process test harness whose dependencies count calls. Set an explicit request budget and stop condition. Distinguish a source-level scheduling test from a billed database experiment. A fake repository can prove that a hidden tab does not initiate refresh work, but it cannot prove the exact number of billable reads that Firestore will charge for a production query.

Start with a timeline: the demonstration begins, tabs mount, invitations are created, patients enter, tabs become hidden, a network failure occurs, and retries begin. Record only operational labels. A count of open windows is not a count of mounted consumers. A page can contain several components that want the same queue projection. Development Strict Mode can also exercise setup and cleanup differently from a production build. Identify the actual run mode before interpreting duplicate work.

## Build the budget before the experiment

For a simple periodic model, requests equal active consumers multiplied by the number of refresh intervals, plus initial loads and event-triggered refreshes. If each request reads a growing archive, database reads can grow much faster than request count. Thus there are at least two separate levers: how often the application asks, and how expensive each answer is. A lower polling rate does not rescue a query that repeatedly scans every expired invitation.

Use a fictional example to expose the arithmetic. Six independent consumers refreshing every fifteen seconds produce twenty-four periodic requests per minute before initial requests, retries or realtime invalidations. Over an hour that is one thousand four hundred forty requests. If a shared service consolidates those consumers into one active refresh lifetime, the periodic request count can fall to two hundred forty for the same hour. These numbers are a model, not measurements of this repository or a prediction of billing.

Then consider visibility. A consumer whose page is hidden need not keep the clinician's visible queue fresh every fifteen seconds. Pausing background polling can save work, while a refresh on return restores currency. But simply pausing a timer is incomplete if an old in-flight response or listener can still trigger follow-up work. Resource lifetime includes timers, event handlers, subscriptions, pending requests and the state that accepts their results. The test must cover those interactions.

## A deterministic lifecycle laboratory

Use a fake clock and counted fetch function. Mount one queue consumer and assert the expected initial request. Advance one interval and assert one refresh. Mount a second consumer for the same scope; verify whether the intended shared service reuses the existing lifetime rather than starting another independent interval. Unmount the first consumer and verify that the second still receives updates. Unmount the last consumer and assert that scheduled work stops.

Now hide the page and advance several intervals. Count requests, not just rendered rows. Show the page and expect the documented refresh behavior. Repeat hide and show rapidly to expose duplicate event registration. A useful stress case performs many mount, hide, show and cleanup cycles, then checks that one active consumer still causes only the intended request rate. Do not claim success merely because the last screen looks correct; leaked timers often preserve a normal appearance while multiplying background work.

Force an in-flight request to finish after its consumer has unsubscribed. Its result must not update a replacement identity or restart a stopped polling lifetime. Then mount a new consumer before the old request resolves. This schedule tests whether a stale cleanup callback accidentally tears down the new subscription. Identity guards matter because cleanup belongs to the resource instance that created it, not to every future resource stored under the same variable name.

Test failure behavior separately. Return a retryable service error, then keep the dependency unavailable. Verify that retries remain bounded and respect the intended delay rather than causing an immediate loop. Return an authorization denial and verify that it is not disguised as transient capacity failure. A client that retries a denied request indefinitely is both confusing and wasteful. A client that turns every unavailable response into an empty queue is quieter but dishonest.

## Query scope and realtime semantics

Inspect the server query after scheduling is understood. The doctor should receive the authorized active projection relevant to the requested room or invitation scope. Realtime events are invalidation hints, not permission to bypass that projection and render an unfiltered collection. If an event says something changed, re-query through the authenticated server boundary. This design can produce an extra refresh, so consolidate simultaneous invalidations and document why a periodic expiry refresh still exists.

Expiry introduces a subtle case: time can change a row's eligibility without a database write. A listener alone may not notify the application when an invitation becomes expired. A modest periodic reconciliation or a scheduled next-expiry refresh can address that semantic gap. Removing every timer to minimize reads may make expired rows remain visibly active. Optimize against the product contract, not a single counter. The desired outcome is correct fresh-enough state within a bounded resource budget.

Check query limits and indexes using synthetic shapes. A limit on returned rows does not automatically mean every possible backend cost is bounded in the same way. Read the current Firestore documentation and the query's actual plan or supported diagnostics before making a billing claim. In a thesis report, state the observed query pattern and measured request/read scope. Avoid a universal guarantee that a certain endpoint always costs exactly one read.

## Interpreting before-and-after results

A useful result separates unit evidence from deployment evidence. For example: “The deterministic lifecycle suite showed no periodic requests while hidden, one shared active schedule for two consumers, and no restart after final cleanup. A staging run then observed the expected bounded HTTP request rate over the declared interval.” That statement does not claim that production quota incidents are impossible. It also does not convert a request count into media capacity.

If the revised application still exhausts quota, preserve the successful scheduling result and investigate the remaining terms. Perhaps there are many users, expensive reads, another worker, or a retry storm on a different route. A partial optimization can be real without being sufficient. Reverting every measured improvement because the global symptom persists would discard evidence. Conversely, declaring the whole incident solved after one unit test ignores system-level consumption.

## Exercise and worked answer

The request count falls by eighty percent, but response latency rises. Did performance improve? The answer depends on the declared goals and tradeoff. Fewer background requests may improve cost and availability while an overly long visible refresh interval makes the queue less responsive. Measure admission freshness separately from read budget. A clinician should not need to guess whether a waiting patient exists because the optimization hid the state too aggressively.

The console shows one listener, yet reads remain high. What should you inspect next? Count initial snapshots, query result size, reconnect behavior, HTTP refreshes and other consumers. The word “listener” is not a cost model. Likewise, one source-level interval can be instantiated multiple times by repeated mounts. Observe instances and effects rather than counting declarations in a file.

The capstone's final artifact is an accounting sheet, a deterministic reproduction and a bounded staging protocol. It should explain the visible freshness guarantee, hidden-page behavior, shared ownership and failure policy. Keep the actual production incident's unresolved terms visible. A design that is cheaper, clearer and correct under repeated lifecycles is defensible even when a separate capacity study remains unmeasured.

## Source trail

Read docs/testing/performance-assessment.md, docs/testing/verification-status.md
and the shared polling/realtime lifecycle tests at the pinned baseline. Inspect
the queue projection and useVisibilityPolling implementation. The arithmetic
and hypothetical counts above are teaching examples, not newly collected
Firestore billing data.
