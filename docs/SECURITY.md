# Security foundation

## Current baseline

Firestore, RTDB, and Storage configurations deny every client request.
They are local bootstrap files and have not been deployed or emulator-tested.
Privileged server SDKs bypass rules and require explicit authorization.

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
