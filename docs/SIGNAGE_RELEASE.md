# Signage-only first release

Scope agreed 2026-10-23. This checklist is the current release plan; older milestone
notes in RELEASE_PLAN.md are historical evidence, not current readiness claims.
Aim first for a small, supervised signage pilot, then general availability. No
launch date or paid-plan price has been agreed. Do not call this production-ready
based only on browser acceptance or emulator tests.

## Included

Business onboarding, secure screen pairing, image/video library, ordered playlists,
four transitions, orientation/scale controls, two regions and image logo overlays,
weekly/campaign schedules, screen health and basic playback-start reports.
Advertising client submissions and owner approval are available for controlled
operator pilots. Keep the 14-day trial without requiring a payment method.

POS, ordering, customer payments, interactive AI, image generation, general
notification delivery and iOS integration follow this release. They remain product
requirements but do not block the signage pilot.

## Release gates

| Gate | Current evidence | Remaining acceptance |
| --- | --- | --- |
| Tenant and device security | Emulator coverage; live App Check/Auth, private Storage/worker and revocation checks | Repeat release checks after each deployment; independent security review before broad rollout |
| Core web playback | Live browser tests for mixed media, layouts, schedules, transitions and withdrawal | Physical Google TV/Android testing; all image/video transition combinations and portrait/fit/fill/stretch |
| Native player | Java pairing, mixed playback, remote/local settings, split/logo, transition selections, process restart and revocation passed on API 36; cached dual-video 20-minute run and schedule-capped offline expiry/recovery passed | Motion quality, distinct-video combinations and physical-device acceptance remain |
| Device resilience | Browser lease-expiry/reconnect; API 36 cached dual-video soak, reboot/manual relaunch, offline relaunch and network recovery; owner-facing Home setup and automatic paired dual-video playback after reboot passed | Physical hardware and locked-device startup, low memory and 24-hour soak; managed kiosk provisioning remains planned |
| Library usability | Source/reference labels deployed; library, playlist, logo and report selectors checked live | Fresh operator usability acceptance |
| Storage recovery | Submission cleanup deployed; 108 tests passed at release | Live eligible deletion/quota retry on/after 31 October 2026, 6:32:12 pm Sydney; reference-aware library removal remains planned |
| Onboarding | Test business and existing account acceptance | Fresh business signup, verification, pairing and first playlist by a new operator without developer help |
| Trial and plans | Server-owned 14-day trial; authorization stops at expiry | Explain expiry in customer UI; decide post-trial continuation, 1/3/5-screen limits and prices before paid launch |
| Operations | MFA admin diagnostics and deployment scripts | Separate staging project, monitoring/alerts, backup/restore rehearsal, rollback exercise and support runbook |
| Public launch | Firebase hosting available | Domain, privacy/terms/support contacts, documented limits, accessibility/mobile check and launch sign-off |

Browser and older native players require renewal within 60 seconds. On 2026-10-24 the user
requested downloaded playlists and approved up to 24 hours of offline playback.
Private verified caching and bounded foreground offline playback are now
deployed and initially live-tested on API 36. Restart/resume still needs
internet, schedule changes stop playback, and offline report queuing is pending.
Two regions sharing a verified video cache continued through a 118-second outage,
reconnected automatically and reused the file after an online restart. Revocation
cleared playback and cache. A subsequent 20-minute run passed with 16 minutes
21 seconds offline, unchanged process and no monitored playback exceptions.
Schedule-capped offline expiry cleared both videos and the logo; reconnect restored
only eligible content. See ANDROID_SETUP.md for timings, memory samples and limits.

Downloaded-playback local checks (2026-10-24): 112 backend/rules/browser-policy
tests and eight Java unit tests passed; debug build, release compilation and lint
passed (zero lint errors, 29 warnings). Deployment and 37-callable security
postflight passed; initial cached dual-video acceptance passed. The subsequent
20-minute emulator acceptance does not replace a full 24-hour expiry/physical
hardware soak. Nine schedule and five Android policy tests passed again during
that acceptance; no code change or redeployment was needed.

