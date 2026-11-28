# Video "blinking": diagnosis and design — 28 November 2026

## Symptom

During a same-PC test (doctor window plus an incognito patient window), tiles
showed half-updated pictures (top half live, bottom half an older scene) and
brief stalls. The tint visible in some screenshots was the DevTools element
highlight, not the app.

## What was ruled out (source-checked)

| Suspect | Finding |
| --- | --- |
| Layout re-flow | Fixed earlier: the missing `data-lk-theme` root made the grid height invalid. After that fix, the 2-tile grid is stable in full-screen captures. |
| App restarting media | `LiveKitRoom` applies `audio`/`video` only on `SignalConnected`, so new prop objects do not republish tracks. |
| Token churn / reconnect | The patient admission poll stops once admitted; doctor token is fetched once. |
| E2EE passing ciphertext to the decoder | LiveKit's E2EE worker drops undecryptable frames instead of forwarding them. |
| H.264 E2EE keyframe bugs ([client-sdk-js#2180](https://github.com/livekit/client-sdk-js/issues/2180), [livekit#5041](https://github.com/livekit/livekit/issues/5041)) | Do not apply: we publish VP8, LiveKit's default. |

## Remaining causes (documented LiveKit/WebRTC behavior)

1. **Background pause/resume.** `adaptiveStream` pauses video in a hidden tab by
   default. On return the receiver must wait for a keyframe, so the picture is
   partly stale for a moment. Alternating windows during a test triggers this
   constantly.
2. **Gaps until the next keyframe.** A dropped or late frame leaves the VP8
   decoder with stale regions until the receiver's keyframe request (PLI) is
   served. That is the "half new, half old" picture.
3. **CPU limitation.** One PC encoding two 720p simulcast streams, running two
   E2EE workers, speech recognition and DevTools makes Chrome lower or drop
   frames (`qualityLimitationReason: cpu`).

## Pattern chosen: measure with standard stats, remove the app-controlled trigger

- **Observability (W3C webrtc-stats):** the Call quality panel now shows
  received-video `freezeCount`/`totalFreezesDuration`, `framesDropped`,
  keyframe requests (`pliCount + firCount`) and the sender's
  `qualityLimitationReason`. This is how Meet/Zoom-style health indicators
  attribute a stall to network, CPU or decoding instead of guessing.
- **`adaptiveStream: { pauseVideoInBackground: false }`:** a 1:1 consultation
  has one remote video, so continuous receipt costs little and removes the
  pause/resume freeze. Size-based layer selection, dynacast and simulcast stay
  on.

Rejected alternatives: disabling simulcast or E2EE (loses the documented
quality-adaptation and confidentiality properties without evidence that they
cause this); custom layouts replacing `VideoConference` (layout was not the
remaining cause).

## How to verify

Test with **two devices** (doctor and patient on separate machines). Open
Call quality for 5 minutes and record: freezes, dropped frames, keyframe
requests, Send limited by. `cpu` on a same-PC test identifies the test rig,
not the product. Rising freezes with packet loss point to the network; rising
keyframe requests with low loss point to decode gaps. Physical-device
acceptance is performed by a person; these numbers are its evidence.
