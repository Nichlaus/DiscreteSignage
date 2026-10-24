# Individual-screen operational alerts

Deployed on 24 October 2026; live offline/recovery email acceptance passed.
These alerts are for the developer's operational inbox, not customer recipients.

## Behaviour

`monitorScreenHealth` runs every five minutes. An active, correctly assigned screen
with an active screens trial is overdue after 15 minutes without a heartbeat.
New pairings get the same grace period from creation. Revoked/replaced screens,
missing screen records and expired/ineligible trials publish zero to clear any
existing alert. Reconnection also publishes zero. A closure therefore does not
prove playback resumed. Normal detection is roughly 15–20 minutes plus Monitoring
evaluation and email delays. Small clock skew up to one minute is tolerated.

Heartbeat writes already require the device's own identity and `request.time` in
Firestore rules. No client access or rules changes were added. The scanner reads
server-side and publishes IDs only: business, location, screen and device. It
does not include names, email addresses, media or credentials. Follow those IDs
through the existing owner portal or MFA-protected administrator diagnostics.

One metric series per device preserves separate incidents without sending a new
email every scan. Opening/closing notifications use the confirmed operational
channel; no repeated reminder is configured. A separate missing-data policy
warns after 30 minutes without a completed scan. It needs an initial successful
sample, so verify first execution during deployment. Auto-close after 24 hours
without data is not proof of recovery.

Offline means not reporting. Downloaded Android playback can continue within its
existing authorization. Heartbeats also do not prove visible playback. This pilot
assumes paired screens should report continuously, including outside playlist
campaign hours. Business opening hours, per-screen opt-in, planned downtime and
customer notification preferences remain future work. Use a bounded Monitoring
snooze when intentional downtime is expected; do not revoke solely to mute an alert.

## Deployment checklist

1. Inspect existing service-account permissions. The runtime needs metric writes
   in addition to its existing Firestore read access. If missing, obtain approval
   for the narrow `roles/monitoring.metricWriter` grant to the runtime identity
   `discrete-platform@discretesignage.iam.gserviceaccount.com`. No grant was made
   during implementation. The user explicitly approved this grant for deployment
   on 24 October 2026. Keep scheduler invocation private.
2. Run `node scripts/setup-monitoring.mjs <authorized-alert-email> --screens` to
   create the two metric descriptors and policies. The switch is explicit; ordinary
   setup reruns do not enable this feature. Existing conflicting config is rejected.
3. Deploy only `functions:monitorScreenHealth` to discretesignage. Check the
   generated Scheduler job, private invocation and service identity. Verify first
   scan completion and descriptor/series labels even if there are no active screens.
4. With authorized temporary device access, verify fresh heartbeat = zero, loss
   for at least 15 minutes = one, one opening email, and restored heartbeat = zero
   with a closure email. Also check revocation clears the condition. Restore the
   test network and revoke test access. Never edit real customer heartbeat times.
5. Verify the missing-scan alert separately with a bounded maintenance exercise.
   Existing unit tests do not establish live scheduler, IAM or email behaviour.

## Limits, failures and recovery

The pilot scanner reads at most 200 businesses and 2,000 total device records
(including revoked history) per run. It fails explicitly before metric publication
when those limits are exceeded. At current scale this avoids unbounded scans;
pagination/sharding and retention must be addressed before increasing capacity.
Each run reads business/device/entitlement/screen/status documents and writes a
metric per device plus completion. These incur Firestore, Functions, Scheduler
and Monitoring usage; inspect billing before scaling. There is no free-cost claim.

All reads finish before publication. Metrics are written in batches of at most
200; completion is written only after all batches succeed. A partial write fails
the invocation and does not emit completion. Runs have 240-second timeout, one
instance/concurrent request and no Scheduler retries; next run re-evaluates current
state. Duplicate delivery can still occur; metrics are state samples, not counters.
Do not delete device records as an incident fix: absent series can linger until
auto-close. Existing revocation retains records and emits zero on subsequent scans.

For a faulty rollout, pause its Scheduler job and snooze/disable only the two new
screen policies while investigating; preserve public-page/backend monitoring.
Record the maintenance and restore the job/policies, then verify fresh completion.
No customer records are written by this worker.

References: [scheduled functions](https://firebase.google.com/docs/functions/schedule-functions),
[custom metric API](https://docs.cloud.google.com/monitoring/custom-metrics/creating-metrics).

## Deployment evidence — 24 October 2026

Deployed only `functions:platform:monitorScreenHealth` from implementation 4d780b4.
The unqualified filter did not match the codebase and made no deployment changes.
Scheduler API was enabled by the Firebase deployment. The job uses the configured
runtime identity for OIDC; Cloud Run permits only that identity to invoke it and
has no public invoker binding. Approved metric-writer grant preserved existing IAM.
The worker is ACTIVE with one instance/concurrent request and a 240-second timeout.

Policies: 2003653142947697765 (screen not reporting) and 16150938614972658733
(scanner stalled). Both enabled, with OPENED/CLOSED notifications on existing
channel 11111903878732052963. `scripts/screen-monitoring-postflight.mjs` verifies
these deployment properties and requires a completed scan within 15 minutes.

Approved temporary screen: Offline alerts acceptance, Test Cafe / blacktown,
device d_24df6c1c0cf6475e0964aa4569b507f1. Initial scan at 08:44:56 UTC (7:44:56 pm
AEDT) recorded offline=0, followed by completion. Stopped only its browser player
at about 7:45 pm AEDT, leaving real server heartbeat timestamps unchanged. This
tests loss of reporting rather than visible-media playback or physical networking.
Automatic scans at 7:49, 7:54 and 7:59 pm continued to report zero during the
grace period. Last actual heartbeat was 7:45:07.717 pm. A Scheduler-triggered
acceptance scan at 8:00:18.429 pm reported one (15 minutes 10.7 seconds later),
followed by a completed-scan metric. The owner confirmed receipt of the opening
email before reconnection at about 8:04 pm. The same paired browser then resumed
normal server-timestamped heartbeats. The automatic 8:05:05.720 pm scan returned
offline=0; the requested follow-up at 8:05:15.463 pm also returned zero. The owner
confirmed receipt of the recovery email before revocation. Thus closure was
verified for reconnection rather than inferred from revocation or trial expiry.

Revoked the temporary device at about 8:07 pm AEDT: its server record is inactive
and the player visibly showed “Display access unavailable.” Evidence is saved in
artifacts/screen-alerts-revoked.png; the temporary browser tab was closed. No media
uploads or customer heartbeat edits occurred. The production policies and job
remain enabled. Missing-scanner alert delivery has not been rehearsed; the
completed-scan metric and absence-policy configuration were verified.

Ten focused tests and the full Firebase postflight passed after deployment,
including existing Auth/App Check enforcement, private media worker, anonymous
callable rejection, Hosting asset checks and runtime self-signing restrictions.
