# Business provisioning

Implemented callable functions (not deployed):

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
- Trial dates are stored, but feature consumption enforcement, AI allowances, and
  trial-expiry behavior still need implementation. No free unlimited AI is enabled.
- No signup UI, email delivery flow, invitations, or membership editing exists yet.
- Before deployment, configure Firebase Auth, App Check, the Firestore database
  and its region, billing, and suitable operational quotas.
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
