# Data backup and recovery

## Initial audit — 24 October 2026

The live Sydney Firestore database has deletion protection enabled, no backup
schedules and point-in-time recovery disabled. Deletion protection prevents a
database deletion; it does not recover overwritten/deleted documents. The Sydney
media bucket has seven-day soft deletion, with object versioning not enabled.
These were the initial findings; the enabled daily schedule is recorded below.

`node scripts/backup-status.mjs` is read-only by default. It prints database
protection, schedules and bucket recovery settings without customer documents.
The prepared `--apply-daily-7-days` switch creates a daily managed Firestore backup
schedule with seven-day retention. It leaves matching schedules unchanged and
rejects conflicting daily retention. It does not enable PITR, alter bucket
retention, grant IAM or restore anything. This switch was subsequently run with
the user's explicit authorization; see the rollout evidence below.
Backup storage/restore operations are billable; review the retention decision
before rollout. A created schedule is not proof that a usable backup exists.

## Local rehearsal

Run from the repository root:

```powershell
node scripts/rehearse-data-recovery.mjs
```

The harness uses only loopback Auth, Firestore and Storage emulators for the fixed
demo-discretesignage project, with no Hosting or Functions emulator. It seeds
synthetic data, exports, shuts down, then starts fresh emulators and imports the
export. A unique ignored artifacts directory prevents overwriting older evidence.
The fixture refuses missing/non-loopback emulator hosts or a different project.
No live credentials, customer content or production export are used.

The 24 October rehearsal passed:

- Restored business records and timestamp values, including an expired trial.
- Restored verified-owner identity and disabled-device flag/custom claims.
- Matched private media bytes, SHA-256, byte length and stored object generation.
- Owner can read its own business; cross-tenant reads remain denied.
- Revoked device cannot read its screen; anonymous Storage metadata is denied.

Synthetic export: artifacts/recovery-eD3Uac/export. The emulator emitted a Java
deprecation warning; both fixture phases and final harness completed successfully.
The initial sandbox run could not start the local hub; the approved loopback run
completed. Emulator exports are not production managed backups. This rehearsal
does not verify live IAM, cloud backup completeness, MFA-secret recovery, signed
media URLs, point-in-time recovery, or a production database cutover.

## Production recovery procedure (not yet rehearsed)

1. Record the incident, affected resources, last known good time and operator.
   Preserve current evidence and identify whether this is a Hosting-only failure,
   document corruption, missing media, or identity compromise. Use HOSTING_ROLLBACK.md
   for a frontend rollback; it cannot restore data.
2. Identify an available completed managed backup and its actual backup time.
   Restore into a **new isolated database**, never over the live default database.
   Keep client access denied and do not connect existing workers or clients.
   Database names and destination approval must be explicit at execution time.
3. Validate document counts, representative tenant/location/playlist relations,
   timestamps, media paths and object generations. A Firestore backup does not
   include Storage objects, Firebase Auth accounts, rules, IAM, App Check or secrets.
   Restore matching retained object generations separately when needed, preserving
   privacy; never replace generation references without verifying content hashes.
4. Reconcile security changes **since** the snapshot: revoked devices, archived
   clients, disabled users, membership removals and trial expiry. An old active
   record must not re-authorize a revoked device. Do not reset trial clocks. If
   current revocation evidence is unavailable, keep affected access disabled and
   require fresh approval/pairing. Do not restore old pairing/invitation sessions
   into a serving environment or silently reinstate platform-admin grants.
5. Run tenant/device rule tests and deployed security postflight with the intended
   release configuration. Verify media integrity, schedules and representative
   playback using authorized synthetic access before considering customer traffic.
   The current app explicitly uses the default database; a named restored database
   is **not** a drop-in switch. Plan and review any migration/cutover separately.
6. Obtain approval for the concrete cutover plan and its expected data loss/window.
   Confirm monitoring and support coverage, perform bounded acceptance, then record
   the result. Do not delete the damaged source or backup as part of diagnosis.

Daily backups can leave roughly a day of changes outside the most recent backup;
the actual recoverable point is the completed backup timestamp, not a guaranteed
24-hour objective. Restore time is unmeasured. Seven-day Storage soft deletion is
not a coordinated database/media snapshot or protection from every failure mode.
Auth recovery needs a separate approved strategy; never store password hashes,
MFA seeds or service-account credentials in Git or ordinary diagnostic artifacts.

## Remaining gates

Daily seven-day retention is enabled. Observe the first completed backup and rehearse
a cloud restore to an isolated destination with agreed cost and cleanup. Decide
whether PITR is needed and document Auth/configuration recovery. Assign a recovery
owner and acceptable recovery-point/time targets before broad launch.

## Daily schedule rollout — 24 October 2026

At 8:14:25 pm AEDT, created daily schedule
projects/discretesignage/databases/(default)/backupSchedules/df622ced-7d27-4253-9fc3-ef1dd2142f6e
with retention 604800s (seven days). Readback verified the recurrence and retention;
rerunning setup made no changes. Deletion protection, PITR and Storage settings
remain unchanged. Google chooses the daily backup time; no exact first-run time
was promised. Backup listing still returned no backups during this milestone.
There is no completed managed backup or cloud-restore acceptance to claim yet.

The read-only status command now paginates backups and filters by both source
database name and UID to exclude older database incarnations. Only unexpired
READY backups count as candidates. Their snapshot/expiry times are printed;
candidate readiness is not content verification.

Once a candidate exists, use its observed full resource name:

```powershell
node scripts/backup-status.mjs
node scripts/restore-backup.mjs <backup-resource-name> recovery-check-<unique-suffix>
node scripts/restore-backup.mjs <backup-resource-name> recovery-check-<unique-suffix> --apply
```

Preflight is read-only; the explicit apply requests a new database restore and
prints its long-running operation ID. The guard requires the current default
database UID, Sydney location, unexpired READY backup and a recovery-check-*
destination. It refuses an existing database or existing Firebase rules release.
Two local guard tests passed, covering live-destination rejection and invalid
backup identity/state/time. The restore API request has not been executed live.

At continuation, recheck backup readiness, choose a unique destination, await the
operation, verify client-deny rules and inspect restored data/indexes before
claiming success. A named database shares project IAM; it is isolated from app
traffic, not from existing project administrators. Do not route the app or workers
to it, grant access or reapply TTL during inspection. Record the resulting cost,
verification and a separately reviewed cleanup step. Current authorization covers
the isolated rehearsal; it does not authorize a production cutover.

References: [Firestore backup and restore](https://firebase.google.com/docs/firestore/backups),
[backup schedule API](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.backupSchedules),
[emulator export/import](https://firebase.google.com/docs/emulator-suite/install_and_configure).
