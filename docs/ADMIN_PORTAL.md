# Developer / platform admin portal

Required by the project owner. This portal is planned, not implemented.
It is separate from the customer business portal and must support the developer
operating Discrete Signage across businesses.

Update this inventory during every implementation milestone. Whenever a feature
introduces a configurable limit, default, policy, failure mode, or recovery action,
record the corresponding admin control here. Include its scope, validation,
audit requirements, and implementation status. Do not defer recording until the
admin UI is built.

## Current-feature inventory

All controls below are planned. Existing values describe current application
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

Video validation is implemented locally, not deployed. Planned admin controls:
worker availability, container/FFmpeg version, private caller binding and runtime
identity; bounded size (20 MiB), duration (60 seconds), resolution (1080p), frame
rate (30 fps), output size, processing time and instance caps; safe failure reasons,
three-attempt recovery and 210-second stuck leases. Show larger-upload quarantine
clearly. Track original/derived storage separately (at most 20 MiB extra per slot).
Diagnose browser download/decode/autoplay errors and blob cleanup without exposing
signed URLs. Silent playback is the first policy; audio and 4K need explicit later
compatibility decisions. Platform-admin controls are not yet implemented.

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
