# Operational monitoring

Google Cloud Monitoring runs independently of Codex and the local computer.
Created 24 October 2026 for the signage pilot. Monitoring is not a promise of
24/7 human response; assign a support owner and response hours before launch.

## Enabled production configuration

- Four HTTPS GET checks: index.html, display.html, admin.html and client.html on
  discretesignage.web.app. Every five minutes, 10-second timeout, certificate
  validation enabled, exact HTTP 200 and page-specific content required. Regions:
  USA, Europe and Asia Pacific. No credentials or customer data are sent.
- One uptime alert with a separate condition per page: more than one failed
  checker location, sustained five minutes. Last samples are aligned over ten
  minutes to cover the check interval. Detection is not instantaneous and is
  subject to sample/evaluation delays. This is two checker locations, not a
  guaranteed two-continent quorum (USA contains multiple locations).
- One backend policy: more than four HTTP 5xx responses per Cloud Run service in
  a five-minute alignment window, aggregating revisions. Covers project services,
  including Functions v2 and the private video worker. No public worker access
  or service-account/IAM changes were made.
- One enabled email channel to the address explicitly supplied by the owner.
  Policies notify on opening/closing; no repeated reminder interval is configured.
  Incidents auto-close after an hour without data. Auto-closure is not proof of
  service recovery; inspect the timeline and check the affected service.

## Operator commands

From E:\Screens\DiscreteSignage, using the existing authorized Firebase CLI login:

```powershell
node scripts/monitoring-status.mjs
node scripts/setup-monitoring.mjs <authorized-alert-email>
node scripts/check-public-site.mjs
```

Setup creates missing resources but refuses conflicting existing configurations
or duplicate display names. A rerun with the same configuration is non-mutating.
It does not silently change recipients or thresholds. Status prints resource IDs
and recent uptime samples without email labels. It shows the first time-series
page and reports when further results exist. Run the public delivery probe to
check entry assets; cloud uptime checks check HTML only, not the full JavaScript
bundle graph. Follow PILOT_SUPPORT.md and HOSTING_ROLLBACK.md for incidents.

## Changes and maintenance

Review recipient/threshold changes before applying them. Use a bounded Monitoring
snooze for planned maintenance rather than permanently disabling production
policies; record start/end and verify monitoring resumes. Do not loosen App Check,
Firebase rules, private-worker access or IAM to satisfy monitoring. An uptime
check does not sign in and cannot exercise privileged workflows.

For delivery tests, use a separate TEST ONLY policy and synthetic metric. Never
break the live site or change the production error threshold to force an alert.
Clear the synthetic value and disable the test policy after confirmation. Retain
its identity with the test record; it is not a production policy. No passwords,
tokens, raw logs or customer content should be included in email documentation.

## Coverage limits and release gates

This does not detect individual offline displays, missing playback reports,
authentication failures, business errors returned with HTTP 200, rejected media,
missing metrics, database corruption, quotas or budget overruns. Low traffic may
never reach five backend errors. Alert delivery must be verified; assigning an
email channel alone does not prove inbox receipt. Device-health notification,
backup/restore rehearsal, billing alerts and authenticated synthetic checks are
separate future work. Existing Firebase postflight remains a release gate.

## Cost and references

The selected five-minute checks are below Google's published one-million monthly
uptime-execution free allotment at the currently configured location count, in
isolation. Shared project usage can consume that allowance. Hosting traffic and
other Google services have their own billing; inspect actual billing rather than
promising zero cost. Pricing was checked on 24 October 2026.

- [Google Cloud Observability pricing](https://cloud.google.com/products/observability/pricing)
- [Uptime alert examples](https://docs.cloud.google.com/monitoring/alerts/policies-in-json)
- [Notification channels API](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.notificationChannels)

## Initial configuration evidence

Production policies: 8049344450468617202 (public pages), 8049344450468617365
(backend 5xx). Email channel: 11111903878732052963. All are in discretesignage.
Four uptime checks were created and read back. Setup rerun confirmed no duplicates
or configuration drift. Three configuration tests passed. At 6:57 pm AEDT, recent
samples included successful responses from all four pages; every returned sample
passed. This is initial availability evidence, not a playback or sign-in test.

Synthetic delivery policy 1007648280476373608 was created at 6:54 pm AEDT.
The owner initially reported no email received, then confirmed receipt of
“TEST ONLY — Discrete Signage email delivery” on 24 October 2026. This verifies
delivery of the synthetic opening alert to the authorized inbox; production
outage conditions and recovery-email delivery were not induced or tested.
The synthetic value was cleared and the test policy disabled after the rehearsal;
production policies remain enabled. Public delivery also passed for
four pages and nine entry assets at 6:58 pm AEDT.

Individual-screen follow-up: implementation and rollout configuration now exist
in SCREEN_ALERTS.md, but are not deployed. The enabled production coverage above
is unchanged until that rollout and live acceptance are completed.
