# Screen pairing milestone

Deployed on 2026-10-20. Live browser App Check and pairing-code creation verified.
Owner claim, custom-token redemption, refresh persistence and revocation still need
an end-to-end check using a verified owner account. The browser portal was signed out
during verification; no real customer account was created.

Open `/display.html` on a display. A ten-character code expires after ten minutes.
The owner chooses a location and screen name in the portal. The display polls
with a separate random 256-bit secret and redeems the claimed session once.
Only the secret hash is stored. Tokens and secrets must never be logged.
After signing in, the display reads only its registered screen and reports
readiness every minute. Portal and display use separate Firebase Auth storage.

Backend checks include verified active owner identity, location existence,
active screens trial, strict input fields, transaction-safe claim and redemption,
and a limit of 100 registrations per business (including revoked registrations).
Creation is capped at ten requests per platform IP/app per ten-minute window;
claim attempts at twenty per user per window. Shared networks share the creation
limit. These are initial safeguards, not a replacement for production abuse monitoring.
All pairing and limiter documents remain inaccessible through client rules.
Revocation disables the registry, so existing authenticated device sessions lose
Firestore read/write access. It remains available after trial expiry.

The deployed page supports pairing and a calibration card with remote orientation
and scale settings. It reports the applied settings version. Android native
integration and hardware App Check are later work. Successful pairing requires
a network connection. If redemption succeeds but its response is lost, generate
a new code; the owner can revoke the abandoned registration.

See [remote settings and calibration](SCREEN_SETTINGS.md) for the deployed
settings contract and remaining acceptance checks. Media playback is still pending.

## Infrastructure and remaining acceptance checks

- IAM Credentials API and narrowly scoped self-signing role are configured.
- Firestore TTL policies on `expiresAt` for `pairingSessions` and `pairingLimits`
  are deployed and verified active. For future updates, activation is asynchronous.
  Postflight reports `PENDING` with
  exit code 2 while Google reports `CREATING`. Backend expiry remains authoritative.
- All ten callables are deployed and checked for rejection of missing App Check.
- Verify custom-token sign-in, refresh persistence,
  claim/revoke and offline/reconnect behaviour in a separate development project.
- Check platform IP behaviour behind the deployed callable proxy before relying
  on the initial creation limiter at scale.
- Decide trial expiry/grace policy before disabling existing screen playback.
  This milestone gates new pairing/redemption; it does not terminate existing
  display reads when a trial ends.
- The application milestone passed 32 emulator tests; this infrastructure release
  passed the production build and live code-generation check. No application
  authorization code changed in the infrastructure release.

## Infrastructure implementation

`firebase-setup.mjs pairing-identity` enables IAM Credentials and creates a custom
role containing only `iam.serviceAccounts.signBlob`. Its binding is on the
runtime service account itself, not the project. No private signing key is
exported. `firestore.indexes.json` declares the two expiry policies; expiry fields
are not indexed. The postflight script verifies all ten callables, the display
page, TTL activation, and the signer role/binding.

References: [Firebase custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens),
[Firestore TTL configuration](https://github.com/firebase/firebase-tools/blob/main/src/firestore/README.md),
[service-account IAM policy API](https://cloud.google.com/iam/docs/reference/rest/v1/projects.serviceAccounts/getIamPolicy).

The emulator tests exercise owner restrictions, private-secret requirements,
concurrent claim/redemption, token claims, expiry, revocation, signing failure,
rate limits and direct-document denial. They do not test deployed IAM signing,
reCAPTCHA, native hardware, or end-to-end browser onboarding.
