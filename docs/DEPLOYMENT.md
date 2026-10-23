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

Workspace overview deployed 2026-10-22: Hosting-only release. Live assets match the
tested build; backend, rules and display player are unchanged. Firebase postflight
passes. See [dashboard checks](DASHBOARD.md).

Reporting deployed 2026-10-21: new `reportPlayback` and `getMediaReport` callables, then
Hosting. No rule/IAM changes. Postflight passes for all twenty callables;
live portal/display assets match the tested build. See
[reporting acceptance and limits](MEDIA_REPORTING.md).

Weekly scheduling deployed 2026-10-21: `updateScreenSettings`, `getScreenPlayback`, then
Hosting. Live assets match the tested build and Firebase postflight passes. No rule/IAM changes.
See [scheduling contracts and acceptance limits](MEDIA_SCHEDULING.md).

Split-screen release deployed 2026-10-21: `updateScreenSettings`, `getWorkspace`,
`getScreenPlayback`, then Hosting. No rule/IAM grants. Live portal/display assets
match the tested build; Firebase and Storage postflight checks pass.
See [layout acceptance and hardware limits](SCREEN_LAYOUTS.md).

Playlist release deployed 2026-10-21: `updateScreenSettings`, `getWorkspace`,
`getScreenPlayback`, then Hosting, from source commit `e21d393`. No rule or IAM
changes. Full Firebase postflight passed, including exact live/local entry-asset
matching, all eighteen callables rejecting anonymous requests and RTDB HEAD 401.
Storage postflight also passed. See [playlist contracts](PLAYLISTS.md).
Approved live browser acceptance passed mixed media, persisted/reordered settings,
fade/slide selections, acknowledgement, renewal, reload and revocation. The test
display was revoked afterward. Native hardware acceptance remains pending.

Hosting includes form usability improvements: inline failure recovery, password
visibility, pairing/upload guidance, invitation-location validation, clearer video
timing and mobile controls. Prior synthetic browser checks verified failed-save
draft retention and phone-width layout without horizontal overflow.

Video release deployed 2026-10-21: Linux container tests passed, then the private
Sydney worker, `validateMedia`, `getScreenPlayback`, `updateScreenSettings`,
`listMedia` and Hosting were deployed. The worker has a dedicated identity with no
project or bucket roles; only the existing backend may invoke it, through the
explicitly approved service-level grant. PUT/GET CORS is restricted to the two
Hosting origins. Worker and Storage postflight checks pass. Anonymous original
and derivative downloads are denied. See [worker release details](../video-worker/README.md).

The broad postflight initially received HTTP 500 from an anonymous RTDB root GET.
A subsequent HEAD returned the expected 401; the check now uses HEAD to avoid
requesting database contents. The complete revised postflight passed. This does
not explain the earlier server error.

Live video acceptance passed: muted looping playback, assignment acknowledgement,
continued playback past a lease window, reload and revocation clearing the video.
The synthetic fixture remains in the library; the acceptance display is revoked.
Physical Android/Google TV playback remains untested.

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

Admin release (2026-10-22): `getPlatformBusiness` and `/admin.html` deployed.
Identity Platform and TOTP MFA enabled with one adjacent interval, preserving other
Auth settings. Business sign-in now supports authenticator challenges. All 76 tests
and the release build pass. Synthetic browser checks passed for wrong-code retry,
successful completion and cancellation; the live setup page recognises the nominated
verified account. Owner-entered authenticator enrolment and fresh MFA sign-in passed.
The approved account received only `business.read`; live Test Cafe diagnostics and
both the bootstrap/read audit entries were verified. No media or device changes made.
Postflight passed for all 21 callables, matching live portal/display/admin assets,
MFA/Auth/App Check configuration, security headers, TTL and signing permissions.
Storage postflight passed for private Sydney storage, CORS and App Check.

Directory release (2026-10-22): `listPlatformBusinesses`, `getPlatformBusiness` and
Hosting deployed from tested commit `daa03ba`. Live MFA session loaded the directory
and selected Test Cafe by name; diagnostics and both protected audit entries were
verified. All 22 callable/security checks and matching HTML/asset checks pass;
Storage postflight remains green. Only one production business exists, so live
Next/Previous testing was not possible; emulator and synthetic browser coverage
passed in the 77-test implementation milestone. No customer data or permissions changed.

Campaign date release (2026-10-22): deployed settings, playback and reporting functions,
then Hosting, from implementation commit `8035248`. All 22 callable checks, release
asset checks and private Storage checks pass. Approved browser acceptance verified
future/current/expired date eligibility and persisted settings audits using existing
synthetic video. Temporary “Campaign acceptance” display was revoked afterward.
The implementation passed 80 tests; real midnight and physical hardware acceptance
remain outstanding. See MEDIA_SCHEDULING.md for exact cases and evidence.

Advertising client release (2026-10-23): deployed `createAdvertiser`,
`listAdvertisers`, `setAdvertiserActive` and Hosting from implementation `3633346`.
The implementation passed 85 tests; release build, all 25 callable postflight
checks, matching HTML/assets and private Storage checks pass. Live Test Cafe
acceptance created one synthetic record, archived/restored twice and verified
the persisted active state, unchanged count of 1 and all five audit events.
The first post-archive list refresh returned a transient Cloud Run 401; the
mutation committed and a refresh recovered it. The second cycle passed cleanly.
No code or permissions changed during this deployment. Client login, submissions
and approval remain planned. See ADVERTISING_CLIENTS.md for the test record.

Client invitation release (2026-10-23): deployed `inviteAdvertiser`,
`acceptAdvertiserInvitation`, `getAdvertiserWorkspace` and Hosting from `1475c1f`
plus separate tab-session authentication for the client portal. Build, all 28
callable checks, release asset/header checks and private Storage checks pass.
The approved test invitation was issued through the owner form; the client page
opened signed out while the owner remained signed in. Account creation/verification,
client isolation and final archival are pending the user's credential entry.
