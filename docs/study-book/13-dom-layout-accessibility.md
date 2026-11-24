# 13. Use Elements and accessibility state to inspect the actual interface

## The LiveKit boundary to trace

The DOM, computed styles and accessibility tree reveal different aspects of
the same interface. A button can exist in the DOM yet be off screen, covered,
disabled or missing an accessible name. A visually prominent message can fail
to announce an important state change. The investigator should identify which
representation is relevant to the user's difficulty rather than treating one
screenshot as a complete interface audit.

LiveKit's responsive room shell must preserve the ability to join and leave,
check devices and understand connection state. Side panels can become mobile
surfaces rather than fixed desktop columns. When testing a small viewport,
inspect the actual hit targets, focus order and scroll ownership. A panel that
looks compact can still trap keyboard navigation or hide the action needed
to return to the call.

## A worked investigation

Use a local synthetic consultation page and inspect the waiting-room message.
Find the accessible name of its sign-in action and the status text describing
why the patient waits. Then change only viewport size and compare whether the
same action remains reachable. This is a layout and interaction experiment,
not a test of allowlist identity. Keep admission policy fixtures constant so
you do not confuse a changed server decision with a hidden control.

For invitation cards, prefer named actions such as View queue over a clickable
card containing nested buttons. The latter creates ambiguity for pointer and
keyboard users: clicking a child can trigger a parent action unless event
ownership is carefully designed. An explicit action makes intent visible and
reduces the amount of event choreography needed to maintain the interface.

## Exercise with answer

A copied invitation shows an inline success message but focus remains on the
copy button. Is that automatically inaccessible? No. Modeless feedback can
be appropriate when it is perceivable through accessible status semantics.
Moving focus unnecessarily can disrupt the task. Test whether the feedback
is announced and whether the user can continue, not merely whether a dialog
appears.

Now compare a sort button labelled Newest first with a toggle that displays
the action it would perform next. The former describes the selected order
unambiguously; the latter may be read as the current order. The repository's
UI contract chooses explicit selected values. Accessibility and information
design overlap here: clear state vocabulary helps every reader, not only
people using assistive technology.

## Source trail

Read docs/invitation-flow-design.md and the invitation components. Browser
emulation is a useful controlled test, but a device preset alone does not
represent every physical phone, input method or assistive-technology stack.
