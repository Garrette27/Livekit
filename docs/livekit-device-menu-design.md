# LiveKit device-menu repair — 28 November 2026

The camera and microphone choices use LiveKit's supported anchored device
popup. LiveKit owns discovery, active-device selection, opening/closing and
Floating UI positioning; application CSS owns presentation within its theme.
The surrounding `div`, `ul`, `li` and option buttons remain vendor components.

## Root cause and selected design

The old application rule forced `bottom: 100% !important` onto a popup whose
installed LiveKit implementation computes inline `top` and `left`. The two
vertical constraints reduced the popup to an 18px strip while its list was
84px tall. A real-component browser reproduction confirmed that the second
option failed hit-testing. Broad `.lk-control-bar button` styles also colored
the device options as toolbar actions. Additional selectors targeted item
classes that the installed component does not render.

Keep the vendor popup and remove the conflicting geometry. Restrict toolbar
styles to direct toolbar/group buttons; apply bounded dimensions, wrapping,
contrast and a visible keyboard-focus outline to the device popup through
LiveKit theme variables. Shared global presentation covers preflight and the
call without duplicating device-menu rules in the room stylesheet.

An alternative is a separate settings dialog with native device selects.
That would require another integration for device enumeration, switching,
permission errors and persisted choices. The supported component already owns
those behaviors. Preserving it fixes the demonstrated cause with less coupling;
upstream component markup remains a dependency covered by the browser test.

LiveKit documents the device selector and theme customization. Floating UI
documents computing coordinates relative to an anchor, including viewport
placement middleware. This implementation follows the installed component's
positioning contract rather than adding a second positioning policy.

- [LiveKit MediaDeviceMenu](https://docs.livekit.io/reference/components/react/component/mediadevicemenu/)
- [LiveKit component styling](https://docs.livekit.io/reference/components/react/concepts/style-components/)
- [Floating UI computePosition](https://floating-ui.com/docs/computeposition)
- [Floating UI flip](https://floating-ui.com/docs/flip)
- [Floating UI shift](https://floating-ui.com/docs/shift)

## Verification boundary

`tests/livekit-device-menu-browser.test.mjs` bundles the actual installed
LiveKit controls, a disconnected `Room` and application styles. Device
discovery is synthetic. Chromium checks microphone and camera choices at
1280×800, 390×844 and 320×568: full popup/list/item/button geometry, viewport
bounds, hit-testing, wrapped names, isolated toolbar color, keyboard
opening/selection, pointer/touch selection, active-device state and dismissal.
The original clipping assertion failed before the CSS change; the focused
device and consultation-workspace run passed all eight tests after it.

Upstream buttons retain Tab/Enter/Space behavior. This change does not add or
claim full ARIA-menu arrow-key/Escape navigation. See the
[WAI menu-button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
for that distinct interaction contract. Hardware permissions, real camera
capture and an authenticated connected call still need signed-in acceptance
on the deployment. The synthetic browser test does not establish those.

Run with the project's Playwright Chromium installation; this host used:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/ret/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome \
LIVEKIT_DEVICE_EVIDENCE_DIR=/tmp/livekit-device-menu-final \
node --test tests/livekit-device-menu-browser.test.mjs tests/consultation-workspace.test.mjs
```

The [verification evidence](testing/evidence/2026-11-28-device-login/)
records the tested environment and command outcomes. No patient data, token,
transcript or connected-call screenshot was used.

## Follow-up: empty device list (28 November 2026)

A deployed doctor room showed the popup opening with an empty
`ul.lk-media-device-select`. This is not a styling fault. LiveKit's
`getDevices(kind, requestPermissions)` calls `getUserMedia` when labels are
missing; when the browser has **blocked** camera/microphone for the site that
call throws `NotAllowedError` and the list stays empty. The same session's
speech-notes recognizer reported `not-allowed`, which confirms the browser
permission state.

`app/room/[room]/components/shared/DevicePermissionNotice.tsx` now explains
the state inside the room: it watches the Permissions API (`camera`,
`microphone`) and LiveKit's `RoomEvent.MediaDevicesError`, names the blocked
device and tells the user to allow it from the site settings and reload. It
never requests permission itself and never blocks the call. The doctor-room
error toast also moved above the control bar, where it had been hidden.
Physical-device acceptance on the deployment still has to be done by a person.

## Follow-up 2: missing theme root (28 November 2026)

The deployed menu still rendered transparent, bulleted, dark options at the
bottom of the stage, the tile grid filled only the top of the screen, and the
grid flickered. Cause: `@livekit/components-styles` defines every theme and
layout variable under `[data-lk-theme=default]` and scopes `.lk-list` and
button rules under `[data-lk-theme]`; LiveKit's guide places that attribute on
`<LiveKitRoom>`. The in-call room never had it (only the pre-join screen did).
The browser fixture added it on its own wrapper, so the test could not see the
gap. `RoomShell` now passes `data-lk-theme="default"` to `LiveKitRoom`, and
`tests/consultation-workspace.test.mjs` pins it.
