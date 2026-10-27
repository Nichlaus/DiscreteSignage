# Interactive AI and packaging

## Hand-presence greetings over playback — 27 October 2026

Connected the existing local hand detector to the real Android product overlay in
the debug build. The operator uses Start local hand-presence greetings in display
settings, grants CAMERA themselves, then selects Start again. It requires playing
media, owner-enabled interaction and an unexpired available product. A visible
local-camera notice remains outside the greeting panel. Stop local greeting camera
ends capture; the test also ends after two minutes. Release builds keep a no-camera
input implementation and the existing touch/remote invitation.

Exactly one fresh detected hand is the presence signal. Two seconds of continuous
presence produces the avatar wave; a subsequent wave or button selection opens
the approved product. Missing/multiple/stale hands clear presence within 500 ms,
close the greeting/product and start the thirty-second cooldown. Greeting timeout
is eight seconds, product timeout twenty. The underlying advert player is not
paused. Camera failure, offer failure/expiry, playback stop/config changes or app
backgrounding close capture/model and discard late callbacks. No frame upload,
recording, microphone or visitor identity storage.

This is hand-presence detection, not whole-person detection: a passer-by without
a visible hand will not trigger it. Whole-person approach detection remains a
separate implementation step. No camera was opened, no permission granted, no APK
installed and no deployment performed in this milestone. Physical acceptance is
deferred; check dwell, wave-back, repeated visitors, light/distance, disconnects,
camera indicator cleanup and simultaneous video performance before customer use.

Validation: debug/release builds, Android instrumentation compilation, debug lint
and all twenty native unit tests passed. Policy coverage includes interrupted
dwell, wave rejection before a greeting, departure, timeout and cooldown. Release
manifest still excludes CAMERA. No real-camera or live-screen result is claimed.

## Featured product deployment — 27 October 2026

Deployed getFeaturedProduct, saveFeaturedProduct, getScreenFeaturedProduct,
updateScreenSettings and getWorkspace in australia-southeast1, then Hosting from
commit 788124b. The owner product form and screen-level enable switch are now live.
No existing screen was enabled and no product records were changed during rollout.
Android installation, physical-device testing and signed-in form acceptance were
not performed. Existing clients require the updated Android APK for the overlay;
the browser display does not implement it. Camera activation remains separate.

Full production postflight passed: expected callables active and rejecting
unauthenticated requests, private media worker policy intact, Hosting headers and
all four page/entry bundles matching local release bytes, expiry policies active
and RTDB anonymous access denied. Logs are in ignored artifacts/featured-products-*
files. No authenticated product mutations or device testing were used for these checks.

## Owner activation and native overlay — 27 October 2026

Screen settings now include an owner-only Interactive product overlay selector,
default Off. Enabling requires screens/customerAi trial access; normal ownership,
device assignment, optimistic versioning and audit checks apply. Omitted settings
preserve the previous choice (including assistant playlist edits). Workspace reads
expose the choice. Saving a featured card alone still does not activate a screen.

Android MainActivity attaches a small robot product invitation over real playback,
only when media is playing and the screen config explicitly enables it. Touch or
remote opens the approved card for up to twenty seconds; closing starts a
thirty-second cooldown. No presence detection, automatic greeting or camera/mic
activation is connected. This initial overlay is available in both build variants;
the native avatar drawing is now shared, while camera code remains debug-only.

The overlay polls the authenticated product callable every twenty seconds, retains
offers only in memory, and subtracts request round-trip time from the server's
maximum sixty-second lease. Expiration uses elapsed realtime and is checked every
100 ms; opening a card also checks expiry. Empty/error responses hide the product;
late responses after stop/config change are ignored. Pause, revocation, playback
errors, empty schedules and playback-lease expiry stop the overlay. Cached media
can keep playing independently while expired offers disappear. Changes on the
server are observed on the next successful request, bounded by the issued lease.

This is screen-wide permission to overlay adverts; per-advert protected slots,
alternate corner placement and presence-triggered greetings remain future work.
No deployment or device installation in this milestone. Physical acceptance stays
deferred: check remote focus, split layouts/logos, readable sizing, expiry while
offline, and playlist reporting on the user's device before customer use.

