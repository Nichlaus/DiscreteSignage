# Discrete Signage

Screen management, dine-in ordering, and customer AI for Australian businesses.

## Status

Firebase authorization, provisioning backend, and initial web onboarding portal.
Deployed at https://discretesignage.web.app. Firestore grants scoped management reads and validated device status
writes. Storage and RTDB remain locked. Admin SDK access bypasses these rules.

- Firebase project: `discretesignage`
- GitHub: https://github.com/Nichlaus/DiscreteSignage
- First market: food stores; currency: AUD
- First platforms: web and Android; iOS follows later

See [release plan](docs/RELEASE_PLAN.md), [architecture](docs/ARCHITECTURE.md),
and [security requirements](docs/SECURITY.md).
The [developer admin portal](docs/ADMIN_PORTAL.md) has deployed, live-tested read-only diagnostics and authenticator MFA, plus a running inventory
of controls, diagnostics, and recovery actions to maintain as features are built.
See [authorization model](docs/AUTHORIZATION_MODEL.md) for the initial grants.
See [onboarding](docs/ONBOARDING.md) for callable contracts and remaining setup.
See [deployment](docs/DEPLOYMENT.md) for live infrastructure and verification limits.
Remote orientation and scale controls are deployed; see
[screen settings](docs/SCREEN_SETTINGS.md) for the contract and deployment status.
The [media library intake](docs/MEDIA_LIBRARY.md) is deployed, with private uploads
and owner listings. Signed-in upload, invalid-content rejection and reload checks
passed. Originals remain private; only validated playback copies can be assigned.

Deployed and browser-tested on 2026-10-20: full static-image decoding, sanitized lossless
playback copies, owner screen assignment and short-lived device playback grants.
Deployed on 2026-10-21: private Linux video validation and secure muted playback.
The approved synthetic clip passed cloud validation and played on the live browser
display. See the media library document for acceptance details and format limits.

## Portal preview and build

Deployed on 2026-10-21: [ordered playlists and selectable transitions](docs/PLAYLISTS.md),
with bounded image durations and mixed image/video playback.
The portal also preserves entries after failed submissions and includes
clearer form guidance, file checks and mobile-friendly playlist controls.

Deployed on 2026-10-21: [split-screen layouts and logo overlays](docs/SCREEN_LAYOUTS.md).
Two independent playlists and validated image logos support side-by-side or stacked layouts.

Deployed on 2026-10-21: [weekly media scheduling](docs/MEDIA_SCHEDULING.md), with
weekday/time controls, location timezones and secure end-time cutoffs.

Deployed on 2026-10-21: [media play-start reports](docs/MEDIA_REPORTING.md), with
location/media selection, today, last-seven-day and lifetime counts.

Deployed on 2026-10-22: [workspace overview](docs/DASHBOARD.md), with screen health,
attention links and shortcuts to media/reports.

```sh
npm run dev
npm run build
```

The portal provides signup/sign-in, verification, password reset, business setup,
location creation, and staff invitation acceptance/revocation. Without configuration
it renders a clearly labelled preview with account submission disabled.
Copy `.env.example` to ignored `.env.local` and set the NEW Firebase project's web
configuration and App Check site key. Live Auth and callables are configured and
deployed; the reCAPTCHA key permits only the Hosting domains. Use emulators or a
separately registered development app for local authenticated work.
Never put server keys in Vite environment
variables: all `VITE_` values are public browser configuration.

Invite links are generated for manual sharing; the app does not send invitation
emails. Firebase verification and password reset emails are requested only through
their corresponding user actions.

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

Screen pairing is deployed with a portal claim/revoke form and
`/display.html` connection page. Browser pairing, settings updates, reconnect and
revocation have passed end-to-end acceptance. Physical-device testing remains. See
[pairing behaviour and release gates](docs/SCREEN_PAIRING.md).

Existing Reutos applications serve customers. Do not change or deploy to them.
Use local emulators with project ID `demo-discretesignage` for automated tests.
The configured real project is not an emulator project; do not run a blanket
Firebase deployment as a local setup step.

Before adding client access, extend and run emulator authorization tests.
JSON validation or code review does not establish that rules compile or enforce
the expected behavior.

Never commit private credentials, service account keys, signing keys, or customer
data. Firebase client configuration does not replace authorization.
