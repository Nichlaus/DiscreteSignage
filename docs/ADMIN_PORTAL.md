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

Media form deployment follow-up (2026-10-24): Hosting e190165 deployed and full
Firebase postflight passed. Approved temporary-screen live checks covered labels,
selection changes, saving/reopening and No logo guidance. Temporary access revoked;
existing synthetic library files retained. No new admin controls or permissions.
See SIGNAGE_RELEASE.md for the acceptance record.

## Release test coverage maintenance — 2026-10-24

The local release runner now discovers policy/frontend tests and backend test
files, instead of a fixed list which omitted newer screen-health, monitoring,
restore-policy, Hosting, public-probe and setup-guide suites. No platform-admin
controls or cloud permissions changed. Use the full local gate before release;
failed checks must be investigated, not bypassed. Live security postflight and
backup restore acceptance remain separate. See DEPLOYMENT.md for the scope.

Validation: the expanded local gate passed all 133 tests in 25 files, with no
failures or skipped tests. Emulators shut down after completion. No deployment.

## Fresh-operator acceptance preparation — 2026-10-24

OPERATOR_ACCEPTANCE.md records the future pilot session and its cleanup boundary:
revoke its test screen, retain account/business/media unless separately reviewed.
No admin UI, account-removal endpoint, permission or cloud change was introduced.
Record onboarding failures with minimal references and redacted evidence; never
request passwords, verification links or MFA secrets. No operator is available,
so independent onboarding usability is still untested.

## Business market setup — 2026-10-24

Implemented owner-only business-type selection and tailored signage guidance for
food, retail, fitness, services, advertising operators and general businesses.
See MARKET_SETUP.md. Platform diagnostics expose the chosen type through the
existing MFA-protected business read; no platform edit control is added. Owners
can correct their own selection. Changes record actor and previous/new type in
business audit events; duplicate saves are no-ops. This metadata is not an
entitlement and cannot enable POS/AI or reset a trial. No IAM or client rule grants.
Not deployed; live admin visibility and owner-save verification remain pending.

Market setup deployment acceptance (24 October 2026): deployed 6970cc5 backend
functions before Hosting. Full Firebase postflight passed. Test Cafe owner saved
Food, reloaded and verified persisted guidance; MFA administrator diagnostics
showed the same type. Advertising guidance also verified. General restored through
the owner form and confirmed by a fresh admin lookup; trial end unchanged. No
screen access or media changes. See MARKET_SETUP.md for evidence and limitations.

## Food menu foundation — 24 October 2026

Owner-only per-location menu creation/editing and portal preview implemented;
not deployed. AUD cents, category references, availability, bounded input and
transactional expected-version checks are enforced by backend callables. Direct
client menu reads/writes remain denied. No menu publication to screens or POS.
Audit records carry actor/location/version/counts. Owner edits are the recovery
path; historical snapshots/undo and admin repairs are not implemented. Plan admin
menu diagnostics for saved version/counts/update time and validation failures;
never allow a repair to bypass ownership/authorization or version checks. See
FOOD_MENUS.md for limits, rollout and acceptance requirements.

Food menu live follow-up (24 October 2026): 9d787df backend and Hosting deployed;
full Firebase postflight passed. Test Cafe / blacktown empty menu used for category
creation/rename, item creation, AUD 12.50 → 10.99, Sold out and persistent preview
verification after reload. One labelled synthetic sold-out item/category retained.
No screens or prior menu content changed. Menu-specific admin diagnostics/repair
remain planned. See FOOD_MENUS.md for evidence and limits.

## Menu publishing preparation — 25 October 2026

Owner publishes saved menu snapshots through existing private media validation and
versioned screen settings. No new grant or admin mutation. Admin diagnostics can
inspect resulting media statuses and screen versions using existing controls;
menu-specific version/lineage diagnostics remain planned. Failed publication may
leave private pages consuming allowance. Do not delete referenced files as a repair;
use existing eligible cleanup controls where applicable. An owner can replace the
menu region through normal screen settings or republish a corrected snapshot.
No automatic updates or revision rollback. See FOOD_MENUS.md. Not deployed.

