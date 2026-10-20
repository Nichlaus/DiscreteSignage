# Media library and playback

## Image playback milestone — deployed 2026-10-20

`validateMedia` requires verified active ownership, App Check and a screens trial.
It reads the exact original generation and fully decodes static JPEG, PNG or WebP
with Sharp, rejecting truncated/invalid data and animated images. Limits are
20 MiB input, 16,777,216 pixels, 8192 pixels per dimension and a 30-second decoder
timeout. Auto-orientation and metadata removal produce a lossless WebP copy,
without resizing or replacing the original; output is limited to 20 MiB.
Only successful decoding and verified private derivative storage allow `ready`.
This is format validation, not a malware scan.

Validation has a two-minute processing lease and at most three attempts. Expired
leases can be retried through the library; invalid media becomes `validation-failed`.
Ownership and trial are checked again before publishing. A fixed derivative path,
create-only writes and content hash checks recover interrupted saves safely.
The callable uses 1 GiB memory, concurrency one, two instances and a 90-second timeout.

Owners can assign only ready images belonging to their business. Device-only
`getScreenPlayback` checks App Check, live Auth status, registration, assignment
and trial, then signs an exact-generation GET for at most 60 seconds. Responses
contain no storage path. Firebase Storage client reads remain denied.
The player renews authorization, applies orientation/scale, and clears content
when access is denied or its lease expires. Network failure can therefore blank
a display; offline caching is not implemented. A previously issued bearer URL
remains usable until expiry, and previously downloaded bytes cannot be recalled.
Never log or persist playback URLs.

Derived files are not yet charged against the original-upload 1 GiB allowance.
The 100-reservation cap bounds additional derivatives to 100 × 20 MiB per business.
Existing cleanup does not remove uploaded, ready or validation-failed entries or
their derivatives; audited deletion and quota reconciliation remain upcoming.
Videos stay quarantined pending a maintained decoder/transcoding worker.
Playlists, transitions and native hardware acceptance remain separate work.

All 51 automated tests and the production build pass. Local verification includes
real decoding/pixel/metadata checks, emulator
authorization and recovery tests, lease-expiry tests, and a browser preview of
portrait playback and blanking after authorization expiry.

Live cloud decoding and signed GET delivery passed with the approved
`playback-fixture.webp` (1600 × 900) in Test Cafe. The earlier tiny
`acceptance-test.png` failed full decoding despite passing intake signature checks;
it remains unavailable for assignment. Original and derivative anonymous GCS and
Firebase downloads are denied. Operator object-metadata inspection was denied by
existing permissions; those permissions were not expanded.

The approved browser display rendered the assigned image, acknowledged settings
version 3, applied portrait/Fit XY and restored assigned playback after reload.
Revocation removed the image and returned the display to its access-unavailable
connection screen. The disposable registration remains revoked; the approved
fixture remains in the library.
The cloud validator runs successfully with its native Linux decoder.
All eighteen callable/security and Storage configuration postflight checks pass;
live portal/display entry assets match the release build. Physical Android/Google
TV, live trial-expiry and live offline-lease tests are not certified by this
browser acceptance.

## Deployed intake baseline

The media portal, five callables, finalization trigger, Sydney Storage bucket
and deny-all rules are deployed. Signed-in browser acceptance passed on 2026-10-20.
This milestone accepts quarantined uploads and lists their status. It does not
publish media, create thumbnails, transcode, schedule, or play files on screens.

## Upload contract

Owners with verified accounts, App Check and an active screens trial call
`beginMediaUpload` with exactly `businessId`, `requestId`, `name`, `contentType`
and `size`. The backend reserves a deterministic object path and counts both
bytes and slots transactionally. Concurrent retries cannot multiply reservations.

Initial allowances: 100 reservations and 1 GiB per business, JPEG/PNG/WebP up to
20 MiB, MP4/WebM up to 100 MiB, minimum 12 bytes. Reservations expire after at
most 30 minutes and never outlive the current trial.

`authorizeMediaUpload` accepts only `businessId` and `mediaId`. It rechecks
current verified ownership, uploader identity, App Check, trial and reservation
expiry, then issues a V4 signed GCS PUT URL lasting at most five minutes and
never beyond the reservation or trial. The signed headers bind exact size, MIME
type, reservation metadata and generation-match zero (create only). Added
`x-goog-*` metadata requires a valid signature. No download token is requested.
Firebase SDK reads and writes are denied, including uploads with valid reservations.
Media metadata stays backend-only in Firestore.

