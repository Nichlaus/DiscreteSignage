# Client submissions

Implemented locally on 2026-10-23; not deployed. Private intake, full decoding,
safe owner previews, owner decisions and promotion to the playable library are
implemented. Submission cleanup and quota release remain planned.

## Boundaries

Records live at `businesses/{businessId}/submissions/{id}`; originals use the same
Storage prefix ending in `/original`. Existing media queries, validation and screen
playback use `media`, so an unapproved submission cannot be assigned or signed for playback.
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
- `validateSubmission`: active owner, client version and trial required. Shares
  the existing full image decoder and private video worker with normal library
  validation. Writes only an immutable sanitized derivative, then moves to `review`.
  Three attempts maximum; a 210-second lease prevents concurrent decoding. Access
  and lease are rechecked at commit. Invalid files never reach review.
- `previewSubmission`: owner-only, validated derivative only; signed generation
  expires within 60 seconds or at trial expiry. Originals never receive read URLs.
  The viewer removes its media on close, expiry or portal rerender. Preview URLs
  exist only in memory and an already issued URL remains usable until expiry.
- `reviewSubmission`: explicit approve/decline/withdraw decision bound to the
  listed version. Approval atomically creates one ready library record pointing
  to the validated immutable derivative, reserves normal media quota and audits
  the decision. Concurrent retries count once. No playlist is changed. Declining
  and withdrawing require a reason visible to the client; these actions remain
  available after trial expiry or client archival.

Withdrawal marks the promoted media unavailable; new screen manifests fail closed.
An existing screen lease lasts at most 60 seconds. A playlist containing withdrawn
media can therefore go blank until the owner replaces it. Archiving a client does
not withdraw already approved media automatically. Replacing rejected/withdrawn
content requires a new submission and fresh validation/approval.

The existing token-removal finalization trigger is extended to submission originals.
Deploy that change together with the new endpoints and UI. Revocation cannot cancel
an already signed PUT before its short expiry, but stops completion and listing;
the bytes remain private and unplayable. A restored client with a fresh invitation
cannot complete a reservation belonging to the old client version.

## Limits and recovery

Initial caps: 20 reservations per client, 100 per business, 1 GiB reserved submission
bytes per business, separate from the existing media allowance. Promotion also
uses the normal media allowance (100 files / 1 GiB); it does not copy the bytes or
release submission quota. All reservations,
including abandoned/rejected uploads, count. Archive/reinvite does not reset counts.
No automatic cleanup or quota release exists yet; add a safe, audited cleanup path
before broad customer rollout. Do not manually lower counters while objects or
upload grants can still exist.

The client form shows progress and preserves file selection after errors. Retry IDs
are held only in session storage, never signed URLs. “Confirm finished upload” can
recover a successful PUT whose response or completion call was lost. Missing bytes
remain an error. Refresh the list before retrying uncertain submissions.

## Validation and next step

All 101 tests and the production build pass. Tests cover cross-client/tenant denial,
injected approval, quotas, concurrent reservation idempotency, signed bounds,
signature rejection, immutable-generation reads, archive during inspection, stale
version rejection, expiry, owner-only listing and direct Firestore denial. Review
tests cover real image decoding, malformed input, preview generation/expiry,
separate approval, concurrent idempotency, quota, revocation during decoding,
bounded retries, required reasons and withdrawal denying screen playback.
The existing image/video validation and playback tests pass after extracting the
shared decoder/storage helper. A synthetic local browser preview verified the
review form, rendered image dialog and closing it. No live submission was tested.

Next: deploy intake, review endpoints, quarantine trigger and web UI together;
verify VIDEO_WORKER_URL on validateSubmission and private worker invocation.
Live acceptance must exercise client upload, owner validation/preview/decision,
playback and withdrawal. Add safe audited cleanup before broad customer rollout.