Validation: web build, Android debug/release builds, debug lint and all 19 native
unit tests passed. Full Firebase regression run passed 208 of 209 tests; the sole
failure was the old audit expected-object shape missing interactive.enabled.
Updated that expectation and reran all 17 pairing/settings and delivery tests,
which passed. Release manifest remains free of camera permission and preview
activities. No live UI or physical-device acceptance is claimed.

## Screen product delivery — 27 October 2026

Implemented getScreenFeaturedProduct, a separate App Check protected callable.
It accepts no tenant/location arguments: verified device claims locate the
registration, and a transaction checks active device, matching active screen,
location, trial modules screens/customerAi and explicit screen.interactive.enabled.
Legacy/missing activation is off. Only an available, valid AUD card is returned;
missing, malformed, unavailable or unentitled content returns no product. Disabled
or revoked identities and incorrect assignments are denied.

The product response carries its version, serverNow and expiresAt, bounded to
60 seconds or the trial end, whichever is sooner. This does not share the 24-hour
media lease. A future native consumer must discard expired offers using elapsed
time, clear on denial and avoid extending validity during disconnection. Withdrawal
cannot recall a response already issued; the maximum remaining lease is one minute.

Not deployed or called by Android yet. The owner activation control and real
playlist overlay remain the next integration steps. No camera activation or
Firestore rule grants were added; manually setting production flags is not part
of this milestone. Physical testing remains deferred.

Validation: all 208 emulator/regression tests passed, including new delivery
identity, attestation, assignment, default-off, entitlement, availability and
short-lease cases. JavaScript syntax checks passed. No production deployment or
live device acceptance was performed.

## Owner-approved featured product — 26 October 2026

Prepared an owner-only portal form and App Check protected getFeaturedProduct /
saveFeaturedProduct callables. Each location has one featured product card in
settings/featuredProduct: name, short description, integer AUD cents and explicit
availability. This is not a second inventory catalogue; it works across markets
without requiring a food menu. The owner reviews a confirmation checkbox before
saving; the server validates facts, active verified ownership, location and the
existing signage trial. Saves are versioned, transactional, retry-safe and audited.
Direct Firestore access remains denied, including for owners and displays.

Saving prepares approved content only. It does not activate interaction, grant
interactive entitlements or update device playlists. Existing menus remain separate
and are not automatically synchronised. Unavailable cards are clearly marked as
not to be promoted; future screen delivery must suppress them, enforce interactive
entitlements and bound cached offer validity. No invented prices or offers are
generated. Portal/backend implementation is not deployed; Android still uses its
labelled synthetic product until the authenticated delivery step is implemented.

Validation: portal production build and all 205 emulator/regression tests passed,
including verified owner/App Check enforcement, tenant/location isolation,
concurrent retry and stale-version handling, expired trial writes, input validation,
escaped preview text and denial of direct owner/device reads and writes. Live
portal acceptance is pending deployment; physical screen testing remains deferred.

## Product greeting rehearsal — 26 October 2026

The agreed direction is product discovery alongside advertisements, with trivia
optional. Customer-facing camera acceptance is deferred until the user has an
Android device. Continue automated checks without treating them as hardware proof.

Added a separate Java debug activity, opened from display settings via Product
greeting preview. It rotates two clearly labelled sample adverts every six seconds
and offers a robot greeting in the corner after two seconds of simulated presence.
Passing visitors do not trigger it. Presence alone never reveals the product:
Show me is required. Greeting expires after eight seconds, product after twenty;
departure or dismissal closes either. A thirty-second cooldown requires a fresh
two-second dwell afterward. The rehearsal closes after two minutes or backgrounding.
No sound, camera access, visitor storage, provider calls or new permissions.

The AUD $5 iced coffee is a synthetic fixture, not a real business offer. This
activity uses sample text adverts, not the authenticated screen playlist; opening
it pauses the underlying display through the existing Activity lifecycle. Only
the sample rotation continues under its overlay. Real playlist integration must
preserve schedules, downloaded playback and reporting, and honour slots that
disallow interruption. Approved tenant product data, entitlement checks, portal
controls and local presence detection remain to implement. Do not enable it for
customers yet.

Validation: Android debug build/lint and 17 unit tests passed, including passing
visitors, deliberate engagement, timeouts, departure, dismissal and cooldown.
Release merged manifest excludes both preview activities and camera permission.
Device layout, real-advert resumption and camera accuracy remain unverified.