The upload URL is a bearer **write** credential: do not log, persist or share it.
Issued grants can remain usable until expiry after membership revocation; they
do not perform per-byte App Check or membership checks. Completion rechecks access.
This initial transport is a single PUT with progress, not a resumable session.
Interrupted transfers restart; a lost success response can be recovered through
confirmation. Original bytes are preserved without re-encoding.

`completeMediaUpload` takes `businessId` and `mediaId`. It checks current ownership
before inspecting server object metadata and the first 32 bytes of the exact
object generation. It rechecks ownership and trial in the completion transaction.
Matching files become `uploaded`; mismatches become `rejected`. Completion is
idempotent and audited. `listMedia` returns up to 100 active entries without
object paths, generations or download links.

Signature checks are preliminary format checks, not complete decoding, malware
scanning or codec validation. For example, an EBML signature alone does not prove
WebM compatibility. Uploaded files remain quarantined and never become playable
through this operation. The portal explicitly says playback validation is pending.
No public download URL is generated by application code.

## Recovery and release gates

Validation: 40 emulator/backend tests and the production build pass. The suite
includes owner isolation, constrained signing inputs, expiry, denied Firebase
uploads/reads, concurrent quota reservation and signature mismatch. Emulator
tests mock the GCS signing and completion responses; live contract verification
is separate.

- A finished object can be confirmed again if the completion response was lost.
- Owner-triggered `cleanupMedia` processes at most 25 abandoned/rejected entries
  per call, eight days after reservation expiry. It remains available after trial
  expiry. It marks entries `retiring`, deletes the exact object generation, then
  releases counters transactionally and audits the action. Missing objects are safe
  to finish; other storage failures retain quota for retry. Concurrent retries
  release quota once. Deleted metadata tombstones prevent reservation reuse.
  Uploaded media is preserved. This is not a scheduled cleanup worker.
- The conservative eight-day cleanup buffer is retained from the previous
  resumable transport design; the current transport does not issue such sessions.
  Bucket soft-delete retention can continue billing bytes after logical quota
  is released; report that separately from the business's media allowance.
- Configured `discretesignage.firebasestorage.app` in Sydney with uniform access,
  enforced public-access prevention and PUT CORS limited to the two hosting origins.
  Runtime has bucket-scoped object create/get/update/delete permissions.
  Storage App Check is enforced; direct signed PUT authorization is independent.
  No cross-service Firestore permission is needed for deny-all Storage rules.
- Five media callables and the finalization trigger are deployed; application
  postflight covers all sixteen callables and the active bucket-specific trigger.
- Completion and finalization retain token removal as defense in depth. The
  transport now uses Cloud Storage rather than Firebase SDK token-producing uploads.
- Full media decoding/limits, sanitized derivatives and authenticated delivery
  must precede playback. Preserve original quality; avoid needless re-encoding.
- Native Android integration, playlists and transitions are separate milestones.

Reference: [Storage rules conditions and Firestore access](https://firebase.google.com/docs/storage/security/rules-conditions).

Session lifetime: [Cloud Storage resumable uploads](https://docs.cloud.google.com/storage/docs/resumable-uploads).

Signing constraints: [canonical request headers](https://docs.cloud.google.com/storage/docs/authentication/canonical-requests)
and [XML upload size/precondition headers](https://docs.cloud.google.com/storage/docs/xml-api/reference-headers).

Infrastructure configured on 2026-10-20. `firebase-storage-postflight.mjs` passes.
Live synthetic acceptance passes: exact size/type constraints, rejection of
unsigned token metadata, token-free stored bytes, overwrite denial, denied GET
with the PUT credential, denied anonymous reads, and allowed/foreign-origin CORS.
Signed-in portal acceptance also passed in Test Cafe: `acceptance-test.png`
became uploaded and `acceptance-invalid.png` was rejected. Both remained after
page reload and library refresh. Anonymous GCS and Firebase downloads of both
objects were denied. These two approved synthetic entries remain in the library.
This does not establish full media decoding, video compatibility or playback.
`firebase-storage-setup.mjs --apply` is explicit setup, never a build/test step.
`verify-storage-upload.mjs --run` uses one synthetic object and a temporary
operator signing grant on the runtime account (automatic ten-minute expiry);
it removes the object and grant in finally blocks. The test prints no signed URLs.

The first Eventarc deployment required service-agent propagation, then an explicit
`roles/eventarc.eventReceiver` grant to the custom runtime account. The project
owner approved that persistent project-scoped grant; setup now includes it.
The owner separately approved `roles/run.invoker` for the same runtime account
on `quarantinemedia` only, allowing private event delivery. Postflight checks it.
The finalization trigger is active; destructive token-injection/event-retry
acceptance was not performed against the retained browser fixtures.
