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