Menu publishing live follow-up (25 October 2026): 3c2a7e1 Hosting deployed and full
postflight passed. Approved Test Cafe browser acceptance confirmed a validated menu
page beside the existing video and Applied acknowledgement. Temporary screen
revoked; one private synthetic page retained. Existing media/screen controls were
sufficient for this check; menu lineage and dedicated admin repair remain planned.

Android menu acceptance (25 October 2026): existing menu/video assets passed native
downloaded playback and brief offline recovery. Owner status showed Applied after
reconnection; revocation cleared native media/cache. Temporary App Check access was
removed. No admin feature changes. Slow downloads can require retries before the
screen plays; inspect device status and actual display before diagnosing a menu
publication failure. See ANDROID_SETUP.md for the bounded test evidence.

Multi-page follow-up (25 October 2026): owner publishing created two ready pages
for saved test menu v6. Native cached rotation and automatic recovery passed;
revocation cleared all three cached assets. Two synthetic items/pages retained as
approved. No new admin controls or grants; menu lineage diagnostics remain planned.

## Portal AI foundation — 25 October 2026

Local draft validation and explicit owner review are implemented but not exposed
or deployed. AI drafting checks aiStudio separately from signage entitlement.
Existing screen-setting audits cover approved saves; there is no AI usage audit or
provider integration yet. See PORTAL_AI.md for scope and validation.

Before activation, planned admin controls include an AI disable switch, per-business
request/usage limits, provider/model configuration, sanitized failure and usage
diagnostics, and quota recovery. Secrets must remain server-side; diagnostics must
exclude raw prompts and credentials. Admin overrides must not bypass tenant/media
validation. A stale draft is regenerated; screen changes can be corrected through
existing owner settings. No new administrator permissions are introduced here.

Portal AI integration follow-up (25 October 2026): OpenAI adapter, secret binding,
callable and owner request/review form implemented locally. Server-only
platformConfig/assistant.enabled is an operational switch (default off); it stops
new reservations, not in-flight requests or existing drafts. Fixed limits are
20/business/UTC day, 100/business trial total and 1,000/platform/UTC day. Reservations
include failures; 60-second concurrency leases recover automatically. Quota records
contain counts and lease metadata, not prompts or secrets. Client SDK access is denied.
An admin UI for these controls, token costs and sanitized diagnostics remains planned.
Secret creation, live provider validation and deployment remain pending. See
PORTAL_AI.md for activation/recovery instructions; do not reset lifetime counters
as a routine fix. Existing screen audit events still cover approved saves.

Deployment follow-up: 347a65f assistant backend and Hosting deployed on 25 October
2026, with Secret Manager version 1 bound and the backend switch enabled. Full
Firebase postflight passed. Live AI acceptance remains pending owner sign-in;
the approved temporary display must be revoked after the test. No prompt/key
values are included in deployment evidence.

Live follow-up: OpenAI drafting, approved saves and visible image/video playback
verified. Review caught an incorrect duration; a later ambiguous-hours draft
invented times and was discarded. A tested deterministic hours-clarification guard
was deployed and verified live. Five business reservations consumed; not reset.
Owner review is still required for model interpretation errors. The guard also
counts as a request even though it does not invoke OpenAI.
Temporary display revoked and player denial verified; no test access remains.

## AI advert creation — 25 October 2026

Local generation callable and owner preview/save form implemented; not deployed.
Uses existing OPENAI_API_KEY secret and a separate default-off switch at
platformConfig/imageGeneration.enabled. Fixed caps: 3/business/UTC day,
10/business trial total, 100/platform/UTC day; failures count. Counters contain
usage and lease metadata only. A 240-second lease recovers interrupted generation.
Provider output is fully decoded before preview; approved library saves reuse
normal private-media validation and audits. See AI_IMAGES.md.

