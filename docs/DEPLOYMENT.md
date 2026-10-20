# Firebase deployment

Project: `discretesignage` (number `203068976562`).
Portal: https://discretesignage.web.app
Web app: `1:203068976562:web:ec3b92fb15afcb817ac8ab`.

Status: Hosting, Firestore rules/indexes, RTDB rules, Storage rules and all sixteen callable
functions deployed successfully on 2026-10-20. Live pairing-code creation and
missing-credential rejection for all callables passed. Both TTL policies are
active; all postflight checks passed. Future TTL activation is asynchronous;
postflight reports it separately from failed checks.
The initial artifact-repository creation timed out for `acceptInvitation`.
Retrying succeeded; its missing Cloud Run invoker policy was restored to match
the other callables. Auth and App Check enforcement remain mandatory in handlers.

## Infrastructure configured on 2026-10-20

- Billing was already enabled; no billing account change was made.
- Default Firestore database: Native mode, `australia-southeast1`, deletion protection enabled.
- Functions: Node 24 second generation, `australia-southeast1`, maximum five instances
  per function, no minimum instances configured.
- Runtime identity: `discrete-platform@discretesignage.iam.gserviceaccount.com`.
  Project roles: `roles/datastore.user` and `roles/firebaseauth.viewer`.
  The explicitly approved `roles/eventarc.eventReceiver` role lets the custom
  runtime identity receive Storage finalization events.
  A separately approved `roles/run.invoker` binding on `quarantinemedia` alone
  permits private trigger invocation; no public worker access is granted.
  Custom role `discreteDeviceSigner` grants only `iam.serviceAccounts.signBlob`,
  bound on the runtime service account itself.
- Authentication: email/password enabled, anonymous sign-in disabled, minimum
  password length 12, improved email privacy enabled.
- App Check: reCAPTCHA Enterprise score key restricted to `discretesignage.web.app`
  and `discretesignage.firebaseapp.com`, token lifetime one hour.
- App Check enforcement: Authentication, Firestore, Realtime Database, Storage, and each
  callable function. No debug token was registered.
- Hosting: `dist`, SPA fallback, no-sniff, deny framing, no-referrer headers.
- Artifact Registry: generated function build images expire after seven days.
- Existing Reutos projects were not changed.

Firebase web configuration and the public reCAPTCHA site key are in ignored
`.env.local` for builds. They are browser configuration, not server secrets.
CLI credentials remain in the existing CLI credential store, never repository files.
Setup/preflight/postflight scripts use that authenticated session and print only
selected configuration. Do not print whole Auth configuration responses: they
can contain sensitive password-hash configuration.

## Repeatable checks and deployment

Media intake is deployed. Remaining [media rollout gates](MEDIA_LIBRARY.md)
apply to validated playback, not the private upload/library release.
The default postflight targets all sixteen callables and the media trigger.
Media uses constrained, five-minute GCS PUT grants and deny-all Firebase Storage
rules. Forty emulator/backend tests pass locally. The Sydney media bucket,
restricted CORS, bucket-scoped runtime role, public-access prevention, Storage
App Check and deny-all Storage rules are now configured; Storage postflight passes.
The media application and finalization trigger are deployed.
Live synthetic GCS acceptance passes, including unsigned metadata rejection,
size/type enforcement, no download token, no overwrite/read via upload credential,
and browser CORS. Signed-in Test Cafe browser acceptance additionally passed:
valid PNG upload/confirmation, disguised content rejection, persistence after
reload and anonymous download denial. Two approved synthetic test entries remain.

Pairing and remote settings are deployed. Signed-in browser acceptance passed,
including configuration, stale-edit rejection, reconnect and revocation; see
[settings acceptance results](SCREEN_SETTINGS.md). Postflight covers sixteen
callables, compares live portal/display entry assets with the local release build,
and returns exit code 2 if expiry policies are still activating.

Use Node 24.12+ and install both root and functions dependencies.

```sh
npm test
npm run build
node node_modules/firebase-tools/lib/bin/firebase.js deploy --project discretesignage --only hosting,functions,firestore,database,storage --non-interactive
node scripts/firebase-postflight.mjs
node scripts/firebase-storage-postflight.mjs
```

`firebase-setup.mjs` has explicit service, database, web, identity, auth, and
enforcement setup actions; it is not a routine development or test command.
Storage setup is explicit: `node scripts/firebase-storage-setup.mjs --apply`.
Check it with `node scripts/firebase-storage-postflight.mjs`. First deployment
of the retrying finalization trigger needs `--force` and may need a retry after
Eventarc service-agent propagation. The custom runtime also requires the
explicitly approved project-scoped Eventarc receiver role.
After creating the worker, `node scripts/firebase-media-trigger-access.mjs --apply`
sets its approved service-scoped invocation binding. Postflight verifies that
binding, the trigger identity and absence of public worker invokers.

## Verification boundaries

Pending video release: follow [worker deployment requirements](../video-worker/README.md).
The local postflight now expects validation timeout 180 seconds and PUT/GET CORS,
so it will intentionally differ from the current image-only deployment until
that release. No worker, IAM grant, CORS or video Hosting change was applied in
this implementation milestone. Run real Linux container decoding tests before
deploying; then verify private Cloud Run invocation and signed browser playback.

Image release deployed 2026-10-20: new `validateMedia` and `getScreenPlayback`,
updated `updateScreenSettings`, `getWorkspace` and `listMedia`, then Hosting.
Sharp's native Linux runtime successfully decoded the approved calibration fixture.
No additional Storage client grants were added. Postflight now checks eighteen
callables, decoder memory/concurrency/timeout limits and matching release assets.
Signed-in browser acceptance verified image validation, assigned signed-GET playback,
rotation/scale and reload recovery. Anonymous reads of the fixture original and
derivative are denied. Revocation cleared the live image and the disposable
screen remains revoked. Live trial expiry and offline-lease expiry were not tested;
their automated coverage does not substitute for hardware acceptance.

The emulator suite covers the application authorization behavior.
Postflight checks cover live service configuration, function readiness, rejection
of missing credentials/App Check, assets, headers, and anonymous RTDB reads.
A real email signup, mailbox verification, business creation, and invitation
acceptance must also be checked before treating onboarding as production-ready.
No real customer account is created by the postflight script.
