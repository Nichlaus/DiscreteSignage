# Advertising client records

Deployed and live-tested on 2026-10-23. This is the operator's client
register, not client account access or the full advertising approval workflow.

Business owners can create a named client, list up to 100 records, archive and
restore. Records live at `businesses/{businessId}/advertisers/{advertiserId}` and
contain name, active state, version and creation time. Client names may repeat.
No email, user account, membership, invitation or media access is created.

All three App Check callables require a verified active non-device user and current
business ownership. Creation/restoration require an active screens trial; listing
and archiving remain available after trial expiry. Firebase clients cannot directly
read or write these records. No rule or IAM grants are added.

- `createAdvertiser({businessId, requestId, name})`: strict 2–100-character name,
  tenant-scoped deterministic retry ID, transactional count and creation audit.
- `listAdvertisers({businessId})`: name-ordered allowlisted results, maximum 100,
  explicit truncation flag for operationally inconsistent data.
- `setAdvertiserActive({businessId, advertiserId, active, expectedVersion})`:
  rejects stale versions and audits changes; archiving preserves the record.

The initial allowance is 100 total records, including archived ones. Archiving does
not free allowance, delete media, stop existing playlists or revoke any access:
no client accounts exist in this milestone. Those effects must be designed and
tested when accounts/submissions are introduced. This is clearly stated in the UI.

Next: add isolated client invitations and submissions.
Client uploads must remain unpublishable until technical validation and explicit
operator approval succeed. Do not reuse business staff membership for advertiser access.

All 85 tests pass. Validation covers authentication/App Check, owner and cross-tenant denial, injected
authority, concurrent retry safety, counts, stale updates, audit entries, trial
expiry, revocation and direct-rule denial. Production build and synthetic visual
preview pass. All 25 callable postflight checks, matching release assets and
private Storage checks pass.

Live acceptance in Test Cafe created “Acceptance test advertiser · 23 Oct 2026”,
archived and restored it twice, and reloaded its persisted active state. The record
remains active at version 5; the business count is 1 and all five lifecycle audit
entries were verified. No client access was granted. The first archive committed,
but the following list request received a transient Cloud Run 401; refreshing
recovered the saved state. The second complete cycle passed without that error.
If an action's result is uncertain, refresh the list before retrying; version
checks prevent overwriting a newer state. Future UI recovery should distinguish a
successful mutation from a failed follow-up refresh.

## Invitation backend — local only, 2026-10-23

Three additional callables are implemented but not deployed or wired to forms:
`inviteAdvertiser`, `acceptAdvertiserInvitation`, `getAdvertiserWorkspace`.
Invitation input is businessId, advertiserId, requestId and email. Acceptance uses
businessId, advertiserId and invitationId. Workspace input is businessId and advertiserId.

Owners issue an email-bound seven-day invitation for an active client during the
screens trial. One invitation is retained per client; replacing it invalidates the
old link and has a one-minute cooldown. Retry IDs cannot resurrect replaced links.
Acceptance requires App Check and a currently verified, enabled account matching
the email, an active issuing owner, active client/version, unexpired link and trial.
Concurrent acceptance is idempotent and produces one audit event.

Access is stored under the client's `access/member`, never business `members`.
One login per client is the initial limit. Accepting a replacement invitation replaces
the previous login; issuing a pending invitation alone does not revoke accepted access.
The client workspace returns only its ID and name. It grants no business dashboard,
staff role, media, screen or publishing access. All direct Firebase reads/writes to
the invitation and membership remain denied. No emails are sent automatically.

Archiving invalidates both pending and accepted access through the record version.
Restoring does not re-enable old access; a new invitation is required. Existing
playlists remain unchanged. Invitation audits exclude the recipient email; the
backend-only invitation/member store it for verification. Invitation UI, link
handling, client sign-in, uploads and operator approval are the next milestones.

Validation: all 90 emulator/unit tests and the production build pass. New coverage
includes email matching, cross-client/tenant denial, concurrent acceptance, archive
and restore invalidation, replaced-link replay, replacement login, revoked issuer,
expiry, trial checks and direct database denial. No production access was granted.
