# Media playback reports

Deployed on 2026-10-21. No historical playback is backfilled.

Owners choose a location and validated media item to see today's starts, the last
seven calendar days including today, lifetime recorded starts, a daily table and
the last report received. Days follow the location timezone. All screens and both
regions in that location contribute to the same media totals.

A start means the player finished loading/presenting a playlist slot and acknowledged
it ready. A returning slot in a multi-item playlist counts again. A single continuous
image/video counts once until reloaded or restarted; automatic loops inside a single
video do not create more starts. Logos, calibration and unsuccessful loads are excluded.
These figures are device-reported starts, not completed plays, audience impressions,
billable airtime or independently verified proof of display. A compromised device
can fabricate otherwise eligible reports within its rate limit.

`reportPlayback({events})` accepts 1–20 events with UUID-like `id`, `mediaId`, `region`,
`version` and millisecond `startedAt`. App Check, active device identity, token validity,
registry/screen binding and active screens entitlement are mandatory. Each new event
must match the current configuration and its location-time schedule at the claimed
start time; assigned media must still be ready. Starts must be within the trial and
within two minutes of server receipt, allowing five seconds of future clock skew.

The device's private `playbackReports` document holds a bounded recent-ID set and
120-new-starts-per-server-minute allowance. Transactions deduplicate concurrent retries
and increments. IDs remain 125 seconds, longer than the accepted retry window, capped
at 512. No raw event history accumulates. Per-location `playbackTotals/{mediaId}` and
`playbackDays/{YYYY-MM-DD}/media/{mediaId}` hold counts and last receipt time. Daily
aggregates currently have no automatic retention/deletion policy. Monitor contention
and storage before expanding to large advertising networks.

`getMediaReport({businessId, locationId, mediaId})` requires current active ownership
and verifies location/media tenancy. Staff and device report reads are denied. Existing
Firestore rules deny all direct reads/writes to the reporting paths; no new grants.

The browser queues up to 120 events in memory, sends up to 20 every 15 seconds and
retries using the same IDs. Old events expire after 110 seconds locally. Playback
continues despite telemetry errors. Closing/revoking a screen, extended outages,
clock skew, rapid configuration changes or limits can lose reports. Settings changes
can reject a queued old-version batch. There is no durable offline queue, completion
tracking, per-screen breakdown, export or customer billing integration in this version.

Validation: all 71 tests and the production build pass. Emulator tests cover device/owner isolation, App Check, wrong region/version,
inactive schedules, revoked devices, stale/future events, batch/rate limits, concurrent
duplicate submissions, totals and direct-rule denials. Player/reporter tests cover
renewal without inflation, stable retry IDs, bounded batches, expiry and stop cleanup.
Local browser preview uses explicitly synthetic figures; evidence is
`artifacts/media-report-preview.png`. Physical device acceptance remains pending.

Deployment: new `reportPlayback` and `getMediaReport` callables, then Hosting.
Postflight passed for twenty callables, Auth/App Check, private infrastructure and
matching portal/display release assets. Reload existing displays to enable reporting.

Live browser acceptance used the approved “Reporting acceptance” display in
Test Cafe → blacktown and the existing synthetic video. Before assignment, today,
last seven days, lifetime and today's daily row were all zero. Successful video
playback increased each to one. Continuous looping and renewed playback authorization
left the count at one; this test does not claim each internal video loop is a new start.
Reloading the display once produced exactly one additional start: all three totals
and today's daily row became two, with the other six daily rows remaining zero.
Evidence: local ignored `artifacts/reporting-live-counts.png`.
Live acceptance did not simulate a lost telemetry response, clock skew or offline
retries; duplicate/retry guarantees retain their automated-test coverage.
The temporary display was revoked afterward and confirmed access unavailable with
zero media elements (`artifacts/reporting-live-revoked.png`). Its two synthetic
starts remain in the location's totals; no new uploads or IAM grants were needed.
