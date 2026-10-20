# Remote display settings

Implemented and tested locally; not deployed yet. The live site still runs the
previous pairing-only release. No Android project has been created: the user
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
- Deployment, signed-in portal-to-display acceptance, hardware rotation,
  native local settings, media/video playback and transition effects remain.
- After deploying the new callable, add it to live postflight checks.
- Before Android work, ask the user to create the Java project and coordinate
  the application ID and Firebase Android registration.
