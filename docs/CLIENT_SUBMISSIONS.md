# Client submissions

Deployed and live-tested on 2026-10-23. Private intake, full decoding,
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

The deployed token-removal finalization trigger includes submission originals.
It was released together with the eight submission endpoints and UI. Revocation cannot cancel
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
review form, rendered image dialog and closing it.

Live acceptance on 2026-10-23 used the restored Test Cafe acceptance client and
the temporary “Submission acceptance” browser display at blacktown:

- Client uploaded the synthetic WebP, MP4 and a PNG containing only a signature.
- Full validation accepted the image/video and rejected the malformed PNG. The
  client saw the rejection reason. Read-only Firestore checks confirmed none of
  the three submissions entered the library before explicit approval.
- Owner previews rendered the sanitized image and video. Both valid files were
  approved, then assigned using their `submission_` media IDs, distinct from old
  fixtures with identical filenames. Client history showed both approvals.
- The live display alternated the image and video. Video DOM state showed ready
  state 4, 960-pixel width and an advancing playback time; frames were observed.
- Video withdrawal cleared screen content on authorization renewal. The image
  was also withdrawn, and the client saw both reasons. Read-only checks confirmed
  both promoted records were withdrawn and retained their validated generations.
- Display access was revoked; the screen showed access unavailable. The client
  was archived again and Refresh access denied its workspace. Three private test
  submissions remain; no test access remains active.

Deployment checks passed for all 36 callables, unauthenticated/App Check denial,
Auth/MFA configuration, exact hosted build, trigger and private worker IAM. Both
validators have the expected worker URL and bounded processing resources.
A separate CLI attempt to inspect Storage object metadata was denied by existing
IAM; no permissions were expanded and no independent live metadata inspection is
claimed. Derivative/token checks remain covered by backend validation and tests.

Next: safe audited submission cleanup/quota release before broad customer rollout.
Also improve duplicate-name asset labels so owners can distinguish client media.