## Pointing feedback — 26 October 2026

Native debug trivia now highlights the current answer and displays a horizontal
hold-progress bar. Instructions explain camera-space pointing and opening the
hand to cancel. Invalid/stale input, tracking loss, avatar changes, stopping the
camera and new questions clear partial highlighting/progress. Confirmation shows
the selected answer at 100%; tracking silence clears the indicator after 500 ms.
The target name and percentage remain visible text, so colour is not the only cue.

Build, instrumentation compilation, lint and 14 unit tests passed. The initial
test JVM ran out of host paging memory; retry with one worker and a temporary
128 MiB test heap succeeded without system-setting changes. Added camera-free
instrumentation coverage for target highlighting, cancellation and switching to
Robot. Execution and visual acceptance remain pending: emulator storage is still
435 MiB free and the previous APK update failed for insufficient storage. No
camera permission was requested or production changes deployed.

## Robot avatar — 26 October 2026

Added an original white-and-blue illustrated robot alongside the cat, inspired by
the supplied rounded-shell/dark-visor reference. Native debug preview uses a shared
Canvas avatar view; browser prototype uses authored SVG. Neither includes the
reference image or requires downloaded imagery. Both share gaze and waving controls,
respect reduced-motion settings, and offer a session-only Cat/Robot selector.
Switching the native avatar cancels a partial pointing hold and requires release.
Cat remains the default. This is an illustrated prototype, not a 3D model.

Android build, lint and 14 unit tests passed. Browser selection and wave were
checked visually. Native selector visual acceptance remains pending the emulator
storage issue; real-camera animation/gesture acceptance still needs hardware.
Production avatar selection and remote settings are not yet implemented.

## Bounded trivia round — 26 October 2026

Debug Android preview now offers three curated offline questions. Answers lock,
feedback remains for four seconds, then the next question requires neutral release
before pointing again. The final score is transient and shown for eight seconds
before closing the preview. Start over clears the round and pending advancement.
The existing 30-second inactivity exit remains; a separate two-minute deadline
cannot be extended by hand presence or restart. Exit uses the existing Activity
lifecycle to close capture and return to the underlying display.

Build/lint and all 14 unit tests passed. A three-question instrumentation test was
added, but live acceptance is blocked: emulator-5554 reports insufficient storage
when replacing the app, including with an x86_64-only APK. Cache reclamation did
not free space. A run against the older installed APK failed to find question two
and is not validation of this change. No app data was deleted. Re-run the native
tests after freeing emulator storage. Paired advertisement resumption, physical
camera accuracy and the two-minute wall-clock deadline still need live acceptance.
No production deployment, customer activation or backend changes.

## Native pointing checkpoint — 26 October 2026

The debug Android preview now maps one extended index fingertip to five camera-space
targets: top, left, centre, right and bottom. Neutral gaps and corners select
nothing. The other three fingers must be folded; an open palm remains the wave
gesture. Front-camera mirroring follows the existing hand-tracking mapping.
This is a prototype pose heuristic, not calibrated screen pointing.

A continuous 900 ms hold confirms an answer, with target/progress text before
confirmation. Target changes, invalid coordinates, missing hands, duplicate or
old observations and gaps over 500 ms cancel partial holds. Answers lock until
Start over; a neutral pointing observation is required before the next gesture
answer. Touch and remote selection remain available. Stop/background cancels
pending holds. No new storage, network calls, permissions or production controls.

Validation: debug build, lint and all 13 Java unit tests passed. Two camera-free
instrumentation tests passed on emulator-5554, including injected pointing
observations, hold cancellation, locked answers and neutral release after reset.
No active camera clients remained; an existing camera permission grant was found
and revoked after testing. Release manifest
still excludes CAMERA and the interactive preview. Physical camera hardware is
unavailable: directional calibration, pointing/wave accuracy, distance, lighting
and multiple-visitor behaviour remain pending. Do not enable this for customers
based on synthetic observation tests alone.

## Native hand tracking checkpoint — 26 October 2026

Debug Java preview now uses on-device MediaPipe Hand Landmarker (tasks-vision
1.1.1). Run `node scripts/prepare-hand-model.mjs` from the repository root before
building debug: it downloads Google's documented model and verifies SHA-256
fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1
(7,819,105 bytes). The model is an ignored local debug asset, not a runtime download
or a new production asset. A changed upstream model is rejected pending review.