Image switch/usage diagnostics UI, actual cost reporting, model selection controls
and provenance tagging remain planned. For provider access failures check project
model access/verification without exposing the key. Do not lower moderation or
reset total quota as a repair. Failed library saves may retain quota-consuming
entries; use existing eligible cleanup, never delete files referenced by screens.
Unsaved previews are not stored and cannot be restored by an administrator.

Production activation and live test completed on 25 October 2026. The separate
image switch is enabled; the new callable reuses the existing secret binding.
Postflight passed. One approved coffee image generated, was visually reviewed,
then explicitly saved and fully validated in Test Cafe (reference 8ba95e43,
Ready for screens). Remaining image allowance: 2 today / 9 trial. No screen
settings changed. The test asset remains private. Planned admin controls above
are still not implemented; see AI_IMAGES.md for evidence and limitations.

AI advert Android acceptance (25 October 2026): existing generated coffee asset
8ba95e43 passed visible native playback, private-cache hash verification, a
38-second emulator-only network interruption and automatic recovery. Portal status
returned Applied. Temporary screen/access removed and cache cleared on revocation.
See AI_IMAGES.md for evidence and limits. No additional admin control or code change.

Portal AI usability follow-up (25 October 2026, local/not deployed): design/request
starters and explicit saved-advert handoff to the playlist assistant. No new
permissions, quota model or admin controls. Refresh failures keep the saved asset
and offer retry; account/business changes suppress the handoff. Existing admin
media diagnostics apply. No automatic generation or screen publishing is added.

All-day template correction (25 October 2026): live review caught model timing
errors before saving. An exact built-in prompt now produces selected items at
15 seconds with no schedule, through existing server validation and quota handling.
Custom requests remain model-generated and must be reviewed. The template does
not incur provider usage but still counts toward request allowance, disclosed in
the form. No quota resets or permission changes were made. See AI_IMAGES.md.

Final live all-day template acceptance passed: 15 seconds / Any time, explicit
approved save and visible browser playback. Final release postflight passed;
temporary screen revoked and denial checked. One private generated image remains.
Image allowance 1/day, 8/trial; playlist allowance 11/day, 91/trial after this test.

Guided playlist schedules (25 October 2026, deployed): structured exact
days/times and image duration use the existing assistant endpoint and review/save
flow. No AI call; existing request quota and platform enablement still apply. No
new admin permission/control or stored data collection. Existing location-timezone,
media-readiness, entitlement and screen-version diagnostics cover failures. Both
prompt and guided in one request are rejected. See PORTAL_AI.md for scope/tests.

Live scheduling acceptance exposed and fixed browser calibration fallback for an
authorized empty schedule. Empty regions now remain blank while their lease is
valid. For unexpected content outside hours, check the location timezone, selected
start day (including overnight tails), screen version and player release. No new
admin permission or quota override was introduced. Production postflight passed
after the Hosting correction; existing authentication and App Check gates remain.

Smooth cutoff follow-up (25 October 2026): browser region clearing now leaves the
blank stage visible during renewal, avoiding the connection-notice flash. Lease
expiry still clears media and reports error; explicit device revocation/stop still
shows connection UI. Diagnose prolonged blank playback through screen status and
connectivity, because renewal failures after playback no longer show customer-facing
connection text. No lease duration, authorization checks or admin permissions changed.
Ten player tests passed. Live acceptance on 25 October passed the 19:04 Sydney
cutoff: 252 observations spanning the boundary found no connection notice; expired
media disappeared and blank output persisted. Temporary access was revoked and
denial verified. See PORTAL_AI.md for sampling limits and evidence.

