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
| Trial and plans | Server-owned 14-day trial; expiry guidance deployed; authorization stops at expiry | Decide post-trial continuation, 1/3/5-screen limits and prices before paid launch |
| Operations | MFA admin diagnostics, live Hosting rollback rehearsal, public uptime/backend error policies, live screen offline/recovery emails, daily seven-day backup schedule, synthetic emulator data restore, manual public probe and pilot support runbook | First completed backup verification, isolated cloud restore, separate staging project and support ownership |
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

## Hosting rollback rehearsal — 2026-10-24

Added docs/HOSTING_ROLLBACK.md and a read-only retained-version rehearsal script.
Rebuilt dc9a50c and 2b3e3a7 in isolated ignored folders; both matched all 13 stored
application files using Firebase gzip hashes. Live release remained unchanged.
The harness accounts for historical CRLF archives versus LF deployment inputs.
No cloud mutation or live rollback occurred. Actual release switching, post-switch
acceptance, backend rollback and database restore remain pending. See the runbook
for version identifiers, evidence, limits and the incident procedure.

## Live Hosting rollback exercise — 2026-10-24

Authorized rollback to 9bedf9c7c5f959b4 and restoration to f345d11443ec4acf
completed. All 13 live application files matched each intended version; old
release exposure was about 42 seconds. The restored owner workspace, onboarding
disclosure, media library and advertising-client reads passed after refresh.
Full Firebase postflight and eight focused tests passed. Public client invitation
and admin MFA gates rendered. See HOSTING_ROLLBACK.md for release IDs and times.
This closes the Hosting switch/restore rehearsal gap only; playback with an
active device, backend rollback, database restore and physical acceptance remain
outside this result. Current live version is the original onboarding release.

## Keyboard playlist usability — 2026-10-24

Playlist controls now identify each item's position and media in their accessible
names. Reordering focuses the moved item's media selector after disabled states
are updated and announces its new position. Add/remove also focus after updating
controls. Links now receive the shared visible keyboard-focus outline.

The initial concern about removing from a full playlist was not confirmed:
remaining rows already provide a focus target. The implemented change addresses
reorder focus and clearer control names, not a claimed reproduction of that bug.
Upload field guidance was already linked and announced; no change was needed.

Syntax check, eight existing focused regression tests and production build passed.
These tests do not exercise native browser focus. Keyboard/screen-reader and
visual acceptance remain pending; not deployed. This is a targeted improvement,
not a completed accessibility audit or conformance claim.

## Playlist keyboard Hosting acceptance — 2026-10-24

Deployed `0b8a773`. Eight focused regression tests passed; the Firebase CLI ran
the new Hosting predeploy hook successfully, rebuilding and validating all 13
files before upload. Full Firebase postflight passed after release.

With explicit permission, paired Keyboard acceptance at Test Cafe / blacktown
(device d_87c7f49163334730a9d78283f6f4608c). Tested unsaved playlist drafts using
existing synthetic video/image choices. Enter activated Add and move/remove
buttons; arrow-key media selection worked. Adding focused the new selector;
moving the image both ways focused that same item and updated its accessible
position/name and live-region message. Removing one item focused the remaining
selector; removing the final item focused Add. At 20 items Add was disabled;
removing one re-enabled it and focused the previous item. No playlist was saved.

Evidence: artifacts/playlist-keyboard-live.png and
artifacts/playlist-keyboard-revoked.png. Revocation was confirmed in the owner
portal and the display showed access unavailable; temporary display tab closed.
No new uploads. Browser accessibility-tree labels/messages were verified, not
spoken screen-reader output. Second-region, other browsers and full accessibility
conformance remain unverified. This was editor acceptance, not a playback soak.

## Public delivery and support checkpoint — 2026-10-24

Added a public, unauthenticated delivery check and PILOT_SUPPORT.md. Three tests
passed; live checks passed for four HTML pages and nine entry assets. Requests
have 20-second timeouts and reject redirects; HTML fallbacks for missing assets
are detected. This is a manual probe, not scheduled monitoring or authentication,
backend, dynamic-import or playback acceptance. No deployment was necessary.
Automatic alerts, support ownership and backup/restore rehearsal remain pending.

## Automated monitoring checkpoint — 2026-10-24

Enabled four public-page checks in Google Cloud Monitoring, every five minutes
across selected US, European and Asia Pacific locations. Production policies
alert on sustained failure from two checker locations or at least five backend
HTTP 5xx responses per service in five minutes. The owner supplied the email
recipient. Setup rerun confirmed no duplicate resources or drift; three focused
tests passed and initial live samples included successful checks for every page.
See MONITORING.md for policy identities and synthetic email-test outcome.
No Hosting/backend deployment or IAM change was needed. This supersedes the
earlier absence of scheduled monitoring; individual-device health,
human support ownership and backup/restore are separate release gates.

The owner subsequently confirmed receipt of the synthetic test alert on
24 October 2026. The test policy remains disabled and production policies remain
enabled. This confirms opening-alert email delivery, not an induced production
outage or recovery-email test.

## Individual-screen alert preparation — 2026-10-24

Implemented a five-minute scanner with 15-minute heartbeat grace, per-device
operational alerts and a missing-scan warning. Revocation, screen replacement,
trial expiry and reconnection are handled without client permission changes.
Ten focused monitoring tests passed, including read/write failure and capacity
handling. Deployment, metric-writer permission, scheduler execution and live
offline/recovery emails remain pending. See SCREEN_ALERTS.md. No new cloud resources
or customer changes were made in this milestone.

