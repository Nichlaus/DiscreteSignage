# Firebase deployment

Project: `discretesignage` (number `203068976562`).
Portal: https://discretesignage.web.app
Web app: `1:203068976562:web:ec3b92fb15afcb817ac8ab`.

Status: Hosting, Firestore rules/indexes, RTDB rules, and all six callable
functions deployed successfully on 2026-10-20. All postflight checks passed.
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
- Authentication: email/password enabled, anonymous sign-in disabled, minimum
  password length 12, improved email privacy enabled.
- App Check: reCAPTCHA Enterprise score key restricted to `discretesignage.web.app`
  and `discretesignage.firebaseapp.com`, token lifetime one hour.
- App Check enforcement: Authentication, Firestore, Realtime Database, and each
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

The working tree now includes an **undeployed pairing milestone**. Complete the
[pairing release gates](SCREEN_PAIRING.md) before deploying this version.
The existing postflight currently checks the six onboarding/team callables only.

Use Node 24.12+ and install both root and functions dependencies.

```sh
npm test
npm run build
node node_modules/firebase-tools/lib/bin/firebase.js deploy --project discretesignage --only hosting,functions,firestore,database --non-interactive
node scripts/firebase-postflight.mjs
```

`firebase-setup.mjs` has explicit service, database, web, identity, auth, and
enforcement setup actions; it is not a routine development or test command.
No Storage bucket or Storage rules deployment is included in this release.

## Verification boundaries

The emulator suite covers the application authorization behavior.
Postflight checks cover live service configuration, function readiness, rejection
of missing credentials/App Check, assets, headers, and anonymous RTDB reads.
A real email signup, mailbox verification, business creation, and invitation
acceptance must also be checked before treating onboarding as production-ready.
No real customer account is created by the postflight script.
