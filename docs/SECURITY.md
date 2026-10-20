# Security foundation

## Current baseline

Firestore permits scoped management reads and validated device status writes;
see AUTHORIZATION_MODEL.md. RTDB and Storage deny every client request.
These local rules have not been deployed.
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
