# Initial authorization model

The first grants cover management reads and device status writes only.
Provisioning now uses the backend endpoints documented in ONBOARDING.md.
Configuration writes, commerce, and AI endpoints are not implemented.

## Server-managed records

- `businesses/{businessId}`: business metadata visible to active members.
- `businesses/{businessId}/members/{uid}`: `active` boolean, `role` of
  `owner`, `manager`, or `staff`, and `locations` map of location IDs to booleans.
  Owners access every location; other members need an explicit true entry.
- `businesses/{businessId}/devices/{uid}`: `active`, `locationId`, and `screenId`.
  Device auth tokens also require `device: true` and the matching `businessId`.
  Checking the live registry makes revocation effective without waiting for token expiry.
- `businesses/{businessId}/locations/{locationId}/screens/{screenId}`:
  assigned screen configuration. No secrets should be stored in this document.

Membership and device claims are exclusively server-controlled. Pairing and
invitation endpoints must enforce this model when they are implemented.

## Client access

| Actor | Read scope | Write scope |
| --- | --- | --- |
| Anonymous | None | None |
| Owner | Own business, memberships, locations/screens, individual device records/status | None yet |
| Manager/staff | Own business/membership, assigned locations/screens and individual device records/status | None yet |
| Device | Own registry/status and assigned screen | Own validated status |
| Revoked member/device | None through that identity's revoked grant | None |

Device status is `businesses/{businessId}/deviceStatus/{uid}` with exactly
`state`, `reportedAt`, and `appliedVersion`. State is `ready`, `downloading`,
or `error`; time must be a server timestamp; version must be a nonnegative integer.
Status is device-reported telemetry, not proof of payment or entitlement.

Owners may list members and locations. Staff must fetch assigned locations
individually and may list screens within those locations. Devices must fetch the
assigned screen by its exact path. Rules are not query filters.

Storage and RTDB remain entirely denied. Public menu projections and guest
ordering are not opened by this milestone.
