# Security foundation

## Parser dependency checkpoint — 26 October 2026

Release-readiness audit found GHSA-27r3-jxmh-p828 in the backend's transitive
body-parser 2.3.0 dependency. Updated the backend lockfile to 2.4.0 and the
Firebase tooling resolutions to 2.4.0 / 1.20.9, within existing dependency ranges.
No application code, authorization policy or package manifest changed.
Advisory: https://github.com/advisories/GHSA-27r3-jxmh-p828.

Installed versions were checked with npm ls. The patched backend production
audit reports zero known findings. The root development toolchain still reports
11 findings (6 moderate, 5 high); this is not a clean whole-repository audit.
All 196 regression/backend/rules tests pass with the patched dependencies (also
196 passed before the update). The production web build passes. These checks used local Node 22.14.0, which emits
engine warnings; the declared/deployed runtime is Node 24. This is a local fix,
not deployed. Redeploy the platform functions and repeat deployment/security
postflight before claiming the live backend has this patch.

## Current baseline

Firestore permits scoped management reads and validated device status writes;
see AUTHORIZATION_MODEL.md. RTDB and Storage deny every client request.
Firestore and RTDB rules were deployed on 2026-10-20. Storage rules remain local;
no application Storage bucket was provisioned in this deployment.
Privileged server SDKs bypass rules and require explicit authorization.

Validation on 2026-10-20: all 14 local emulator tests passed using Node 24.19
and Java 25. The emulators compiled/loaded the rules successfully. Expected
permission-denied messages occurred in negative tests. Java emitted upstream
deprecation warnings; no test failed. This validates the initial grants only,
not the full future release checklist below.

Provisioning milestone: combined suite now passes 21 tests, including concurrent
onboarding, protected trial dates, owner-only locations, invalid input, account
disabling, missing App Check context, and revoked sessions. Service tests use
real Auth and Firestore emulators; production attestation and deployed transport
are not tested. Backend production dependency audit reports zero findings on
2026-10-20; the separate development toolchain findings below remain outstanding.

Team milestone: 25 emulator tests pass, adding verified-email invitation matching,
expiry, issuer revocation, concurrent acceptance, forbidden owner invitations,
membership overwrite protection, and backend workspace isolation. Invitation and
user-access documents remain denied to direct client access by the default rules.

Deployment milestone: all six callables are active under a dedicated limited
runtime identity and reject requests missing Auth/App Check with HTTP 401.
Live App Check enforcement is enabled for Auth, Firestore and RTDB. Live checks
also confirmed password policy, reCAPTCHA domains, Hosting headers/assets, Sydney
Firestore deletion protection, and rejection of anonymous RTDB reads.
The deployed page loaded without captured browser errors. This is not evidence
of successful mailbox delivery or a completed real-user onboarding flow.

The reference ordering project's local Firestore rules contain an unconditional
read/write grant. Do not copy it. The live deployed rule state is unknown.
Existing production systems must not be changed as part of this project setup.

## Required authorization tests before release

- Anonymous callers cannot access private business data.
- Business A cannot read, list, or mutate Business B's data or media.
- Staff cannot elevate roles, create memberships, or change trial/entitlement dates.
- Location-limited members cannot access unrelated locations.
- Revoked members and devices lose access.
- Devices read only assigned content/configuration and write only permitted status fields.
- Clients cannot spoof payment results, order totals, ownership, or audit entries.
- Public projections contain only intended fields; guest order access is scoped.
- Storage operations enforce tenant access, allowed types, and size limits.
- RTDB presence permissions cannot grant access to sibling devices or businesses.
- Backend operations perform equivalent checks despite Admin SDK rule bypass.
- Duplicate payment events and retried commands do not duplicate effects.

Test both allowed and denied requests using local emulators. Include malformed
fields, unexpected fields, unauthenticated requests, and collection queries.

## Operational controls

Use managed server secrets, least privilege, audited membership changes, rate
limits, and upload processing. App attestation is an additional abuse control,
not a replacement for authorization. Record AI usage server-side and enforce
allowances before expensive work.

No card details belong in Firebase. Use payment-provider components. Do not log
credentials, full payment payloads, or unnecessary customer conversation data.
Define retention and deletion behavior before production use.

## Dependency audit, 2026-10-20

The initial Firebase development toolchain audit reported 13 findings
(5 moderate, 8 high), including transitive gRPC, OpenTelemetry, braces, uuid,
and re2 findings. These packages are development-only at this milestone.
Do not deploy or expose the emulator tooling as an application.
Some suggested npm fixes downgrade Firebase across major versions, so they
must not be applied blindly. Review compatible upstream fixes before production
dependency selection. Emulator tests are not a dependency security audit.
