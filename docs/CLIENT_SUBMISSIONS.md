# Client submissions

Implemented locally on 2026-10-23; not deployed. This milestone provides private
intake and metadata lists. Full decoding, safe previews, owner approval/rejection,
promotion to the playable library and cleanup are not implemented yet.

## Boundaries

Records live at `businesses/{businessId}/submissions/{id}`; originals use the same
Storage prefix ending in `/original`. Existing media queries, validation and screen
playback use `media`, so a submission cannot be assigned or signed for playback.
Clients cannot inject approval, a storage path, owner identity or playback status.
Firestore and Storage client access remain denied; no rule grants are introduced.

All client callables require App Check, a verified active account, current client
membership, matching email/version, active client record and screens trial:

- `beginClientSubmission`: scoped retry ID; name, MIME and size validation;
  transactional reservation/counts. Accepts JPEG/PNG/WebP/MP4/WebM, 12 bytes–20 MiB.
- `authorizeClientSubmission`: creator/version check and signed PUT lasting at
  most five minutes, capped by the 30-minute reservation and trial. Exact size/type,
  no overwrite, and signed extension headers prevent metadata/session changes.
- `completeClientSubmission`: generation-bound size/type/signature inspection;
  rechecks access and expiry inside the commit transaction; one audit event.
  `submitted` means awaiting validation and review, not decoder-verified or approved.
- `listClientSubmissions`: only the assigned client's metadata, including history
  after replacement of its login. No storage paths, URLs or uploader identity.
- `listAdvertiserSubmissions`: active business owner only, up to 100 metadata rows.
  Owner listing remains available after trial expiry.

The existing token-removal finalization trigger is extended to submission originals.
Deploy that change together with the new endpoints and UI. Revocation cannot cancel
an already signed PUT before its short expiry, but stops completion and listing;
the bytes remain private and unplayable. A restored client with a fresh invitation
cannot complete a reservation belonging to the old client version.

## Limits and recovery

Initial caps: 20 reservations per client, 100 per business, 1 GiB reserved submission
bytes per business, separate from the existing media allowance. All reservations,
including abandoned/rejected uploads, count. Archive/reinvite does not reset counts.
No automatic cleanup or quota release exists yet; add a safe, audited cleanup path
before broad customer rollout. Do not manually lower counters while objects or
upload grants can still exist.

The client form shows progress and preserves file selection after errors. Retry IDs
are held only in session storage, never signed URLs. “Confirm finished upload” can
recover a successful PUT whose response or completion call was lost. Missing bytes
remain an error. Refresh the list before retrying uncertain submissions.

## Validation and next step

All 96 tests and the production build pass. Tests cover cross-client/tenant denial,
injected approval, quotas, concurrent reservation idempotency, signed bounds,
signature rejection, immutable-generation reads, archive during inspection, stale
version rejection, expiry, owner-only listing and direct Firestore denial. A
synthetic local browser preview verified list states and the confirmation control;
no real upload or live deployment was performed.

Next: full decoding and safe preview, an owner decision bound to an immutable
validated generation, and explicit promotion to playable media. Test that neither
technical validation nor client upload alone can publish, and define withdrawal
behaviour before enabling approval.
