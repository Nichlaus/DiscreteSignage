# Developer / platform admin portal

The read-only diagnostics foundation and authenticator MFA flow are implemented (2026-10-22).
Hosting and the diagnostics callable are deployed; live account acceptance passed.
Recovery actions and configuration controls remain planned.
It is separate from the customer business portal and must support the developer
operating Discrete Signage across businesses.

Update this inventory during every implementation milestone. Whenever a feature
introduces a configurable limit, default, policy, failure mode, or recovery action,
record the corresponding admin control here. Include its scope, validation,
audit requirements, and implementation status. Do not defer recording until the
admin UI is built.

## Current-feature inventory

Automatic startup (2026-10-24): an optional Android Home-app entry and local setup
dialog are implemented. The owner selects the system Home app; startup status uses
the resolved Home component, not just role ownership. An approved API 36 reboot
automatically opened the app, then the original Home app was restored. The initial
unpaired test was followed by the paired acceptance below.
No new backend grant exists. Admins cannot remotely change Android's Home selection.
Follow-up API 36 acceptance passed the app's setup dialog, Android Home selection,
full reboot and automatic paired dual-video playback, with fresh authorization and
Applied status. Original launcher and all temporary access were restored/removed.
Physical TV and locked-device acceptance remain pending.
Planned diagnostics should distinguish configured Home, actual foreground launch,
fresh playback authorization and vendor support. Help users restore their previous
Home app through local settings. Internet/unlock may still be required after boot;
this feature is not kiosk lockdown. Managed-device provisioning remains planned.

Earlier reboot/relaunch acceptance (2026-10-24, API 36): full emulator reboot followed by
manual launch retained pairing and verified cache; fresh online authorization
restored both video regions. Offline relaunch withheld media and retried; restoring
network recovered automatically. Test access was removed. Support must distinguish
cached files from authorization: restarting still requires internet. Automatic
boot launch/kiosk provisioning is not implemented, and physical-device boot remains
pending. Existing planned recovery diagnostics should expose app version, last
contact and authorization state without implying the app starts itself after power loss.

Remote settings shortcut (2026-10-24, API 36 emulator acceptance passed): the Java
player supports holding centre/OK during playback in addition to Menu and touch
hold. Existing orientation/scale overrides and server authorization are unchanged.
Support should record device model, remote model and app version when the shortcut
is unavailable; use the on-screen Display settings button outside playback.
Remote-key diagnostics and remote recovery commands remain planned. No additional
permissions or administrator controls were introduced. Live short/held OK, D-pad
selection/Apply, Back discard, Cancel, Menu and touch-hold checks passed. Temporary
screen/debug access was removed. Physical-remote acceptance remains pending.

Downloaded playlist checkpoint (2026-10-24, deployed): the user approved up to
24 hours of offline playback using private locally downloaded media. Existing
clients still stop at the short online lease. Private verified caching and
server-bounded foreground offline playback are deployed and initially live-tested.
Two native video regions shared one verified cache file and continued through a
118-second emulator outage. Automatic reconnect and online restart/cache reuse
passed. Online revocation cleared playback and deleted the cached file. Temporary
test access was removed. A subsequent 20-minute API 36 dual-video run passed,
including 16 minutes 21 seconds offline, with unchanged process and no monitored
playback exceptions. A real schedule-capped offline grant cleared both regions
and the logo at the expiry observation; reconnect restored only eligible content.
Its temporary access was also removed. Full 24-hour and physical-TV soaks remain.
The cache is limited to 512 MiB, 20 MiB/file, with 32 MiB storage reserve. Digest,
generation, length and origin checks protect downloads; expiry and device changes
cannot confer new authorization from cached files. Current offline expiry is the
earliest of 24 hours, entitlement end and the next schedule change. Restart/resume
requires internet; new revisions clear playback during preparation. Descriptive
download/offline notices and remaining minutes are implemented on-device. Cache
controls, numeric progress and queued offline reporting remain planned.
Record server-authorized offline expiry separately from last contact, expose
cache/download failures and storage pressure, and distinguish stale status from
confirmed playback. Planned recovery controls: retry sync, clear/rebuild cache,
inspect revision/generation and revoke the device. Remote actions cannot reach
an offline device immediately; show that revocation/withdrawal can be delayed
until reconnection or the bounded offline expiry. Entitlement and schedule ends
must remain enforced. Never expose download tokens or cached authorization in
the admin UI. See ANDROID_SETUP.md for acceptance requirements.