Current supported video processing is bounded to 20 MiB, 60 seconds, 1080p and
30 fps; playback is muted. Still-image decoding is bounded to 16,777,216 pixels,
8192 pixels per dimension and 20 MiB. Original uploads are private; playback uses
validated derivatives. Do not advertise universal device compatibility or 4K video.

## Next milestones

1. Hold-OK settings shortcut passed on API 36; verify it on a physical TV remote.
2. Emulator reboot/relaunch recovery passed; test distinct-video combinations and chosen-device startup behavior. See [ANDROID_SETUP.md](ANDROID_SETUP.md).
3. Run physical-device resilience/quality acceptance and the full 24-hour soak, fixing failures in short steps.
4. Finish recovery, onboarding and operational gates; confirm pilot terms and scope.
5. Run the supervised pilot and record outcomes before opening general availability.

Track each gate as tested, pending or blocked with dated evidence. Percentages are
rough planning estimates and must not substitute for these acceptance checks.

## Local checkpoint — 2026-10-23

Media library, playlist, logo and reporting selectors now share source/reference
labels so repeated filenames can be distinguished. Three focused tests passed
(identity/selection preservation, reference collisions and HTML escaping), and
the production build passed. A synthetic browser preview confirmed readable
labels and preservation of the selected client advert. These UI changes are not
deployed. The earlier 108-test security/recovery baseline was not rerun for this
frontend-only checkpoint.

## Hosting release — 2026-10-23

Deployed implementation `10c53a2` to Firebase Hosting. Three focused tests and
the production build passed again. All 37 callable postflight checks, exact live
asset matching, Auth/MFA/App Check and private Storage checks passed.
The owner library and report selector showed matching references. Approved
temporary screen `d_5754fc4ef2c7b9fe1aea7deed5a96c4e` at Test Cafe / blacktown
saved video `30a390c5` with logo `0dd377a6`, preserved the full IDs on reopening,
reported Applied and rendered both media in the live browser. The selected video
report loaded successfully. Duplicate-name collisions and client-source labels
remain covered by local fixtures/tests; current ready live fixtures have distinct
names. No new uploads or client grants were needed. This is browser acceptance,
not physical Android acceptance.
The temporary screen was revoked after testing; the owner portal showed Revoked
and the display cleared its content and showed access unavailable. Evidence is
stored locally in `artifacts/media-selection-live-{playback,report,revoked}.png`.

## Owner screen guidance — 2026-10-24

The portal now includes expandable setup, offline playback and restart guidance.
It distinguishes Android downloaded playback (up to 24 hours, bounded by trial
and schedule eligibility) from browser playback, explains fresh authorization
after restart, and documents local Home-app setup and reversal. Empty-playlist
and Applied-status wording no longer promises a calibration card or visible
playback on every platform.

Production build passed. Browser visual verification is pending because the
local preview timed out. No deployment or authorization changes in this milestone.
Physical-device acceptance remains pending; the owner has no device available yet.

## Screen guidance Hosting release — 2026-10-24

Deployed `41250e7` to Firebase Hosting after a successful production build.
Live owner-session verification confirmed the help disclosure opens and closes,
all four guidance sections are readable at the narrow in-app browser width,
and pairing instructions include both Android and browser displays. The footer
now directs owners to this guidance. Evidence is saved locally in
`artifacts/screen-guidance-live.png` and `artifacts/screen-guidance-startup-live.png`.

No device was paired or settings changed. All existing screens were revoked,
so per-active-screen schedule/save hints and the empty-playlist copy were not
exercised live. Physical-device acceptance remains pending until hardware is
available. This release changes guidance only, not offline playback behavior.

The full Firebase postflight completed successfully: callable unauthenticated
rejections, Auth/MFA/App Check, private Storage, Hosting security headers, exact
live HTML/entry-asset matching, TTL cleanup, scoped signing and anonymous
Realtime Database denial all passed.

## Trial-expiry guidance checkpoint — 2026-10-24