Camera input is bounded to 320×240, copied to RGB at most eight times per second,
and processed by one CPU worker with no queued frame backlog. Pixels and landmarks
remain in transient memory; no image files, recordings or provider calls. Sensor
rotation is applied before inference, then front-camera coordinates are mirrored
for interaction. The native cat follows the centre of exactly one detected palm.
No hand/multiple hands clears tracking; a stale result recentres gaze after 750 ms.
An open-palm heuristic requires at least three extended fingers and two horizontal
direction reversals of at least 10% of frame width within 2.2 seconds. Cooldown is
2.5 seconds; tracking gaps over 500 ms discard partial waves. This is a prototype
heuristic, not verified gesture accuracy or person identity tracking.

Stop/exit/background closes camera resources and the worker/model; late results
are ignored. Missing/unloadable model exits the preview. Valid hand presence extends
the 30-second session timeout. Trivia remains touch/remote-only. Model SDK/assets
and camera permission are debug-only; release manifest remains camera-free.

Validation: ten Java unit tests passed, including two new motion-policy tests;
debug build/lint passed with no lint errors. Approved emulator-5554 test used its
synthetic front camera (emulated, not webcam): two instrumentation tests passed
native trivia/exit and camera cancellation/start/inference/no-hand/stop/restart.
The test waits for a model result, not just camera-open status. Cleanup verified no
active camera clients and revoked CAMERA permission (granted=false). No physical
device was accessed. Real hands, wave accuracy, multiple-person behavior, coordinate
alignment, thermal performance and paired-advert return still require hardware
acceptance. No deployment or new Firebase access.

Sources: [Android Hand Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/android),
[official model](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker).

Agreed direction, 2026-10-23. A local interaction prototype is implemented as of
26 October. No production interactive experience, billing or camera access is enabled.

## Local prototype — 26 October 2026

Run the existing Vite development server and open `/prototypes/interactive.html`.
This page is excluded from the production build inputs. It imports no Firebase
or AI SDK, requests no camera/microphone access, and stores no visitor data.

Authored SVG cat eyes follow pointer position; a labelled button simulates a wave.
One curated mountain question uses top/left/centre/right/bottom answer zones.
Pointer dwell selects after 900 ms; changing/leaving a zone resets dwell. Tap or
keyboard activation selects directly. Answers lock until restart. End session,
Escape, page hiding or 30 seconds without input clear transient interaction state.
Reduced-motion styling avoids the repeated wave animation. This is interaction
simulation, not real camera tracking, person detection or generative conversation.

Three focused policy tests passed (steady hold, target loss/change, locked answer,
invalid zone and idle reset). Production build passed with no new production entry.
Local browser acceptance verified correct/incorrect feedback, restart, explicit end
disabling answers, and the wave control; narrow layout was visually checked.
Evidence: ignored `artifacts/interactive-prototype.png`. Live camera accuracy,
Android integration, TV layout, physical-device acceptance, business/device opt-in,
advertising fallback and separate entitlement enforcement remain unimplemented.

Next milestone: a local-only camera input adapter with explicit opt-in and visible
camera status, loss-of-tracking reset and stop/release behavior. Keep real-camera
validation distinct from the pointer simulation. No deployment in this milestone.

## Native Android checkpoint — 26 October 2026

The target is the Java Android display app, not the portal browser. A native
debug-only preview now opens from Display settings → Interactive preview · developer
only. Its unexported activity and Canvas character live under src/debug, with no
camera permission or cloud calls. Touch/remote focus moves the cat's eyes, a button
simulates a wave, and five native answer buttons provide curated trivia feedback.
Answers lock until Start over. Return to display/Back finishes the preview; pause
and 30-second inactivity also finish and clear transient animation state.

MainActivity's existing pause/resume path stops adverts and requests fresh playback
authorization on return. This is not a production experience switch or permission
to bypass entitlement checks. Camera tracking, gesture dwell, consent, entitlement
gating and automatic advertising fallback remain the next integration steps.
No release build exposes the preview activity, and no physical device was touched.