Android client key review (2026-10-23): GitHub alert 1 flags public SDK
configuration, not an admin credential. The live key now permits only App Check,
Installations, Firestore, Identity Toolkit and Secure Token; metadata read-back,
Auth validation and denial of Gemini ListModels were verified. The audit script
is scripts/firebase-android-key.mjs. Application package/certificate restrictions
remain unset pending signing and compatibility acceptance. Planned diagnostics:
report key restriction drift and distinguish API_KEY_SERVICE_BLOCKED from Auth,
App Check and rule denials, without exposing keys. Keep paid AI credentials
separate and server-side. GitHub alert 1 was verified dismissed as "Won't fix"
on 2026-10-23 with the public-client-key and restriction rationale recorded;
no rotation or abuse-history assessment is claimed. See ANDROID_SETUP.md.

Signage release readiness (2026-10-23): see SIGNAGE_RELEASE.md for pilot gates.
Media source/reference labels are deployed and live-tested; they help
owners match repeated filenames across library, playlist, logo and report choices.
References derive from existing media IDs and grant no access. Admin support should
use business scope plus the full media ID when investigating a reference; no new
admin lookup or recovery permission has been added. Native device diagnostics,
monitoring/alerts, restore rehearsals and trial/plan controls remain release gates.
The Java pairing/playback preview is documented in ANDROID_SETUP.md. It supports
one or two native playlists, orientation/scale, bounded image logos and
fade/cut/slide/zoom. Invalid compositions report an error. Native orientation/scale overrides now persist for the current device and
portal revision only. A changed portal revision or revocation clears them; Follow portal
also restores remote values. Overrides report appliedVersion 0, which currently
appears as pending changes. Planned admin diagnostics: distinguish local override,
offline lease expiry and decoder errors; do not interpret pending as proof of a
broken screen. Backgrounding clears media and resumes with server authorization;
transient restore/listener failures retry without forgetting pairing. Clients cannot
extend their own authorization; the cached-player grant is described above.
Paired API 36 single-image acceptance passed: local orientation/scaling, portal
revision reset, foreground network expiry/automatic recovery and offline
background/resume. Identical saves do not clear overrides; change a setting or
choose Follow portal on-device. Video-only and video/image/logo split outages now
passed on API 36: all layers cleared at lease expiry and recovered automatically
after connectivity returned. Physical TV and prolonged soak tests remain.
Composition unit/lifecycle checks pass; API 36 live checks verified both splits,
six logo placements, both sizes/removal and playback with all transition modes.
Revocation cleared the test display; temporary debug access was removed. Motion
smoothness and dual-video/physical-device acceptance remain pending. Planned admin recovery: inspect both region assignments and logo
identity, reset a problematic screen to single/no-logo/cut through audited controls,
and distinguish decoder failures from authorization expiry. These recovery controls
are not implemented. At most two media surfaces per region overlap in transitions;
low-memory/dual-video hardware testing is still required. Media remains in memory.
The first split recovery attempt exposed an expired cached debug token whose
registration had been removed: permission denial signed the app out and showed
Display access ended. Retesting with a valid temporary registration passed.
Planned diagnostics must distinguish App Check rejection from device revocation;
the current access-ended message alone does not establish the cause.
Support must distinguish an emulator App Check setup failure from a revoked
screen or expired trial. Emulator acceptance passed with a temporary debug grant,
removed afterward; release Play Integrity/signing acceptance remains pending. Never
expose debug secrets in admin UI or weaken enforcement for a device. Native leases
use server time minus the full request round trip to tolerate device clock drift
without extending access. Test-screen revocation cleared content; extended offline
and physical-device testing remain pending.

