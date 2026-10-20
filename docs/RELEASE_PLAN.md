# Release plan

## Agreed requirements

- Name: Discrete Signage.
- Build a new platform without modifying existing customer systems.
- Food stores first; reusable modules later support retail, salons, and gyms.
- Dine-in only in the first release: table QR/web ordering and in-store POS.
- Stripe customer payments in AUD; support additional providers through adapters.
- Explain that more payment options are planned and offer an integration request form.
- Software subscriptions and module prices remain undecided.
- A 14-day trial unlocks all features without a payment method.
- Disclose AI usage allowances; exact limits and trial-expiry behavior are undecided.
- Staff AI controls screens and creates images; customer-facing AI is in scope.
- Display orientation, fit, fill/crop, and stretch/Fit XY are configurable locally
  and remotely, with applied/pending/failed status.
- Preserve high-quality media and support device-appropriate playback.
- Initial hardware testing: Google TV Streamer and Android devices.
- Notifications: Android, iOS, desktop web, and in-app; actual delivery depends on
  platform support, permissions, and connectivity.
- Web/Android first; iOS last when Mac build/test access is available.
- Android will use Java. The user will create the new Android Studio project
  when Android implementation starts; do not create it on their behalf.
- Regular GitHub checkpoints, concise progress updates, and autonomous routine decisions.
- A separate developer/platform admin portal; maintain the ongoing control and
  recovery inventory in [ADMIN_PORTAL.md](ADMIN_PORTAL.md) with every feature.

## Bounded milestones

Latest local milestone (not deployed): bounded private video decoding/transcoding,
video assignment and secure muted browser playback. 55 main tests plus two real
decoder tests and the build pass; local browser playback/lease-expiry checks pass.
Next: build/test the Linux worker, deploy it privately with a dedicated identity,
configure the backend and signed-GET CORS, then perform live video acceptance.
See [video requirements and limits](../video-worker/README.md). Split layouts,
playlists, schedules, reporting and transitions remain planned.

Completed: repository bootstrap and initial authorization model with 14 passing
emulator tests. Storage uploads and RTDB presence grants remain deferred until
their corresponding features; both currently deny all client access.
Completed next: authenticated business/location provisioning with server-owned
14-day trials and retry protection; combined suite has 21 passing tests.
Completed next: initial onboarding portal and staff invitation lifecycle.
Combined emulator suite has 25 passing tests; production web build passes.
Firebase web/Auth/App Check configuration and initial deployment are complete.
Live infrastructure checks pass at https://discretesignage.web.app.
Remaining acceptance check: real signup and mailbox verification.
Screen pairing and its infrastructure are deployed; the application suite has
32 passing emulator tests. Live code generation and infrastructure checks pass.
Owner-to-browser-display acceptance passed, including reconnect and revocation. Remote display settings and
calibration are deployed, with 33 passing emulator tests and all eleven live
callables checked. Live release assets match the tested local build.
No new Discrete Signage Android app has been created yet.
Media intake is implemented locally: reserved immutable uploads, quarantine,
initial format checks and owner library listing; 36 emulator tests and the build pass.
Media recovery hardening is implemented locally: owner-triggered expired-upload
cleanup, generation-safe deletion, retry-safe quota release and download-token
removal. All 39 emulator tests and the build pass. Media remains undeployed:
prevent token issuance during upload before rollout, then configure Storage and
perform live acceptance. The Storage API was confirmed disabled on 2026-10-20.
Completed next: replace Firebase uploads with five-minute constrained GCS PUT
grants; 40 emulator/backend tests and web build pass. The Sydney Storage bucket,
restricted CORS, runtime permissions, App Check and deny-all rules are deployed
and configuration postflight passes. The media portal/backend remain undeployed.
Live synthetic GCS acceptance passed for token-free upload, signed constraints,
overwrite/read denial and browser CORS. Next is deploying the media callables
and portal, followed by signed-in upload/confirmation acceptance.
Completed next: media portal, all five media callables and finalization trigger
deployed. Test Cafe browser acceptance passed for valid PNG upload, disguised
file rejection, reload persistence and anonymous download denial. Postflight
now checks sixteen callables and the active trigger. Full decoding, authenticated
playback delivery, playlists and transitions remain upcoming.
See [MEDIA_LIBRARY.md](MEDIA_LIBRARY.md)
for remaining rollout gates.

Implemented locally next, not deployed: full static-image validation, lossless
sanitized derivatives, owner image assignment and device-authorized browser playback
with 60-second leases. Real decoder, authorization, recovery and lease-expiry tests
and local browser portrait/expiry checks cover this milestone. Videos remain
quarantined; maintained video processing, playlists, transitions and offline caching
are still required. Next release gate is cloud deployment and live display acceptance.

Completed next (2026-10-20): image validation and secure browser playback deployed.
All eighteen callable/security checks, Storage postflight and release asset checks
pass. Approved Test Cafe fixture passed cloud decoding, assignment, landscape and
portrait/stretch rendering, acknowledgement and reload recovery. The older tiny
PNG failed full decoding and stayed unplayable. Anonymous original/derivative
downloads are denied. Native hardware, videos, playlists and transitions remain.
Revocation cleared playback and the disposable acceptance screen remains revoked.