## Individual-screen alert live acceptance — 2026-10-24

Deployed the private scheduled worker and two screen policies. The user explicitly
approved runtime metric-writer access. Ten focused tests, full Firebase postflight
and screen-monitoring postflight passed. Approved temporary screen retained its
real heartbeat timestamps: zero during the grace period, one after 15 minutes,
zero on reconnection. The owner confirmed opening and recovery emails before
revocation. Server inactivity and visible access denial verified; test tab closed.
See SCREEN_ALERTS.md for the timeline and policy IDs. No Hosting changes or media
uploads. Missing-scanner alert delivery, physical-device acceptance, planned
downtime preferences and broader operational gates remain separate work.

## Data recovery preparation — 2026-10-24

Live read-only audit found Firestore deletion protection but no backup schedules
and PITR disabled; media Storage has seven-day soft delete. Prepared a read-only
audit/explicit backup-setup script and recovery runbook. Fresh-emulator export/import
passed with synthetic Auth, Firestore and Storage data, preserving media hashes,
object generation references, timestamps, tenant isolation and revoked access.
No production settings or customer data changed. See DATA_RECOVERY.md: production
backup enablement, first-backup verification and isolated cloud restore remain open.

Daily-backup follow-up (2026-10-24): user-authorized daily seven-day schedule enabled
and read back; rerun creates no duplicate. First-backup listing remains empty, so
first managed-backup verification and isolated cloud restore are pending Google's
scheduled run. Guarded restore preflight/command prepared and two local guard tests
passed. No live database data, IAM, PITR or bucket-retention changes. See DATA_RECOVERY.md.

## Small-screen media selection review — 2026-10-24

Playlist and logo selectors now show the complete selected media label beneath
native dropdowns, with wrapping and polite change announcements. This makes long
names/references readable when the closed dropdown clips them. No authorization,
saving or playback behavior changed. Local synthetic fixtures used the real editors
at 320/390/768-pixel frame widths (305/375/753 content widths): no horizontal form
overflow. Selection changes, item addition, logo removal and draft validation passed.
Production build and five focused media-label/setup-guide tests passed. This is
Chromium fixture coverage, not physical-phone or Safari acceptance. Screenshot:
artifacts/mobile-selected-media.png (local, ignored). Implemented, not deployed.
First managed backup and isolated cloud restore remain pending separately.

## Media form deployment acceptance — 2026-10-24

Deployed Hosting from e190165 with its guarded production build (13 files).
Full firebase-postflight passed, including live HTML/entry-asset matches, security
headers, App Check/Auth configuration and unauthenticated backend denials.
With user-approved temporary Media form acceptance at Test Cafe / blacktown,
verified full playlist and logo labels, video-to-image selection updates, adding
an item, saved selection persistence and the No logo message/hidden options.
Used existing synthetic fixtures only; no uploads or customer-screen changes.
Temporary screen d_59df7e6e11f92f1ab70ac328957ee2c5 was revoked afterward.
Live screenshot: artifacts/media-form-live.png (local, ignored). Narrow-width
wrapping coverage remains the earlier local fixture review; this is not a new
physical-phone or Android playback acceptance. Backup restore remains separate.

## Complete release test gate — 2026-10-24

Replaced the local runner's fixed test-file list with deterministic discovery of
all top-level tests/*.test.mjs and functions/test/*.test.mjs, plus the worker HTTP
suite. This closes omissions for monitoring, screen health, restore guards,
Hosting output, public probes and onboarding guidance. All 133 tests across 25
files passed, with zero failures/skips, against loopback demo emulators; emulators
shut down afterward. Evidence: artifacts/release-gate-test.log (local, ignored).
The Java Storage runtime emitted an upstream deprecation warning, but the suite
completed successfully. No product, rule, production-data or deployment changes.
Linux native decoding, Android tests, cloud restore and hardware acceptance remain
separate gates. See DEPLOYMENT.md for the command and discovery scope.

## Fresh-operator session preparation — 2026-10-24

User confirmed no operator is currently available. Prepared OPERATOR_ACCEPTANCE.md
with an uncoached task brief, account-to-first-image checklist, observable results,
assistance/timing capture, trial/offline comprehension and final screen revocation.
The session uses a new email/business and synthetic media in a separate browser
profile. Account/business/media retention is explicit; no deletion is promised.
No account, upload, pairing or live acceptance occurred. The fresh-operator gate
remains pending, and physical Android acceptance remains separate. Also corrected
obsolete onboarding notes that described signage trial enforcement as unimplemented.

## Market setup foundation — 2026-10-24

Started the next product area without changing the signage pilot scope: owners can
choose a business type and see market-specific guidance, with developer-admin
visibility and audited backend updates. Existing workspaces default to general;
no trial or screen settings change. All 136 local release tests and the guarded
production build passed. Synthetic browser selection preview passed. Not deployed;
see MARKET_SETUP.md for rollout order, live checks and planned market features.

Market setup live follow-up (24 October 2026): 6970cc5 deployed, guarded build and
full security/Hosting postflight passed. Owner selection and reload persistence,
Food/admin visibility, Advertising guidance and General restoration passed on Test
Cafe. No playlist, media or device changes. See MARKET_SETUP.md. This does not
close independent onboarding, hardware or backup/restore gates.