Client submission review (deployed and live-tested, 2026-10-23): private originals and
metadata lists; full validation and explicit owner approval precede playable media.
Limits are 20 reservations/client,
100/business, 20 MiB/file and 1 GiB/business; reservations include unfinished/rejected
files. Planned diagnostics: reservation/expiry, creator and client version, immutable
generation, counters, signature result, token stripping and audit. Owner controls
now validate, preview for up to 60 seconds, approve, decline and withdraw. Validation
uses the shared image decoder/private video worker; three attempts, 210-second lease.
Promotion consumes normal media quota too, without duplicating stored bytes.
Withdrawal denies new screen manifests; an issued lease can last 60 seconds and
affected playlists can go blank until repaired. Archive does not withdraw adverts.
Planned admin controls: diagnose stuck validation leases, retry exhaustion, worker
configuration/private invocation, derivative policy/generation, review versions,
promotion counters and affected playlists. Recovery must retain immutable validation
and explicit owner approval. Platform admins do not have approval/preview bypasses.
Submission cleanup/quota recovery release (2026-10-23): backend, lists, index and UI deployed;
actual live deletion/quota release remains pending eligible records.
Owner-only, one submission per request, version-bound, with an eight-day upload
grace period and validation-lease buffer. It protects all promoted library media.
Generation-conditional original/orphan-derivative deletion precedes atomic business
and advertiser counter release; tombstones and cleanup audits are retained.
Planned admin diagnostics: eligibility time, cleanupFrom/cleanupVersion, retiring
records, storage 403/412/5xx, counter mismatches, retained library references and
index readiness. Recovery is an owner retry after the underlying issue is repaired;
no admin counter-reset or force-delete bypass exists. Do not lower counters without
audited storage cleanup. See CLIENT_SUBMISSIONS.md.
Live acceptance covered valid image/video and malformed PNG, owner previews and
approval, live screen playback, withdrawal and final client/display revocation.
Three private test submissions remain. The failed PNG first becomes eligible on
31 October 2026 at 6:32 pm Sydney time; the two withdrawn library assets are
protected. Do not backdate reservations to manufacture eligibility. Storage checks
confirm the existing narrow runtime delete permission; no new IAM grant is needed.
All 37 callable postflight checks passed. The ready index and live safety-period
UI were checked; counters stayed at 3 submissions / 774,228 bytes. No authenticated
cleanup was attempted because no eligible test file exists yet.

Interactive AI/package planning (2026-10-23): advertising tiers of 1/3/5 screens,
POS plus advertising, and separately charged interactive AI. Prices and metering
remain undecided. Planned controls: audited entitlements, allowances, usage, trial
expiry, experience disable switch, approved animation/trivia and camera diagnostics
without visitor recordings. See INTERACTIVE_AI.md.

Advertiser invitation backend (deployed and live-tested, 2026-10-23): one pending invitation and
one accepted login per client, seven-day expiry, one-minute replacement cooldown.
Archive invalidates pending and accepted access; restore requires a new invitation.
Planned diagnostics: client versions, expiry/replacement, issuer status, trial and
lifecycle audits. No admin invitation or impersonation UI exists.
Owner invitation forms and `/client.html` are deployed. Client sign-in uses a
separate Firebase app and tab-session persistence to preserve the owner session.
Support guidance: check invited email, archive/version changes, replacement, expiry,
current verified identity and trial before issuing another link. Owners share links
themselves; the platform does not send invitation emails. Platform-admin access is
never conferred by a client invitation. Raw links/recipient emails must not appear
in public diagnostics.

Advertising client register (deployed and live-tested, 2026-10-23): owner-managed names,
archive/restore and audited versions; 100 total records including archived ones.
Planned admin controls: inspect tenant/client state, diagnose stale versions and
retry conflicts, reconcile record counts and review bounded allowance changes.
Never interpret a record as an Auth account or business membership. No client sign-in,
uploads, approval/publishing or admin mutation controls exist yet. Archive currently
preserves existing playlists. Future access revocation and approval withdrawal must
be enforced before client accounts are introduced. See ADVERTISING_CLIENTS.md.

Campaign date limits (deployed and live-tested, 2026-10-22): optional inclusive first/last
calendar dates clip weekly slots in the location timezone, including overnight tails.
Planned admin diagnostics should show those dates, date-expiry versus weekly inactivity,
and midnight lease cutoffs; future resets must preserve or explicitly remove both
date fields with an audit. Valid years 2000–2199; no date-only full-day mode yet.
Playback/reporting share the evaluator. Admin editing controls remain unimplemented.

### Diagnostics foundation

Deployed addition (2026-10-22): a name-ordered business directory with
20 entries per page, Next/Previous and Refresh from start. Selecting a business
fills its ID and loads diagnostics; exact-ID lookup remains available. The callable
`listPlatformBusinesses({after: null | businessId})` repeats the same verified MFA,
App Check and current `business.read` checks on every page. It returns only ID,
name, country and currency, and atomically audits the returned business IDs.
The cursor is a validated business ID, never a client-selected query or page size.
Duplicate names are ordered by Firestore's document-ID tie-breaker. Deleted cursors
require starting again. This is a live directory, not a frozen snapshot: businesses
renamed or added during browsing can move between pages. Documents without a name
are excluded by the ordered query; provisioning always requires one. No search,
business edits or new client-rule grants are introduced.