1. Repository bootstrap, scope, reference audit, and default-deny configuration.
2. Local emulator tooling, tenant model, tested Firestore/Storage/RTDB authorization.
3. Authentication, business/location onboarding, and staff membership.
4. Screen pairing, device credentials, settings commands, acknowledgements.
5. Media library, schedules, cached playback, and device health dashboard.
6. Shared menu/catalogue, tables, dine-in orders, kitchen and collection views.
7. Merchant onboarding, Stripe web payments and Terminal, reconciliation and refunds.
8. Staff and customer AI with scoped tools, content generation, and usage accounting.
9. Notification routing, preferences, trials, and module entitlements.
10. Android integration and hardware acceptance tests; then iOS.

Dependencies may require small changes to this order. Every milestone should
state what shipped, how it was checked, and any remaining limitation.

## Reference inventory

| Source | Purpose | Inspection status |
| --- | --- | --- |
| `C:\xampp\htdocs\reutos` | Existing management site and backend | Structure and selected rules inspected |
| `C:\Users\charm\AndroidStudioProjects\ReutosCafe` | Android POS | Structure inspected |
| `C:\Users\charm\AndroidStudioProjects\ReutosDisplayApp` | Dedicated player | Structure inspected |
| `E:\Reutos Programming\Cafe order` | Ordering site | README, dependencies, and Firestore rules inspected |
| `C:\Users\charm\AndroidStudioProjects\ReutosSiteManagement` | Android WebView shell | WebView and manifest inspected |
| `https://github.com/Nichlaus/reutosIOS` | Flutter iOS shell | Selected Flutter sources inspected |

Reference code is not assumed secure or production-ready. Local reference rules
do not prove the currently deployed rules.

## Media transitions requirement

The current display application's transitions fail and must be replaced.
Provide a selection of transitions and animations, configurable from the portal
and display settings, with a platform default. Start with a short crossfade as the
proposed default, plus cut, fade-through-black, and directional slides; add subtle
image pan/zoom where supported. Keep transition type and duration separate from
media dwell time, and permit per-playlist defaults and per-item overrides.

Preload the next asset before transition, use two rendering surfaces where the
device supports them, and fall back to a clean cut if decoding or compositing
cannot stay smooth. Verify image-to-image, image/video boundaries, video-to-video,
mixed aspect ratios, portrait screens, offline cached playback and low-memory
Android/Google TV hardware. Never sacrifice playback quality or show a blank
frame while waiting for an animation. Final default duration follows hardware
testing. This is planned work, not implemented playback.

## Screen layouts and advertising operators — planned

Recorded 2026-10-20; implement in the media, scheduling and reporting milestones.
Keep code small, readable and idiomatic, with clear names and only necessary
abstractions and comments. Do not build these features during requirements capture.

- Support two simultaneous media regions, with side-by-side and stacked presets,
  adjustable proportions and independent media/playlist assignment. Preserve
  per-region scaling and test portrait layouts and device decoding capacity.
- Provide a small logo overlay at the top or bottom, with position, size and
  margin controls and a preview. Logos must pass image validation too.
- Record playback statistics per media: total, daily and weekly plays, played
  duration, completions, interruptions/errors and last playback, filterable by
  screen, location, client and campaign. Define image dwell/completion semantics
  and use the business timezone for day/week boundaries.
  Count actual device-reported playback, never downloads or scheduled slots.
  Deduplicate retries, authenticate device reports, and distinguish delayed or
  missing reports. Playback reports are not verified audience impressions.
- Support advertising operators: a business master account manages its screens
  and creates/invites client accounts. Clients access only their own uploads,
  submissions and authorized reports; they cannot access other clients or publish
  directly. Operator owners remain distinct from platform administrators.
- Client submissions require both technical validation and operator approval.
  Record approval/rejection, reviewer, reason and approved asset version.
  Replacing a file requires fresh validation and approval. Only approved versions
  may enter a published playlist; support audited withdrawal.
- Provide an easy calendar/timeline for date ranges, recurring weekdays, time
  windows and screen/group selection. Preview the resulting schedule before
  publishing. Define timezone/DST behavior, overlap priorities, capacity warnings,
  fallback content and campaign expiry. Keep slot length separate from media dwell
  time. Operators control publishing; client slot requests can follow later.

Implement layouts and playback event semantics before reporting; enforce client
isolation and approval gates before enabling the advertising-operator workflow.
Pricing, guaranteed advertising delivery and advertiser billing remain undecided.

## Outstanding decisions

- Separate development Firebase project before shared environment testing.
- Trial allowances, expiry grace period, and operational behavior after expiry.
- Stripe account model and merchant onboarding configuration.
- Approved AI provider/model, costs, retention, and business knowledge sources.
- Exact supported hardware, cameras/microphones, and display resolutions.
- Production domain, app identifiers, email sender, and privacy/support details.