Existing-playlist assistant shortcut (25 October 2026, deployed): reuses
ready Playlist 1 media and uniform timing from the last refreshed owner workspace.
No additional quota, provider call or permissions to load the form; normal draft
quota and owner/device/entitlement/version gates apply when preparing/saving.
Repeated slots, mixed timing, campaign dates and unavailable media require the screen
editor. For stale selections, refresh screen status and the library first. No new
platform-admin control is introduced. Six targeted tests/build and local synthetic
browser checks passed. Hosting deployment and full production postflight passed.
Live owner testing restored a two-item playlist in order and its duration, then
reviewed and saved a schedule-only change. See PORTAL_AI.md for acceptance details.
Live reuse acceptance completed: saved timing reloaded exactly after refresh, image
and video rotated, and playback cleared at the new 19:34 Sydney cutoff without an
observed connection notice. Test screen revoked and denial verified; no new access
remains. No fixes or additional deployment were needed for acceptance.

Guided campaign dates (25 October 2026, deployed): optional date range
inside selected-hours planning; shared dated playlists can now be reused. Existing
server validation, trial/quota and reviewed save apply. No new admin control or
permission. Diagnose dates in the screen location timezone; the last date cuts off
an overnight tail at midnight. Mixed item date ranges remain a screen-editor task.
Nine targeted tests, build and local browser validation passed; live acceptance is
recorded below. See PORTAL_AI.md for scope and date-only limitations.

Campaign-date Hosting deployment and full postflight passed. Live owner acceptance
created a future campaign (blank today), reloaded its dates through reuse, then
adjusted the range to include today through the explicit reviewed save. No backend
or permissions changes were required.
Final campaign acceptance passed: today's date inside the adjusted range enabled
playback; refreshed reuse restored the saved range. Temporary screen revoked and
access denial verified. This tested date eligibility, not an actual midnight rollover.

Quick scheduling controls (25 October 2026, local/not deployed): day presets and
live timing summary are form-only helpers. Existing draft allowance, authorization,
server validation and approved save apply. No new admin control. Diagnose schedule
questions using the location timezone and the reviewed server draft; the summary
is not a playback-status signal. Eleven targeted tests/build and synthetic browser
checks passed. No deployment or production writes in this milestone.

Quick scheduling deployment (25 October 2026): Hosting and full postflight passed.
Live presets, summaries, reviewed saves and persisted daily schedule reuse passed.
Sunday excluded weekday playback; weekend advert rendered. Device status stayed
Playback error/waiting during slow updates despite visible playback; final daily
version acknowledgement remains unverified. Investigate status/recovery separately.
Temporary screen revoked and player denial confirmed. No new admin permissions.

Playback status recovery (26 October 2026, deployed): valid browser playback no
longer becomes an error solely because a renewal request fails; unchanged successful
renewals reaffirm readiness. Lease expiry, denied access and media failures retain
error/clear behaviour. No admin permissions or new controls. Diagnose using fresh
reports and applied-versus-saved version, then verify the actual screen. A currently
valid lease is not a promise of connectivity beyond its expiry. Sixteen focused
tests, build, production postflight and live active/blank/resumed schedule
acknowledgements passed. This closes the quick-days acknowledgement follow-up.

Conversational playlist editing (26 October 2026, implemented/not deployed): uses
existing owner-only AI draft access, usage limits and explicit versioned saves.
No new admin control or permissions. Retained durations/schedules are enforced by
the server; new items default to 15 seconds/any time. Diagnose rejected edits by
checking saved version, ready media, total available choices (20), and repeated
source media. Refresh stale workspace; use manual screen settings for repeated
entries and scheduling mode for timing changes. Current playlist media names and
timings join the provider context; no bytes, URLs, credentials or business IDs.
184 emulator tests, focused provider/form checks and local synthetic review passed.
Production deployment and real-provider interpretation tests are pending.

Conversational editing live acceptance (26 October 2026): function and Hosting
are deployed; production postflight passed. Three real OpenAI add/reorder/remove
requests preserved mixed image durations and a weekday dated campaign. Refreshed
final settings matched the review and screen reported Applied. Existing quota
charged three requests; no grants, limits or rules were changed. No fixes needed.

