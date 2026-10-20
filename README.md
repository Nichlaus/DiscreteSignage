# Discrete Signage

Screen management, dine-in ordering, and customer AI for Australian businesses.

## Status

Firebase authorization and business provisioning backend; no customer UI or
deployment yet. Firestore grants scoped management reads and validated device status
writes. Storage and RTDB remain locked. Admin SDK access bypasses these rules.

- Firebase project: `discretesignage`
- GitHub: https://github.com/Nichlaus/DiscreteSignage
- First market: food stores; currency: AUD
- First platforms: web and Android; iOS follows later

See [release plan](docs/RELEASE_PLAN.md), [architecture](docs/ARCHITECTURE.md),
and [security requirements](docs/SECURITY.md).
See [authorization model](docs/AUTHORIZATION_MODEL.md) for the initial grants.
See [onboarding](docs/ONBOARDING.md) for callable contracts and remaining setup.

## Local rules tests

Requires Node 24.12+ (24.x), npm, and Java 21+. On Windows the test runner can
use Android Studio's bundled Java if `JAVA_HOME` does not point to Java 21+.

```sh
npm ci --ignore-scripts
npm --prefix functions ci --ignore-scripts
npm test
```

The runner starts Auth, Firestore, RTDB, and Storage emulators on dedicated local
ports using `demo-discretesignage`. Initial execution downloads emulator runtimes.
The tests refuse to run unless local emulator endpoints are set. Tests cover
tenant/location isolation, revocation, protected writes, query access, status
validation, Storage/RTDB lockdown, and business/location provisioning. They do
not test production App Check attestation or deployed callable transport.

## Development safety

Existing Reutos applications serve customers. Do not change or deploy to them.
Use local emulators with project ID `demo-discretesignage` for automated tests.
The configured real project is not an emulator project; do not run a blanket
Firebase deployment as a local setup step.

Before adding client access, extend and run emulator authorization tests.
JSON validation or code review does not establish that rules compile or enforce
the expected behavior.

Never commit private credentials, service account keys, signing keys, or customer
data. Firebase client configuration does not replace authorization.