Validation: all 77 tests pass, including duplicate-name pagination, redacted output,
MFA/permission denial and per-page audits. Synthetic browser checks passed Next,
Previous and business selection. Build passes. The new callable, refactored
`getPlatformBusiness`, and Hosting are deployed. Live MFA acceptance passed: load
the directory, select Test Cafe by name, and load its diagnostics without copying
an ID. Both directory and subsequent diagnostics audit records were verified.
All 22 callable checks and matching release asset checks pass. Production has one
business, so multi-page acceptance remains covered by emulator and synthetic UI
tests rather than live production data. No production test businesses were created.

`/admin.html` calls `getPlatformBusiness` with an exact business ID. It shows business
country/currency, trial expiry, locations, screen state and requested/applied versions,
last report and media status. It returns at most 10 locations, 20 screens per location
and 50 media entries; truncation is explicitly labelled. It is not a complete inventory.
No private media links, bucket paths, owner emails, pairing secrets or raw errors are returned.

Access requires App Check, a verified active non-device identity, an MFA-authenticated
session and a current server-owned `platformAdmins/{uid}` record with `active: true`
and `permissions: ['business.read']`. Business membership and custom admin claims do
not grant access. Each successful lookup atomically writes `platformAudit` with actor,
business, operation and timestamp. Denied/missing-business lookups are not recorded
there yet; audit search, retention and export remain planned. Both collections deny
all direct Firebase client access. Revocation takes effect on the next lookup.

