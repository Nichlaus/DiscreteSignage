# Remote display settings

Deployed on 2026-10-20. All eleven callable readiness/security checks pass, and
live portal/display HTML and entry assets match the tested local build.
Live browser pairing-code creation also passes. Signed-in owner-to-display
acceptance remains pending. No Android project has been created: the user
will create it in Android Studio and implementation will use Java.

## Contract

`updateScreenSettings` requires an authenticated, email-verified active business
owner, App Check, a live screens trial and an active matching device registration.
Supply exactly `businessId`, `locationId`, `screenId`, `expectedVersion`,
`orientation`, and `scaleType`.

- Orientation: `landscape` (0°), `portrait` (90° clockwise),
  `landscape-flipped` (180°), `portrait-flipped` (270° clockwise).
- Scale: `fit` (contain), `fill` (cover/crop), `stretch` (Fit XY).
- Rotation is relative to the device's normal viewport. Browser rotation applies
  to the content surface, not the operating system or monitor.

Writes are transactional and versioned. Conflicting stale writes fail instead
of overwriting newer settings. A retry of the same change can return its existing
version. Each change creates an audit record with actor and prior/new settings.
Direct client writes remain denied; no new Firestore rule grants were introduced.
Managers, staff and devices cannot call the owner configuration operation.

## Display and portal

The browser display observes its assigned screen, applies rotation and object-fit
to a calibration surface, then reports the applied version. Unsupported settings
produce `state: error` and preserve the last applied version. The card makes
crop, letterboxing and stretch distortion visible; it is not media playback.

The portal offers per-screen settings and an explicit status refresh. Reports
less than two minutes old show Applied, Pending, or Display reports an error.
Absent reports show Waiting for display; older reports show No recent report,
not a definitive offline diagnosis. Saved version and reported version remain
visible. A device report is an acknowledgement, not independent visual proof
that physical hardware rendered correctly.

## Verification and remaining work

- 33 emulator tests pass, including active-owner restrictions, strict settings
  validation, concurrent/idempotent saves, stale-write rejection, audit records,
  expired trials and revoked devices.
- Production build passes.
- Local browser calibration checked all 12 orientation/scale combinations:
  rotated surfaces fill the viewport; computed scaling matches each mode.
- Signed-in portal-to-display acceptance, hardware rotation,
  native local settings, media/video playback and transition effects remain.
- The new callable is included in live postflight checks.
- Before Android work, ask the user to create the Java project and coordinate
  the application ID and Firebase Android registration.

## Signed-in acceptance procedure

Use an owner-controlled test screen and location, not a customer's active screen.
The owner signs in and verifies their email themselves.

1. Open `/display.html` in a separate browser tab or on the test device. Pair its
   current code from the owner portal with an identifiable test screen name.
2. Confirm the calibration card appears. Refresh screen status in the portal;
   the saved and reported versions should match and status should say Applied.
3. Save a different rotation and scale. Confirm the card visibly changes, then
   refresh status and verify the new version is acknowledged.
4. Save from two portal tabs with the same starting version. A conflicting stale
   save must show a refresh/retry error rather than overwrite newer settings.
5. Close the display tab and wait beyond two minutes. Refreshed portal status
   must say No recent report. Reopen the display and verify its retained identity,
   latest settings and fresh acknowledgement.
6. Revoke the test display. Its calibration view must stop and Firestore access
   must fail. Leave this disposable registration revoked.

Record which steps actually passed, browser/device used, date, and limitations.
Emulator success or a deployed callable's HTTP response does not substitute for
this procedure.
