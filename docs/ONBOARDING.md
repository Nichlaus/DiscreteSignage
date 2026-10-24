# Business provisioning

Fresh-operator acceptance is pending. Use [the operator session guide](OPERATOR_ACCEPTANCE.md)
for a new-account, first-image and revocation test without developer coaching.
Prepared 24 October 2026; no operator was available to execute it.

Implemented callable functions (deployed 2026-10-20):

## `provisionBusiness`

Input: exactly `businessName`, `locationName`, and `timezone`.
Names accept 2–100 trimmed characters without control characters. Timezone
must be one of the supported Australian zones.

Requires Firebase Authentication, verified email, an enabled account, a
non-revoked authenticated session, and App Check. Device and anonymous identities
are rejected. The Firebase callable wrapper verifies authentication and App Check;
the service additionally reads the current Auth user record.

One transaction creates:

- AU/AUD business metadata.
- The initial `main` location.
- An active owner membership.
- A server-timed 14-day trial covering every planned module, without a payment method.
- An audit event and a private onboarding receipt.

Response: `{ businessId, locationId, created }`.
The receipt allows one self-service business per Auth UID initially. Concurrent
requests and retries cannot create duplicates or restart the trial. Reusing the
account with changed onboarding details returns `already-exists`; settings edits
will use separate authorized endpoints. This does not prevent someone creating
multiple verified accounts; broader trial-abuse controls remain a production task.

## `createLocation`

Input: exactly `businessId`, `requestId`, `name`, and `timezone`.
The client generates a unique request ID per intentional location creation and
reuses it on retries. IDs accept 1–128 letters, numbers, underscores, or hyphens.

Requires the same account checks plus a current active owner membership in that
business. A transaction creates the location and audit event and increments the
location count. Duplicate requests return the existing location. Changed payloads
with the same request ID fail. A provisional 100-location abuse cap applies until
commercial entitlements are implemented.

Response: `{ locationId, created }`.

## Boundaries and remaining work

- Region is configured as `australia-southeast1`; this does not select or migrate
  the Firestore database location.
- No client can write membership, onboarding receipts, trials, or audit events.
- Signage trial enforcement and expiry guidance are now implemented; see
  SIGNAGE_RELEASE.md for dated acceptance. Paid plans and AI allowances remain
  undecided. No free unlimited AI is enabled.
- The web portal implements signup, verification, password reset, business setup,
  locations, and invitations. Firebase web/Auth/App Check setup and initial deployment
  are complete. Membership editing is still deferred.
- Auth, App Check, Sydney Firestore, and runtime limits are configured. Review
  commercial quotas and usage monitoring before a customer launch.
- Tests invoke the service with test callable contexts and real Auth/Firestore
  emulators. They do not validate a production App Check attestation or deployed
  HTTP transport.
- Runtime: Node 24, second-generation callable functions. Reference:
  https://docs.cloud.google.com/functions/docs/runtime-support

## Local validation

Install root and backend dependencies, then run the combined emulator suite:

```sh
npm ci --ignore-scripts
npm --prefix functions ci --ignore-scripts
npm test
```

Requires Node 24.12+ and Java 21+. The runner uses only the demo project and
local Auth, Firestore, RTDB, and Storage emulators.

## Team endpoints

- `createInvitation`: owner-only, accepts `businessId`, `requestId`, `email`,
  `role` (`staff`/`manager`), and `locationIds`. Locations must exist in that business.
  Expires after seven days; retries cannot change or revive an invitation.
- `acceptInvitation`: accepts `businessId`/`invitationId`; requires the matching
  currently verified email and an active issuing owner. Transactionally creates
  membership, a private business lookup entry, and an audit event. It cannot
  overwrite existing membership or restore revoked membership.
- `revokeInvitation`: owner-only, accepts `businessId`/`invitationId`, revokes pending
  invitations. It cannot revoke an already accepted membership.
- `getWorkspace`: accepts `businessId` (empty string selects the first accessible
  business). Resolves server-owned lookup entries against current memberships;
  returns assigned locations, basic trial information, and owner-only invitations.

Invitation links contain business and invitation IDs in the fragment. They are
not bearer credentials: matching verified email is mandatory. The portal offers
copy-link sharing, not automated invitation email delivery. Recent invitation
listing is limited to 50; paging and staff membership editing remain future work.

Validation: 25 emulator tests pass. Vite production build succeeds. Signup/sign-in
layouts were inspected at desktop and 390px phone width. Authenticated UI flows
still require a real signup and mailbox verification test.