The workspace dashboard now shows the exact trial end time in the browser's
labelled time zone, distinguishes the final day and expired state, and explains
playback, pairing, upload, validation and settings restrictions. Owners get
workspace/revocation guidance; staff are directed to their owner. It states that
there is no automatic paid conversion and that paid plans/self-service renewal
are not yet available. The countdown is explicitly a snapshot, not authorization.

Three dashboard tests (including before/at/after expiry and role-specific copy)
and the production build passed. No entitlement, billing or security change.
Not deployed; visual and live acceptance pending. Support contact details and
post-trial continuation policy still need to be established before a public launch.

## Trial guidance Hosting release — 2026-10-24

Deployed `dc9a50c` to Firebase Hosting. Three dashboard tests and the production
build passed again. The full Firebase postflight passed, including callable
unauthenticated rejection, Auth/MFA/App Check, Storage checks, live HTML/entry
asset matching, security headers, TTL cleanup, scoped signing and anonymous
Realtime Database denial.

Live Test Cafe owner acceptance verified the active-trial countdown, exact end
(3 November 2026 at 6:31:33 pm AEDT), no automatic paid conversion wording,
help expansion/collapse and successful overview refresh. The expanded card is
readable at the narrow in-app browser width. Evidence:
`artifacts/trial-guidance-live.png` (local only).
No live entitlement or account changes were made. Expired/final-day boundary
states and staff-specific wording were covered locally, not forced on the live
business. This is guidance acceptance, not a new trial-expiry playback test.

## First-screen onboarding checkpoint — 2026-10-24

Added an owner-only first-screen guide with links to location, pairing, library
and screen settings. It opens by default only when the trial is active and no
active screen is present. The pairing shortcut opens its disclosure and focuses
the summary. The guide describes validation, saving a single-image playlist and
checking the physical display; it never treats an acknowledgement as proof of
visible playback or marks steps complete automatically. Signup now describes
available signage features and marks POS, ordering and interactive AI as future.

Five focused dashboard/setup-guide tests and the production build passed.
Not deployed; visual/live acceptance and fresh-operator onboarding remain pending.
No new permissions, backend behavior or hardware-compatibility claims were added.

## First-screen guide Hosting release — 2026-10-24

Deployed `2b3e3a7` to Firebase Hosting after five focused tests and a successful
production build. Full Firebase postflight passed: callable unauthenticated
rejections, Auth/MFA/App Check, Storage checks, exact live HTML/entry-asset
matching, security headers, TTL cleanup, scoped signing and anonymous RTDB denial.

Live Test Cafe owner acceptance confirmed automatic guide expansion with no
active screens, collapse/reopening, readable five-step layout at narrow width,
Locations/Media library/Screens anchor navigation, and the pairing shortcut
opening the correct form. The form was closed without submission. Evidence is
local in `artifacts/onboarding-guide-live.png` and
`artifacts/onboarding-pair-shortcut-live.png`.

No upload, device grant or account change was performed. The browser-player link
was inspected but not used to start a pairing session. Signup wording is included
in the deployed build but was not separately inspected in a signed-out session.
Role/expiry visibility remains covered by local tests. A fresh operator completing
signup through visible playback unaided, and physical-device acceptance, remain
release gates; this check verifies the guide rather than those workflows.

## Hosting release guard — 2026-10-24

Firebase Hosting predeploy now invokes `node scripts/prepare-hosting.mjs`, which
builds from the current source and checks the resulting package before upload.
All four HTML pages must exist and reference existing JavaScript entry assets.
Only those pages and hashed JS/CSS assets are accepted; empty files, symlinks,
unexpected directories, source maps and stray preview/configuration files fail.

Three focused tests passed, including rejection cases; the preparation command
built and checked the current 13-file output successfully. No live deployment
was performed for this tooling-only milestone. The Firebase CLI hook invocation
itself remains to be observed at the next authorized deployment. This is not a
secret scanner, a transitive module integrity check or proof of source freshness
against GitHub: deployment must still use the reviewed commit and environment.
