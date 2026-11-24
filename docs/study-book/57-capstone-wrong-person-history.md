# 57. Capstone: history appears under the wrong person

## The case and its competing explanations

Two fictional students share a test computer. One finishes a synthetic consultation and signs out. The other signs in and sees a history card that looks familiar. The report says that the application “gave one patient's records to another.” That is a serious possibility, but the first investigation must distinguish several mechanisms. The browser may retain a stale projection. The server may query by a mutable email rather than stable account identity. A guest record may have been adopted through a legacy linking path. Two cards may simply share a room title while representing different encounters. A supplied screenshot proves appearance, not the ownership mechanism.

Begin by protecting information, not by collecting more of it. Do not paste the card's names, messages or summaries into an issue. Use synthetic fixtures to recreate the relationship. Record whether the unexpected card contains only a title or actual content from another account. If real disclosure is suspected, follow the project's incident process and restrict further inspection to authorized responders. A student investigation should not browse additional records to estimate the scale casually.

The central invariant is that account-owned history is selected by the authenticated stable identity under the server's policy. A room name is a label and a media routing key, not a patient identifier. A display name is mutable. An email can change and may not be provider verified. A guest room identity proves possession of a scoped session capability, not ownership of every later account that resembles its name. Keep these identities separate throughout the experiment.

## Construct an ownership matrix

Create synthetic accounts Cedar and Maple, one owning clinician, two invitations and three encounter records. One encounter belongs to Cedar, one to Maple, and one is an anonymous guest visit with no account ownership. Give two encounters the same room label deliberately. This makes a weak implementation reveal whether it confuses the room with the visit. Use fictional content that is easy to distinguish, such as a test marker, rather than clinical prose.

Request Cedar's history through the authenticated route and expect only Cedar's owned record, subject to the intended projection. Request Maple's and expect only Maple's. Request without credentials and expect denial. Try a request parameter claiming Cedar's account while authenticated as Maple. The server must not trust that parameter as the principal. If the endpoint accepts a selection parameter at all, authorization must constrain its meaning to the verified caller or an explicitly authorized clinician scope.

Attempt to link the guest encounter merely by presenting a matching email, room label or pending browser session identifier. At the baseline described in this book, the legacy linking endpoint is an authenticated acknowledgement rather than a mechanism for reassignment. Verify that durable ownership does not change. A success-shaped acknowledgement should not be misread as a transfer having happened. Inspect the persistence effect, not only the response's wording.

Now vary account profile fields without changing the stable UID. The selected history should not migrate to another person when a display name changes. Then use two different UIDs whose synthetic profile text is identical. Their histories must remain separate. This pair of tests separates identity from presentation: one identity with changed text, and two identities with matching text. A single happy-path account cannot reveal the distinction.

## Test the browser handover separately

The server can be correct while the browser briefly exposes stale state. Simulate a slow Cedar history request. Sign out, sign in as Maple, and let Maple's request finish before Cedar's delayed response. The old result must not populate Maple's view. Clear or replace the old projection at the identity boundary, and bind each asynchronous response to the request generation and authenticated principal that authorized it.

Inspect caches and subscriptions using labels, not tokens. A cache key containing only “consultations” is suspicious when its value depends on identity. A cache keyed by UID is better, but the component must still stop observing the old key after sign-out. An unsubscribe function existing in source does not prove that it runs. Force the transition and verify that obsolete updates become inert. Also verify that the new account's allowed history remains usable; clearing everything forever would pass a privacy check while breaking the product.

Refresh the page with network available and compare the server response to the rendered cards. If the response contains only Maple's record but the UI shows Cedar's marker, investigate client projection lifetime. If the response itself includes Cedar's record, follow the server query and authorization predicate. If both return the correct distinct records but the titles match, improve interpretation or labeling rather than inventing a security incident. Similar presentation and shared ownership are different claims.

## Encounter isolation and late events

Ownership is not the only boundary. Reusing a room label across visits can connect the wrong lifecycle event to the right person. Create an older encounter and a newer encounter under the same room name. Deliver the older connection's leave event after the newer encounter starts. The event must not finalize or rewrite the newer encounter merely because its room matches. The handler needs the exact encounter binding and the relevant participant relationship.

Likewise, a duplicate-identity media join can replace an old browser connection without ending the shared visit. The older page should detach its local resources and avoid sending a misleading shared finalization command. Test a replacement schedule explicitly: connection A is active, connection B replaces it under the same permitted identity, A receives a disconnect event, and B continues. The durable encounter should reflect the intended continuing visit, not the lifetime of A's page.

These tests belong together because history is the visible result of earlier identity and lifecycle decisions. A correct history query cannot repair an encounter that was assigned incorrectly when created. Conversely, perfectly assigned records can still leak through a broad query. Follow the whole write-and-read path, but keep each finding narrow enough to reproduce independently. One “history bug” label should not hide three distinct defects.

## Design alternatives and their tradeoffs

One tempting design stores every presentation field and trusts it later as ownership evidence. That is convenient for rendering but makes mutable text an authority. Another design stores stable account and encounter references, then derives the display projection. This introduces explicit joins or lookups, but it hides identity rules in a narrow server boundary. The repository favors stable identity and session binding; preserve that direction rather than adding another email-based rescue path.

Legacy records complicate the choice. Do not silently claim them for a newly signed-in account because their email looks familiar. Preserve an honest unowned or unresolved state until an approved reconciliation policy establishes authority. A migration would need a read-only aggregate audit, backup, dry-run counts, idempotency, rollback and explicit approval. The writing task authorizes none of those production mutations. A conservative projection may be less convenient, but convenience is not proof of ownership.

## Independent exercise and worked answer

A teammate proposes adding the current UID to every old row whose email matches the logged-in profile. Why is that unsafe? The matching text may be unverified, reused, stale or self-declared. The operation also turns a read workflow into a broad mutation and may destroy the evidence needed to investigate the original assignment. A proper reconciliation must have stronger authority and a documented scope, not a browser-side heuristic.

Another teammate says that hiding the unexpected card fixes the issue. What remains to prove? The server must deny the same cross-account access directly, and the durable record must retain correct ownership. Test the API without relying on UI navigation. Then test the browser handover to ensure that old results do not appear under a new principal. Hiding a card can be a presentation correction, but it is not the server security boundary.

The final report should state whether the failure was server selection, original assignment, client stale state, lifecycle binding or simply ambiguous labeling. Preserve a minimal synthetic reproduction and positive controls for the intended owner and clinician. Report the source revision and environment. Do not describe a local denial matrix as a deployed incident resolution until the correct artifact has been released and separately verified.

## Source trail

Read docs/identity-and-record-integrity.md, docs/access-control.md and
docs/data-model-readiness.md. Trace app/api/link-patient-consultations/route.ts,
the consultation history route, session creation and late-leave handlers at the
pinned baseline. Synthetic account labels and incident sequences in this chapter
are teaching fixtures, not descriptions of actual patients.
