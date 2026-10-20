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
| Infrastructure health | Read-only Auth/App Check, function, signing and TTL status; actionable diagnostic guidance | Infrastructure changes remain deployment-controlled; no UI switch to bypass App Check, tenant authorization, or Firebase rules |
| Audit and support | Search privileged actions by business, actor, device and time; record support reason and outcome; export redacted diagnostics | Business-level audit records exist; platform-admin audit and support tools are not implemented |

## Upcoming-feature inventory

- Media and playback: upload/storage allowances, processing failures, cache health,
  supported formats, schedules and controlled removal of invalid assets.
- Transitions: default effect and duration, permitted effect list, per-device
  compatibility and fallback policy; preserve explicit customer overrides.
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