Debug assembly, release Java compilation, unit tests and debug lint passed (no
lint errors). The native instrumentation test passed on emulator-5554 / Medium Phone
API 36: correct/incorrect answers, answer lock, restart and explicit exit. This
does not verify paired advert resumption, camera input, physical remote motion
quality or the full inactivity interval. No new Firebase device access was granted.
The exit test waits for Android's DESTROYED lifecycle callback; an initial immediate
state assertion observed STARTED during the exit transition. The final run passed.
Release merged manifest inspection confirmed the activity is absent. Debug lint
passed again after removing per-frame Path allocation.

## Native camera lifecycle probe — 26 October 2026

Debug Android preview now has Enable local camera and Stop camera controls.
Camera permission and optional hardware declaration exist only in src/debug.
Permission grant alone does not start capture: the user taps Enable again. Each
preview starts camera-off, even with an existing Android grant. A visible status
changes to Camera on only after the first frame; microphone remains off.

The Camera2 probe prefers a front camera and accepts YUV frames at up to 640×480.
Frames are immediately closed, not displayed, recorded, analysed or transmitted.
No gesture model is connected yet. Stop/pause/exit closes session, device and reader;
an epoch check closes a device arriving after cancellation. Camera errors, missing
supported output or five seconds without frames finish the preview, returning
through the existing display lifecycle. No automatic camera reopening occurs.
Production opt-in/entitlements, camera choice/orientation and physical USB support
remain planned. The existing 30-second no-input timeout still applies.

User approved only emulator-5554 synthetic-camera testing and permission cleanup.
AVD config and running command confirmed front=emulated, back=virtualscene, no
webcam override. Final explicit APK install/grant/instrumentation run passed two
tests: native trivia/exit and camera start/frame receipt/stop/restart, including
immediate cancellation during camera opening without later callbacks. Gradle's
reinstall did not retain the temporary grant, so the camera test was rerun with
permission applied after installation. Debug build and lint passed; release merged manifest has neither
camera permission nor the interactive activity. Permission-dialog denial and real
camera disconnect, paired advert resumption and physical camera acceptance remain
untested. No camera imagery or customer data was collected.
Cleanup verified Active Camera Clients was empty before revoking permission, then
confirmed CAMERA granted=false on emulator-5554. The physical device was untouched.
Logs: artifacts/camera-probe-instrumentation.log and camera-probe-final.log (ignored).
The synthetic-camera test requires an explicit instrumentation argument and must
not be enabled on a physical camera without separate authorization.

Implementation follows Android's camera close/error callbacks:
https://developer.android.com/reference/android/hardware/camera2/CameraDevice.StateCallback.

## Packages

- Basic advertising: 1-screen, 3-screen and 5-screen tiers.
- POS plus basic advertising: bundle; included screen count remains undecided.
- Interactive AI: separately charged. Per-screen versus per-business charging,
  usage allowances and overage behaviour remain undecided.
- Preserve the 14-day trial without a payment method. Backend entitlements must
  enforce screen limits and interactive AI access. Prices and billing cadence are
  undecided; currency is AUD. Do not promise unlimited AI usage.

## First interaction prototype

A friendly animated cat follows the visitor's position on screen and waves back.
“Follow” means ephemeral position tracking, not recognising people. Use authored
animation states (idle, attend, wave, ask, correct, try again) and local gesture
detection; an AI request is not needed for every frame or gesture.

Trivia displays a question and five large answers. Four directions cannot uniquely
select five answers: the proposed design adds a centre zone to top/bottom/left/right.
Show a practice prompt, highlight the target and require a short steady hold before
submission. Include reset timeouts, one active player at a time, and touch or QR
alternatives. Curate initial questions and answers; AI may later vary wording while
preserving the approved answer. Specify “above sea level” for tallest-mountain trivia.

Camera use requires business opt-in, device permission and a visible customer
notice. Default to local processing, no stored frames, no audio and no face
identification. Clear tracking at session end. Microphone and cloud processing need
separate controls. Denied/missing/disconnected cameras must fall back to advertising.

Prototype on one Android device and compatible camera before promising streamer
support. Test accuracy, latency, lighting, distance, multiple people and thermal
load on real hardware. These are proposed implementation defaults, not completed
features or confirmed hardware capabilities.

## Planned administrator controls

Audited package entitlements, screen allowances, AI usage and trial expiry; versioned
prices when billing exists; interactive-AI disable switch; approved animation and
question versions; camera diagnostics and fallback settings. Never bypass business
or device camera permission. Diagnostics must not collect visitor recordings or identity.
