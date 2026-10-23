# Advertising client records

Implemented locally on 2026-10-23; not deployed. This is the operator's client
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

Next: deploy the three callables and Hosting, verify create/list/archive/restore
with a synthetic record, then add isolated client invitations and submissions.
Client uploads must remain unpublishable until technical validation and explicit
operator approval succeed. Do not reuse business staff membership for advertiser access.

All 85 tests pass. Validation covers authentication/App Check, owner and cross-tenant denial, injected
authority, concurrent retry safety, counts, stale updates, audit entries, trial
expiry, revocation and direct-rule denial. Production build and synthetic visual
preview pass; live acceptance remains pending.
