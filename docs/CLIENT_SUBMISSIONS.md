# Client submissions

Deployed and live-tested on 2026-10-23. Private intake, full decoding,
safe owner previews, owner decisions and promotion to the playable library are
implemented. Cleanup backend, list endpoints, index and Hosting were also deployed
on 2026-10-23; successful live deletion/quota recovery is pending eligibility below.

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
Cleanup implementation: an owner can permanently delete an
eligible submission using `cleanupSubmission`, with an explicit checkbox in the
form. Eligibility starts eight days after reservation expiry, plus any outstanding
validation lease and a one-minute buffer. Only expired uploads, signature rejects,
validation failures, declined files and interrupted cleanup qualify. Pending review,
active validation and all promoted library records (including withdrawn media) are
protected. Cleanup does not require a current trial or an active advertiser.

Cleanup first checks ownership, version, counters and canonical paths, then marks
the record `retiring`. Generation-conditional deletion covers the original and both
possible decoder outputs, including an orphan from interrupted validation. Missing
objects permit recovery; other storage failures leave quota reserved for retry.
Owner membership is rechecked between deletions and before the release transaction.
The final transaction releases one business and client submission slot and the
reserved submission bytes exactly once, preserving media quotas and an audit event.
The reservation tombstone prevents old upload requests from reopening. List queries
exclude tombstones so recovered slots can appear even after many cleanups.

The form shows eligibility time and a retry control for interrupted cleanup.
Counter mismatches require administrator investigation; never manually lower them
to bypass a failed cleanup. Automatic cleanup and removal of promoted/withdrawn
library media remain planned; the latter needs screen-reference and retention checks.

Release ordering: deploy the submissions advertiserId/status composite index and
wait for READY before updating list endpoints. Then deploy cleanupSubmission, both
list endpoints and Hosting. Postflight now covers all 37 endpoints and index readiness.

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

Live cleanup acceptance (2026-10-23): no eligible Test Cafe records exist yet.
The index reached READY before dependent list endpoints were deployed. All 37
callables passed postflight, including missing-auth/App Check denial; Hosting
matched the release build and Storage retained private access and the narrow
runtime delete role. The production advertiser/status query returned all three
test records. The owner portal showed the safety-period date and no cleanup
actions for any of them. No deletion callable was invoked with owner credentials.
The 12-byte `submission-invalid.png` is eligible from 2026-10-31T07:32:12.090Z
(31 October 2026, 6:32:12 pm Australia/Sydney). The two withdrawn promoted assets
are protected. Counters remained 3 submissions / 774,228 reserved bytes before
and after verification. No permissions, test client access or screen access changed.
Do not shorten the grace period or backdate live reservations to test deletion.
Actual live deletion, exactly-once quota recovery and retry acceptance remain
pending until a genuinely eligible record is available.

All 108 tests and the final production build pass. Local emulator tests cover expiry boundaries, concurrency, partial failure,
generation conflicts, bad counters, revoked ownership, protected library media and
tombstone-safe quota reuse. A synthetic browser check verified the required checkbox
and eligibility messaging. No live files were deleted during implementation.
Also improve duplicate-name asset labels and plan reference-aware library cleanup.
