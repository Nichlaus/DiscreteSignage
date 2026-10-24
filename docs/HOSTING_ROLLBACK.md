# Hosting rollback runbook

Scope: Discrete Signage Firebase Hosting only. This does not restore databases,
Storage, Functions, Cloud Run, Android APKs, IAM, Auth or App Check configuration.
Use a Hosting rollback for a frontend regression only after confirming the old
client remains compatible with the current backend. Do not restore a version
with a known security defect. Data recovery requires a separate procedure.

## Before changing the live release

1. Record the incident, symptoms, current release/version and selected recovery
   version. Pause concurrent deployments and record who is operating the recovery.
2. Check the candidate's recorded acceptance and retained FINALIZED status.
   Record its Git commit and the current version as the return target. Do not
   delete either version or reduce retention during recovery.
3. Review backend/API, schema, Auth and App Check compatibility. For the rehearsed
   pair below, only frontend onboarding guidance changed; backend behavior did not.
4. Rehearse the candidate using the command below. A hash mismatch means stop and
   investigate, not ignore the failure. A missing retained version requires a new
   reviewed deployment; do not substitute a similarly dated release.

## Read-only rehearsal

Run from E:\Screens\DiscreteSignage with the existing Firebase CLI login:

```powershell
node scripts/rehearse-hosting-rollback.mjs dc9a50c 9bedf9c7c5f959b4
node scripts/rehearse-hosting-rollback.mjs 2b3e3a7 f345d11443ec4acf
```

The script archives the selected Git commit into a unique ignored artifacts
folder, builds with installed dependencies and the current local production web
configuration, and compares every application file with the retained version.
It uses Firebase CLI's level-9 gzip SHA-256 format. Firebase-generated init.js and
init.json endpoints are excluded explicitly. No cloud mutation is implemented.
It verifies the live release identifier has not changed during each run.

Historical Git archives contain CRLF while deployed source used LF. The isolated
web inputs are normalized to LF to reproduce those builds. The repository and
live dist are not changed. This uses the installed toolchain, not an independently
restored dependency environment; exact output equality is the acceptance gate.
Artifacts contain source/build output and evidence, not copied .env files or tokens.
Do not use this script for unreviewed Git commits: building executes their config.

## Execute an incident rollback

In Firebase console, open Hosting for discretesignage. In Release history,
identify the exact candidate version, open its menu and choose Roll back. This
publishes a new release pointing to the retained version. Verify the new release
references the intended version. Retain its identifier with the incident record.
See the [official Firebase Hosting procedure](https://firebase.google.com/docs/hosting/manage-hosting-resources#rollback).

Do not run the usual deploy command from current main to roll back: its predeploy
hook rebuilds current source. Prefer the retained-version rollback for recovery.
Already-open browser clients may keep old code until refreshed; native Android
apps are not updated by Hosting rollback. Check affected clients explicitly.

## Verify and recover forward

- Compare live HTML and referenced assets against the matching candidate build.
  The existing firebase-postflight.mjs compares against root dist; it must contain
  the candidate build before that check, not the current main build. Preserve the
  current dist outside it first, and restore it afterward. A wrong-build mismatch
  must not be misreported as a rollback failure or silently bypassed.
- Run the full Firebase postflight, check owner/client/admin sign-in surfaces,
  and verify the affected feature. Screen playback acceptance requires an
  authorized test device. Do not grant access to customer devices just to test.
- If verification fails, assess whether the recorded return version is safer.
  Restore that exact retained version through Release history and repeat checks.
  Do not alternate versions without diagnosing the failure.
- Record times, versions, checks, remaining failures and operator. Deliver a fix
  through normal review/build/deploy checks before closing the incident.

## Rehearsal evidence — 24 October 2026, Sydney

At approximately 11:37 am AEDT, both candidates matched all 13 application files:

| Purpose | Git commit | Retained version |
| --- | --- | --- |
| Rollback candidate: trial guidance | dc9a50c | 9bedf9c7c5f959b4 |
| Return target: onboarding guide | 2b3e3a7 | f345d11443ec4acf |

Live release stayed sites/discretesignage/releases/1792801870387000 throughout.
Local evidence: artifacts/rollback-yXCkSO/evidence.json and
artifacts/rollback-DrFrqZ/evidence.json. The initial attempt failed because it used
raw hashes and archived line endings; correcting the harness produced exact matches.

Passed: candidate reproduction, retained-file integrity and unchanged live release.
Not performed: live release switching, CDN propagation, post-switch sign-in/playback,
backend rollback or database restore. A controlled staging/live switching rehearsal
remains an operational release gate. These version IDs are historical evidence;
recheck availability and compatibility before any later incident.

## Live rollback and restoration — 24 October 2026

User explicitly authorized switching to the preceding Hosting version and
restoring the current version. The initial API request was rejected before any
change because Firebase requires release type to be omitted when versionName
is supplied. The corrected request used the retained version name and message.

| Action | Sydney time (AEDT) | Release ID | Version |
| --- | --- | --- | --- |
| Rollback | 1:26:20 pm | 1792808780333000 | 9bedf9c7c5f959b4 |
| Restore | 1:27:01 pm | 1792808821999000 | f345d11443ec4acf |

Both retained versions were FINALIZED and had identical Hosting headers and
rewrites. Before each switch, all local candidate files matched Firebase's
stored gzip hashes. After each switch, all 13 live application files matched
the corresponding build byte-for-byte. The prior version was live for about
42 seconds; restoration used the exact original version, not a fresh rebuild.

The browser owner session was signed out. Owner acceptance was requested after
restoration; no credentials were entered by the agent. The client page displayed
its invitation prompt and the admin page required MFA sign-in. No device pairing,
media upload, backend/configuration change or customer-data mutation was made.
Detailed release responses are retained only in ignored local artifacts.

Restoration acceptance completed after the owner signed in: the still-open tab
initially ran rollback code; refreshing loaded the current onboarding guide.
The guide toggled correctly, library reads returned the ready video/image and
existing rejected fixtures, and advertising-client records loaded with their
existing active/archived states. This confirms the documented need to refresh
open clients after release changes. Evidence: artifacts/live-restore-owner.png.
Full Firebase postflight and eight focused package/dashboard/onboarding tests
passed. All test displays remain revoked, so no live playback or new device
grant was exercised. Authenticated admin/client workflows, database restore
and backend rollback were not part of this rehearsal.