Advert editing and brand references (26 October 2026): implemented, not deployed.
Owners can edit/ vary a ready image using an optional library logo and three hex
colours. Only validated tenant derivatives are sent, after explicit consent;
private originals, URLs and storage identifiers are excluded. Existing image
quotas, trial gates and preview approval apply. No new admin grants or rules.
For unavailable references, check ready status, image-v1 policy, pinned generation,
hash and the 8 MiB limit. Revalidate/reselect through existing media controls;
do not bypass validation. For poor logo fidelity, ask the owner to discard the
preview or use the original asset. No admin brand editor, quota refund control or
automatic replacement exists. 189 tests and local UI checks passed; deployment
and a real OpenAI reference-image request remain pending.

Branded image live acceptance (26 October 2026): generateAdvertImage and Hosting
are deployed; security/delivery postflight passed. Two real image-edit requests
using validated synthetic source/logo references succeeded. Reviewed edit
94089690 and variation a5f302d2 were saved through normal upload/validation and
confirmed Ready for screens after refreshing the library. Source and screen
settings were unchanged; remaining image allowance 1/day, 6/trial. The variation
inverted logo colours despite the fidelity prompt: advise visual review and do
not promise pixel-exact branding. Exact logo compositing remains planned.
No IAM/rules/quota changes or additional admin controls were needed.

Original-logo placement (26 October 2026): implemented locally, not deployed.
Owners choose one of four corners or creative interpretation. In original mode,
the backend keeps the separate logo out of provider inputs and composites its
validated bytes after generation; source-embedded logos still go with the source.
Existing quotas, reference checks and limits remain in force. No new rules/IAM or
admin controls. Diagnose logo sizing against the 20% width / 15% height box and
no-upscaling policy; inspect the preview for contrast and duplicate old logos.
No admin override bypasses validation. Live acceptance is pending.

Original-logo live acceptance (26 October 2026): deployed function and Hosting;
production security and delivery checks passed. One real edit with Keep original
at top right preserved the synthetic logo's green background, cream lettering and
proportions visually, with no overlap. Approved save aab0671e (0.58 MiB) was
confirmed Ready for screens after refresh. Remaining image allowance: 0/day and
5/trial; no counters reset. No rules/IAM changes or screen access required. Local
tests cover the other three positions; those were not individually tested live.

Visual colour controls (26 October 2026): implemented locally, not deployed.
Three optional swatches/hex fields replace comma-separated entry. Clear and empty
palette behavior were verified locally without AI calls. No new admin controls,
permissions, stored records or quotas. For rejected colour input, use # plus six
hex digits or clear the field; backend still enforces at most three valid colours.

Saved business branding (26 October 2026): implemented locally, not deployed.
One private businesses/{id}/settings/branding document stores profile/version/time;
verified owners read through getBranding and save through saveBranding, with
active signage/AI trial required for writes. Version conflicts prevent overwrite;
audit event branding.saved identifies actor/version. No direct client grants,
new media uploads, provider costs or screen changes. A missing logo can be
replaced by loading, selecting ready branding and saving. Support can inspect
records through existing operational tooling; no admin profile editor or force
save exists. Colour pickers are deployed and passed live input checks separately.

Saved branding live (26 October 2026): deployed and verified Test Cafe profile
save/fresh-form load, logo bf591517, top-right and green/cream colours. New callables
reject anonymous requests under the expected identity. No quota or screen changes.
Playlist change summary is implemented locally, not deployed: adds/removes,
relative reorder and expandable timing differences. Existing approval/version
checks remain. Repeated IDs use occurrence matching and require full-list review.
No new admin controls or stored data for the comparison; five focused tests pass.

Final portal AI review acceptance (26 October 2026): deployed and tested on an
approved temporary screen, then revoked with player access denial confirmed.
Add/remove/reorder summary and approved save passed; screen reported Applied and
rendered the original-logo advert. Invalid model media were rejected; a draft with
incorrect order was discarded. Use dedicated edit mode for rearrangement and
guided timing for exact schedules. Review now uses loaded library names for
removed/deselected assets. No new privileges/quotas/admin controls. Full postflight
passed before the label-only correction; final Hosting delivery passed afterward.
Portal AI scope frozen: reliability and necessary fixes only for this phase.

