# Video flicker investigation — status 28 November 2026 (open)

This note supersedes the earlier version of the same date, which stated
background pausing and CPU limitation as causes. Those were hypotheses; the
evidence below does not support them, and the root cause is **not yet
confirmed**.

## Symptom (user recording, production `63372c8`, same PC, two windows)

- Doctor view, 2 tiles. Tiles alternately match and diverge; a region of one
  tile stays stale or dark; at ~45 s one tile is bright while the other is
  almost black. The connection stays Connected.
- Doctor Call quality (cumulative since join, read at ~9 min): received
  1280×720 at 14–16 fps while the sender reports 29–30 fps; 12–13 freezes
  (4.1–4.4 s); 99–101 frames dropped; **0 keyframe requests**; send limited by
  **none**.
- A "camera and microphone blocked" notice appeared at ~14 s although the
  camera visibly worked.
- The doctor's local tile and the remote patient tile show the same scene from
  the same angle, consistent with both windows capturing one physical camera
  (not yet confirmed).

`Send limited by: none` and zero keyframe requests contradict the earlier
CPU-limitation and decode-gap explanations for this run.

## Verified

| Check | Result |
| --- | --- |
| Deployed build | `livekit-frontend-tau.vercel.app` serves deployment `dpl_F2MLcerJyAvE63DdAmYVAeMcnYMf` from `63372c8`; the shipped bundle contains `adaptiveStream:{pauseVideoInBackground:!1}` and the `data-lk-theme` room root. |
| Controlled reproduction | `scripts/diagnostics/livekit-media-repro.mjs`: two Chromium contexts, local LiveKit 1.9.12, installed `livekit-client`, E2EE worker, VP8 simulcast and the app's room options, synthetic devices. Baseline, tile resize (layer switch) and camera restart (`restartTrack`): **0 freezes, 0 dropped frames, no element detach, no unsubscribe**, steady 20 fps (the synthetic camera rate). Summary: [harness-summary.json](testing/evidence/2026-11-28-video-repro/harness-summary.json). |
| Background tab | **Inconclusive**: headless Chromium kept `visibilityState=visible`. |
| Device notice | Confirmed defect: it ignored `MediaDevicesError`'s `kind`, reported both devices for any `NotAllowedError`, and never cleared after the device published. Fixed (see below). |

Conclusion so far: the SDK, E2EE, codec and app room options reproduce no
flicker under controlled conditions. The remaining differences from the
user's run are the real camera(s), both windows on one PC (possibly sharing
one camera), the OBS virtual camera, real background tabs and the real
network. Each must be tested on its own.

## Changes in this round

- **`DevicePermissionNotice`** now names only the device in the event's
  `kind`, classifies with LiveKit's `MediaDeviceFailure` (blocked / in use /
  not found), and clears when that device publishes again
  (`lib/livekit/device-problems.ts`, `tests/media-diagnostics.test.mjs`).
- **Temporary diagnostics** (`?mediaDiagnostics=1` on the room URL): per video
  track, a redacted participant/track id, source, subscription, mute and
  stream state, attached-element count, local capture settings (resolution,
  frame rate, redacted device id, readyState) and **per-second deltas**
  (decoded, encoded, dropped, freezes, keyframes, keyframe requests, packet
  loss, quality limitation). It also logs timestamped room/track events,
  `MediaDevicesError` with kind and failure, page visibility and `<video>`
  lifecycle (DOM add/remove, emptied, stalled, waiting, resize). "Copy
  diagnostics" exports JSON with no tokens, names, emails or room names.
  Remove the panel when this investigation closes.

No media setting was changed in this round.

## Next runs (one variable at a time, synthetic accounts)

Open both room URLs with `?mediaDiagnostics=1`. Run 3 minutes each and copy the
diagnostics from both windows.

1. **Two devices**: doctor on the PC, patient on a phone. If clean, the
   product path is cleared for that network.
2. **Same PC, patient camera off** (patient receives only). Tests whether the
   artifact needs two capture sessions.
3. **Same PC, two different physical cameras**, OBS Virtual Camera unused.
4. **Same PC, same camera**: the original setup. Compare the sender's
   `capture` line (redacted device id, fps) in both windows.
5. **Background**: from a clean run, switch the doctor tab away for 30 s and
   back; look for `page-visibility`, then `streamState` and decode deltas.

How to read it: a remote row with `dec` near the sender's `enc` and `drop` 0
while the image looks wrong points at **capture or source** (compare with
the sender's own local preview). `video-element-removed`/`added` or
`TrackUnsubscribed` around the moment points at **remount/subscription**.
Rising `drop` with `loss` points at **network**. `EncryptionError` points at
**E2EE**. `MediaDevicesError … DeviceInUse` points at **camera sharing**.

## Run of 28 November 2026 (deployed `dcd2594`, same PC, two windows)

Per-second deltas from both windows, about 3½ minutes:

- Remote video held 28–30 fps at 1280×720 with **0 freezes and 0 dropped
  frames** in every interval except one: the doctor's view at t≈174 s
  (5 dropped frames, 11 packets lost). The patient window lost 9 packets
  around t≈30 s with no freeze.
- The patient **left and rejoined twice** (participant disconnected at
  ≈60 s and ≈179 s, connected at ≈163 s and ≈185 s). Each rejoin removes and
  re-adds the `<video>` element. Playback restarts at 320×180 and reaches
  720p about 1.3 s later (simulcast layer ramp).
- The doctor's encoder sent nothing from ≈66 s to ≈162 s while nobody was
  subscribed. That is expected dynacast behaviour, not a fault. The doctor tab
  was hidden from ≈25 s to ≈203 s.

Finding: the stats show **no decode-side flicker mechanism**. The visible
"blinks" that line up with events are the leave/rejoin remounts (black frame,
then a low-resolution start). The root cause of the flicker is **not
confirmed**. The open question is why the patient left: a refresh, or a
dropped connection.

Added for the next run: the panel now logs the local `Disconnected` event with
LiveKit's `DisconnectReason` name, the page's navigation type at start
(`navigation=reload` means the page was refreshed), and `pagehide`. Read the
leaving participant's export: `pagehide` followed by `navigation=reload` is a
refresh; `Disconnected reason=…` without `pagehide` is a connection drop and
becomes the bug to chase. Media settings are still unchanged.

## Run of 28 November 2026, 16:17 (deployed `b3d278f`, same PC, normal + incognito window)

- The patient window's rejoin started with `navigation=reload`: that page was
  **reloaded**, not disconnected. The doctor saw a clean `participantDisconnected`
  at ≈54.9 s and the new session at ≈61.8 s (7 s gap, normal for a reload plus
  sign-in and admission). Repository search found no code that reloads the
  invite or room page; the invite page only listens to `pagehide`/`beforeunload`
  to record a clean exit. The panel now also logs `discarded=` so a Chrome
  Memory Saver reload of a background tab can be told apart from a person
  pressing refresh.
- Outside the reload, remote video held 1280×720 at 26–31 fps. Over about
  100 s there was one freeze (t≈7 s: 6 dropped frames, 9 lost packets) and two
  small loss bursts (≈95 s, 12 packets; ≈34 s in the other window). These are
  network loss on a shared Wi-Fi/PC and recover within a second.
- Both windows capture the **same physical camera** at 1280×720@30. Two
  capture sessions on one camera is the remaining untested variable: the
  stats cannot see a flicker that happens inside the camera driver before
  encoding. Run 1 (two devices) still decides whether the product path
  flickers at all.

No media settings were changed.