MFA checks use Firebase's reserved sign-in claim, documented in the
[Admin SDK token reference](https://firebase.google.com/docs/reference/admin/node/firebase-admin.auth.decodedidtoken).
The admin page now supports password sign-in, authenticator enrolment after password
reauthentication, and TOTP sign-in. The business portal uses the same MFA challenge
dialog so enrolled users can still sign in there. Codes and admin-page passwords are cleared on
submission; setup keys remain only in the live setup page and are removed on cancel
or completion. Enrolment signs out to require fresh MFA sign-in. No QR image service
receives setup keys; use the authenticator's manual Time based setup-key option.

Identity Platform TOTP is enabled with one adjacent interval; customer-wide MFA is
optional, while the diagnostics endpoint requires it. Existing Auth settings are
preserved. See [Firebase's TOTP guide](https://firebase.google.com/docs/auth/web/totp-mfa).
`scripts/firebase-admin-setup.mjs grant <approved-email>` requires an existing verified,
active TOTP-enrolled user and atomically creates only `business.read` plus a bootstrap
audit. It refuses to overwrite an existing grant. Never bypass the MFA gate or silently
grant broader permissions. No credential/secret is read or stored by this script.

Recovery: if the authenticator is lost, a trusted project operator must independently
verify identity, revoke the platform grant and refresh tokens before a separately
approved factor reset/re-enrolment. There is no self-service MFA removal or support
reset UI in this release. Keep a secure authenticator backup. Grant removal prevents
future lookups; it cannot erase diagnostics already viewed.

Validation: synthetic browser checks cover rejected-code retry, successful completion
and cancellation. The existing 76-test suite covers backend authorization and rules.
Production build and postflight include the additional callable/page and MFA settings.
Live enrolment and signed-in diagnostics acceptance require the project owner to enter
their own credentials and authenticator codes.

Live acceptance passed on 2026-10-22: the owner completed authenticator enrolment and
fresh MFA sign-in. The explicitly nominated verified account received only
`business.read` through the trusted bootstrap script. The live admin page loaded
Test Cafe's trial, blacktown location, seven revoked acceptance screens with version/
last-report details, and four media statuses. Both bootstrap and business-read audit
entries were independently verified. No screen was paired or customer content changed.
Account identifiers and authenticator secrets are not stored in this release note.

Workspace overview (business feature deployed): planned admin controls to diagnose missing
or stale heartbeats, distinguish loading/errors from acknowledged versions and inspect
trial expiry. Document the two-minute freshness threshold and clock-skew tolerance.
The customer overview does not confer platform-admin access or prove physical visibility.

Media reporting (business feature deployed): planned admin diagnostics for rejected/stale
batches, device clock skew, missing reports, duplicate suppression, 120-start/minute
limits and aggregate contention. Inspect location timezone and counting semantics;
define audited correction, retention and export controls before advertiser billing.
Do not present reported starts as audience impressions or independently verified plays.
No reporting admin UI, raw event history or billing-grade verification exists yet.

Weekly media scheduling (business feature deployed): planned admin controls to inspect
location timezone, both regions' effective eligible items and the next cutoff;
diagnose missing timezone, device-clock drift, empty schedules and renewal failures;
reset a schedule through audited owner-equivalent validation. Show overnight/DST
semantics and overlapping entries without claiming guaranteed airtime. Keep signed
URLs out of diagnostics. No platform-admin scheduling UI is implemented.

Split layouts/logos (business feature deployed): planned admin controls for resetting a screen
to single-region/no-logo, reviewing both playlist assignments and audited changes,
enforcing image-only logos, allowed placements and bounded 12%/18% size defaults.
Monitor dual-video decoder/memory failures, incomplete composition acknowledgement,
manifest/signing latency and quota (up to 41 unique assets), and stale player versions.
Keep layout resets tenant-scoped and subject to the same media/trial checks.

Form usability (deployed 2026-10-21): failed submissions retain the existing form
and selected file, show a focused inline error and restore controls for retry.
Client hints cover file type/size, pairing-code format and required invitation
locations. Backend validation remains authoritative. Planned admin/support needs:
keep displayed limits aligned with server policy, review safe error wording and
diagnose failed actions without collecting passwords, files or form drafts.

Except for the bounded read-only fields described above, controls below are planned. Existing values describe current application
behaviour, not values already editable in an admin UI.

| Area | Controls and diagnostics to account for | Current constraints |
| --- | --- | --- |
| Businesses and onboarding | Search businesses; inspect provisioning state; diagnose failed onboarding; suspend/restore platform access; controlled ownership recovery | One self-service business per user; AU/AUD; no platform suspension workflow yet |
| Locations | Inspect locations and membership assignments; adjust location allowance; diagnose failed creation | 100-location creation cap in backend |
| Trials and entitlements | Inspect trial dates and module access; grant audited trial extensions; configure future trial policy and per-business module allowances | 14 days; no payment method; five modules; pairing requires an active screens trial |
| Team access | Inspect invitation state; revoke pending invitations; diagnose email mismatch, expiry and membership issues; controlled staff-access recovery | Invitations expire after 7 days; customers cannot grant ownership through invitations |
| Pairing | Inspect expiry, claim/consumption state and failures without exposing secrets; invalidate sessions; diagnose failed redemption and signing | Ten-minute codes; one-time redemption; private secrets never displayed |
| Device registry | Inspect tenant/location/screen assignment; revoke access; guide replacement and re-pairing; identify abandoned registrations | 100 registrations per business, including revoked registrations; do not silently reclaim or reuse device identities |
| Abuse limits | View aggregate rejection counts; configure bounded per-business/user limits and temporary exceptions with expiry | Creation: 10 per platform IP/app per ten-minute window; claims: 20 per user per window; shared networks share creation limits |
| Device health | Last report, connectivity, app version when available, configuration acknowledgement and failure details | Deployed calibration player reports applied version and errors; two-minute freshness threshold; signed-in browser acceptance passed |
| Display settings | Inspect requested/applied versions; bounded defaults and overrides; diagnose stale-write conflicts; audited retry/reset to a known configuration | Deployed owner controls: four rotations and fit/fill/stretch; versioned audit. Platform-admin controls remain planned |
| Media intake | Inspect reservation/upload/rejection/retiring status; configure bounded allowances; diagnose signature mismatches and stuck cleanup; reconcile quota against retained objects; monitor signing and token-removal failures without displaying credentials | Deployed: 100 reservations, 1 GiB/business, 20 MiB images, 100 MiB videos, 30-minute reservations capped by trial. PUT grants last at most five minutes and can outlive membership revocation until expiry. Interrupted uploads restart. Owner cleanup: 25 entries/call after eight-day grace, exact generation deletion and audited quota release. Uploaded files preserved; tombstones retained. Soft-deleted bytes may still be billed. Sydney Storage security configuration and finalization trigger are deployed; browser upload/rejection acceptance passed |
| Infrastructure health | Read-only Auth/App Check, function, signing and TTL status; actionable diagnostic guidance | Infrastructure changes remain deployment-controlled; no UI switch to bypass App Check, tenant authorization, or Firebase rules |
| Audit and support | Search privileged actions by business, actor, device and time; record support reason and outcome; export redacted diagnostics | Business-level audit records exist; platform-admin audit and support tools are not implemented |

## Upcoming-feature inventory

Playlists/transitions are deployed (2026-10-21). Planned admin controls:
inspect ordered assignments and versions; diagnose failed slots without signed URLs;
audit edits and reset to calibration; configure bounded item counts (20), image
durations (3–300 seconds) and allowed effects (fade/slide/zoom/none, 450 ms).
Expose reduced-motion fallback, pending player upgrades and slow-download delays;
do not present nominal slot duration as verified advertising airtime. Keep resets
subject to tenant access and validation. No platform-admin UI exists yet.

Video validation is deployed privately (2026-10-21). Planned admin controls:
worker availability, container/FFmpeg version, private caller binding and runtime
identity; bounded size (20 MiB), duration (60 seconds), resolution (1080p), frame
rate (30 fps), output size, processing time and instance caps; safe failure reasons,
three-attempt recovery and 210-second stuck leases. Show larger-upload quarantine
clearly. Track original/derived storage separately (at most 20 MiB extra per slot).
Diagnose browser download/decode/autoplay errors and blob cleanup without exposing
signed URLs. Silent playback is the first policy; audio and 4K need explicit later
compatibility decisions. Monitor the two-instance cap and retained worker images
(latest two), and provide a reviewed rollback workflow. Platform-admin controls
are not yet implemented.

Deployed image playback also requires planned admin controls for:
validation status, safe error reasons, three-attempt limit, two-minute stuck-worker
lease recovery, decoder policy/version and bounded resolution/size defaults;
audited revalidation and removal; original versus derivative storage reconciliation;
screen assignment/version diagnostics and playback signing failures. Derivatives
add at most 20 MiB per reservation outside the original 1 GiB quota, with 100
reservations per business. Current cleanup preserves ready and failed-validation
files. Do not expose signed URLs or introduce controls that bypass validation.
Playback leases last at most 60 seconds and expire with the trial; offline content
clears when renewal fails. These admin controls are planned, not implemented.

- Media and playback: full decoding/validation, processing failures, cache health,
  supported formats, schedules and controlled removal of invalid assets.
- Transitions: default effect and duration, permitted effect list, per-device
  compatibility and fallback policy; preserve explicit customer overrides.
- Layouts and logos: bounded region proportions, overlay size/position, compatible
  device limits, configuration preview and audited reset; planned.
- Advertising operators: inspect operator/client relationships, scoped invitations,
  suspension and recovery; preserve isolation between clients and businesses.
  Operator master accounts never confer platform-admin authority; planned.
- Media approvals: diagnose pending/rejected/withdrawn submissions and approved
  asset versions; audited recovery must retain technical validation and operator
  approval requirements; planned.
- Scheduling: inspect effective schedules, timezone/DST decisions, conflicts,
  campaign expiry and fallback content; bounded defaults and audited correction
  with a preview; planned.
- Playback reporting: inspect missing/delayed reports, duplicate suppression,
  aggregation lag, retention and timezone boundaries. Audit corrections, preserve
  report provenance and never present device reports as measured audience views;
  planned.
- Orders and POS: diagnose order/payment reconciliation; carefully scoped recovery
  actions with idempotency and audit trails, never fabricated payment status.
- Payments: supported providers, integration requests, merchant onboarding status,
  webhook failures and controlled retries. Secrets never returned to the browser.
- AI: provider/model configuration, budgets, per-module quotas, tool permissions,
  failure diagnostics and emergency disable controls.
- Notifications: templates, channel configuration, delivery failures, retry limits,
  preferences and consent-aware support tools.
- Plans: prices when decided, module packaging, allowances and effective dates.
  Changes to existing businesses must be explicit rather than silently rewriting agreements.
- Android/iOS: app releases, supported versions, compatibility flags and rollout
  controls; never force an untested update across customer screens.

## Authorization and change safety

Platform authority must be granted through a trusted bootstrap process, never
self-registration, a customer membership, client input or an editable profile.
Require strong administrator authentication, including MFA, and current
server-validated authorization on every admin operation. Use separate permissions
for support reads, business recovery, billing and platform configuration.

Route changes through validated backend operations. Record actor, target,
reason, timestamp, prior/new values where safe, and outcome in protected audit
records. Do not expose raw tokens, pairing secrets, payment secrets, unnecessary
customer content, or an unrestricted database editor.

Use bounded values, explicit scope (platform default versus business override),
versioned configuration and rollback where appropriate. Expiring exceptions
must revert automatically. High-impact changes need a reviewable preview.
Decide and test how settings propagate, including offline screens, before exposing
a control. This document does not itself grant new client access or admin roles.

## Screen guidance support checkpoint — 2026-10-24

Business portal help now explains downloaded playback, schedule/trial cutoffs,
restart authorization and local Home-app selection. This adds no admin control.
Support should distinguish a recent Applied acknowledgement from visible playback,
and ask owners to reconnect after an offline expiry or restart. Home-app selection
and reversal remain local device actions; the portal cannot change the launcher.
Physical hardware validation remains pending (no device available). This copy-only
checkpoint builds successfully but is not deployed; browser preview timed out.

Screen guidance deployment follow-up (2026-10-24): `41250e7` is now live on
Hosting. Owner help expansion/collapse, narrow-width readability, and Android /
browser pairing guidance passed live inspection. No new admin control or access
grant was introduced. Active-screen editor hints were not exercised because all
test screens remain revoked; physical-device acceptance is still pending.

## Trial-expiry guidance — 2026-10-24

The business dashboard explains trial expiry using the existing server-owned end
time. This is informational only; no trial-extension, billing, entitlement-edit
or renewal control is added to either portal. Existing admin diagnostics remain
the source for investigating trial dates. Do not promise continuation or instruct
support to edit raw entitlement records; a reviewed continuation workflow and
pricing remain pending. Local dashboard tests and build passed; not deployed.

Trial guidance deployment follow-up (2026-10-24): `dc9a50c` is live. Owner
countdown, labelled exact expiry, expanded help and overview refresh passed live
inspection. Full Firebase postflight passed. No entitlement was changed to force
expiry; expired-state and staff wording remain local test coverage. No new admin
powers or continuation mechanism were introduced.

## First-screen onboarding guide — 2026-10-24

Owner onboarding now links existing setup controls in a five-step guide. No
admin operation, completion flag or automatic access grant is added. Support can
walk an owner through location/time zone, pairing, validation, playlist save and
visible playback checks. Pairing still uses the existing server checks; guide
visibility is informational, not an authorization boundary. Fresh-operator and
physical-device acceptance remain pending. Local tests/build passed; not deployed.

First-screen guide deployment follow-up (2026-10-24): `2b3e3a7` is live. The
owner guide's default expansion, disclosure toggle, section links and pairing-form
shortcut passed live checks. Firebase postflight passed. No grant or upload was
made, and no admin behavior changed. Fresh-operator acceptance remains pending.

## Hosting release guard — 2026-10-24

A local predeploy hook rebuilds and validates Hosting output. There is no new
portal control or permission. If it fails, inspect the named missing/unexpected
file, fix the source/build input and rerun preparation; do not bypass the hook.
New intentional public asset types require an explicit allowlist update and tests.
The hook does not scan compiled bundles for secrets, validate all module imports,
or authorize deployment. Existing postflight/security checks remain mandatory.
Tests and the real build passed locally; no live deployment in this milestone.

## Hosting recovery — 2026-10-24

Hosting recovery is an operator procedure in HOSTING_ROLLBACK.md, not a new admin
portal button. Read-only rehearsal reproduces retained application files and
checks the live release remains unchanged. Both prior/current versions matched
13 files; no live switch was made. Admins must select a compatible retained
version and record the incident and verification; this cannot restore backend
services or customer data. No IAM or retention changes were made.

Hosting recovery follow-up (2026-10-24): explicitly authorized live rollback and
restoration passed with exact file checks and full postflight. Owner workspace,
library and client-record reads recovered after a tab refresh. Record version
and release IDs separately; Firebase requires type to be omitted when creating
a release with versionName. Existing open tabs can retain earlier code. No admin
portal powers, IAM, backend configuration or customer records were changed.

## Keyboard playlist support — 2026-10-24

Playlist reordering now returns focus to the moved item's media selector and
announces position, with explicit position/media labels on move/remove controls.
No admin permission or backend behavior changes. Support should record browser,
keyboard/screen reader and the operation when investigating focus loss. Browser
acceptance remains pending; local build/regression checks passed, not deployed.

Playlist keyboard deployment follow-up (2026-10-24): `0b8a773` is live. Approved
temporary-device editor acceptance passed for add/reorder/remove focus, accessible
labels, position messages and the 20-item boundary. Draft changes were not saved.
The test screen was revoked and denial verified. Predeploy guard execution and
full postflight passed. Spoken screen-reader output remains pending.

## Pilot support and public delivery — 2026-10-24

PILOT_SUPPORT.md documents symptom triage, minimal evidence, access boundaries
and escalation. scripts/check-public-site.mjs checks public delivery without
credentials or mutation; it does not inspect customer records or add admin UI.
Three tests and a live four-page/nine-asset probe passed. No automated alerts or
on-call coverage are created. Assign a support owner/contact before the pilot.

## Cloud operational alerts — 2026-10-24

Four public HTTPS uptime checks and two alert policies (sustained page failures
and repeated service HTTP 5xx responses) are now enabled in Cloud Monitoring.
See MONITORING.md for IDs, thresholds, status commands and delivery evidence.
The recipient is the address explicitly authorized by the developer. No admin
portal controls, customer grants, IAM changes or public worker access were added.
Operators with existing cloud authority can inspect incidents and review channel
or threshold changes in Monitoring; the setup script refuses configuration drift.
Use a bounded snooze for maintenance and verify it expires. Individual screen
health, missing metrics, quota/budget alerts and backup recovery remain uncovered.
Never weaken Firebase authorization to make a check pass. Human support ownership
and notification delivery confirmation are distinct from creating alert policies.

Delivery follow-up (2026-10-24): the owner confirmed receipt of the labelled
synthetic test email. Its metric was cleared and test policy disabled; production
policies remain enabled. Recovery-email delivery was not tested.

## Individual-screen alert preparation — 2026-10-24

Added a scheduled backend scanner and operational Monitoring configuration, not
yet deployed. See SCREEN_ALERTS.md for grace periods, IDs, capacity limits, IAM
prerequisites, rollout and rollback. No admin UI powers or Firebase rule grants
were added. Existing MFA diagnostics can resolve incident screen IDs and heartbeat
times. Platform operators will manage thresholds/recipients/snoozes in Monitoring;
business-hour exclusions and customer preferences remain planned. Revocation or
trial expiry can close an incident without playback recovery. Scanner failure is
covered by a separate missing-completion policy after its first successful sample.

Screen-alert rollout (2026-10-24): worker and both policies are deployed. The user
approved the runtime metric-writer IAM grant; Scheduler invokes the worker privately
using that identity. Live temporary-device testing observed grace-period zero,
overdue one after 15 minutes, and zero after reconnecting. The owner confirmed both
opening and recovery emails before test-device revocation. Access denial verified;
temporary tab closed. See SCREEN_ALERTS.md for IDs, timings and postflight command.
Missing-scanner notification delivery remains untested. No new admin UI controls.

## Data recovery preparation — 2026-10-24

Read-only audit found no scheduled Firestore backups and PITR disabled; Storage
has seven-day soft delete. DATA_RECOVERY.md and backup-status.mjs document current
protection and a not-yet-applied daily seven-day backup option. No cloud settings,
IAM or admin UI controls changed. Synthetic Auth/Firestore/Storage export/import
passed on fresh emulators, including tenant boundaries and revoked-device denial.
Platform recovery must reconcile revocations and access changes made after the
snapshot before any cutover. Restore to an isolated database first; business owners
must not receive database restore or Auth export powers. Live backup/restore,
Auth recovery, retention choice and recovery ownership remain open gates.

Backup rollout follow-up (2026-10-24): daily managed Firestore backups with seven-day
retention are enabled under explicit user authorization. Status lists paginated
backup metadata for the current database UID. First backup is not yet available;
cloud restore remains pending. The prepared restore helper rejects the live
destination and pre-existing destination database/rules release. No restore UI,
permissions, production cutover or customer access changes were introduced.

## Small-screen media selection guidance — 2026-10-24

Playlist and logo forms display the full selected media label below their dropdowns,
including existing reference labels, so clipped names can be checked on narrow
screens. Changes use textContent and introduce no permissions or admin controls.
For selection complaints, check this label against the existing library reference;
normal playlist/logo editing remains the recovery path. Local narrow-form rendering
and selection/addition/removal checks passed; build and five focused tests passed.
Not deployed. Physical-phone/Safari verification remains separate.
