# Discrete Signage

Screen management, dine-in ordering, and customer AI for Australian businesses.

## Status

Initial planning and Firebase lockdown configuration only. No application has
been implemented or deployed. Rules currently deny all client access, including
authenticated clients. Admin SDK access bypasses these rules.

- Firebase project: `discretesignage`
- GitHub: https://github.com/Nichlaus/DiscreteSignage
- First market: food stores; currency: AUD
- First platforms: web and Android; iOS follows later

See [release plan](docs/RELEASE_PLAN.md), [architecture](docs/ARCHITECTURE.md),
and [security requirements](docs/SECURITY.md).

## Development safety

Existing Reutos applications serve customers. Do not change or deploy to them.
Use local emulators with project ID `demo-discretesignage` for automated tests.
The configured real project is not an emulator project; do not run a blanket
Firebase deployment as a local setup step.

Before opening client access, add and run emulator authorization tests.
JSON validation or code review does not establish that rules compile or enforce
the expected behavior. No emulator validation has been performed yet.

Never commit private credentials, service account keys, signing keys, or customer
data. Firebase client configuration does not replace authorization.