Cloud recovery follow-up (26 October 2026): two READY backups observed for the
current default database. Authorized isolated restore into recovery-check-20261026
was accepted after one HTTP 500 and a checked retry; completion/acceptance pending.
The application remains on the default database. A read-only operational verifier
checks completion, closed client access, restored relations/indexes and sample
Storage generation metadata without printing records. This is cloud-operator
tooling, not a new admin UI permission. Named databases share project IAM and incur
storage charges; retain the destination only until evidence and reviewed cleanup.
No restore, cutover, deletion or Auth-export power is granted to platform admins.
See DATA_RECOVERY.md for the exact backup, operation and outstanding limits.

Cloud rehearsal completion (26 October 2026): restore succeeded in 13m18s.
Bounded Firestore relationship/timestamp checks, one READY index and anonymous
denial passed; 35 restored devices were revoked. Storage generation metadata
verification was blocked by operator IAM (zero objects checked); no permissions
were broadened. Test database cleanup was requested and absence confirmed by 404.
Production identity/deletion protection and backups remain intact. This does not
verify Auth/media-byte recovery or authorize production cutover. No admin UI change.

Parser security maintenance (26 October 2026): updated compatible transitive
body-parser versions for backend/tooling. Backend production audit is clean;
separate development-tooling findings remain. No admin controls, IAM, rules,
records or quota changes. Patch is local until the platform functions are
redeployed and postflight passes; see SECURITY.md.

Interactive prototype (26 October 2026): local-only authored cat/trivia and simulated
pointer/touch input. No Firebase reads/writes, AI calls, camera access or admin
permissions. Before production integration, implement separate interactive
entitlements, business/device opt-in, a disable switch, approved experience version
and non-recording camera diagnostics. These controls remain planned, not enabled
by the prototype. The outstanding backend parser patch still needs deployment.

Native interactive preview (26 October 2026): Java debug-only, unexported activity
reachable from local developer settings. No camera permission, provider request,
stored visitor data, backend entitlement change or production availability. Release
integration still requires owner opt-in, separate interactive access, device camera
permission, an admin disable control and advertising fallback. The current exit
uses the existing fresh playback authorization path; paired recovery remains untested
for this new activity. See INTERACTIVE_AI.md for emulator scope.

Debug camera probe (26 October 2026): explicit per-session local enable plus Android
permission, visible first-frame status and stop/failure/pause cleanup. Frames are
discarded locally; no microphone, recording, analysis or provider traffic. This is
not a production entitlement or remote camera-start control. Release manifest stays
camera-free. Platform admins cannot remotely grant device camera permission. Real
camera support, consent and product fallback acceptance are still pending.
Final synthetic emulator checks passed start/stop/restart, late-open cancellation
and native exit. Cleanup verified no active camera clients and CAMERA granted=false.
No production deployment, new Firebase grant or physical-device access occurred.

Local hand tracking checkpoint (26 October 2026): debug-only MediaPipe model/SDK
and single-worker frame processing follow one palm and detect a bounded wave
heuristic. No images/landmarks are stored or sent. Model checksum/setup and synthetic
emulator acceptance are recorded in INTERACTIVE_AI.md. Hardware gesture accuracy
is unverified; do not expose this as a production entitlement or promise compatibility.
Admin disable/version controls, owner opt-in and production fallback remain planned.
# Native trivia pointing preview — 26 October 2026

Debug Android preview only: five camera-space targets, 900 ms hold, neutral gaps,
loss/stale-frame cancellation, one answer per round and neutral release after
restart. No platform-admin control or Firebase permission was added. Operators
can stop the camera or leave the preview; backgrounding closes capture. Real
camera calibration and gesture accuracy are pending physical hardware. Production
enablement and any future admin diagnostics remain planned; do not collect camera
images or landmarks for diagnostics.

