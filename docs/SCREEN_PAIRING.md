# Screen pairing milestone

Implemented locally, not deployed. Existing production onboarding is unchanged.

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

The page is a pairing and connection shell. It does not play media or apply
orientation/scale settings yet; `appliedVersion` remains zero. Android native
integration and hardware App Check are later work. Successful pairing requires
a network connection. If redemption succeeds but its response is lost, generate
a new code; the owner can revoke the abandoned registration.

## Release gates

- Enable IAM Credentials API and grant the runtime service account token signing
  permission on itself only. Do not grant project-wide token creation.
- Configure Firestore TTL on `expiresAt` for `pairingSessions` and `pairingLimits`.
  Backend expiry checks remain authoritative even before asynchronous deletion.
- Add the four new callable functions to live postflight checks.
- Verify real browser App Check, custom-token sign-in, refresh persistence,
  claim/revoke and offline/reconnect behaviour in a separate development project.
- Check platform IP behaviour behind the deployed callable proxy before relying
  on the initial creation limiter at scale.
- Decide trial expiry/grace policy before disabling existing screen playback.
  This milestone gates new pairing/redemption; it does not terminate existing
  display reads when a trial ends.
- Run the emulator suite and production build, then deploy the approved release.

The emulator tests exercise owner restrictions, private-secret requirements,
concurrent claim/redemption, token claims, expiry, revocation, signing failure,
rate limits and direct-document denial. They do not test deployed IAM signing,
reCAPTCHA, native hardware, or end-to-end browser onboarding.
