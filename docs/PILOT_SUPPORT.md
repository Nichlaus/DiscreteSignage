# Signage pilot incident guide

Use this during supervised pilot support. Public-page and backend error alerts
are configured in Google Cloud; see MONITORING.md for coverage and delivery status.
No human on-call coverage is established. Assign a support contact,
response hours and escalation owner before inviting pilot customers.

## Record the problem

Record Sydney date/time, business/location/screen reference, app version/device,
last successful playback, visible error and whether one or several screens are
affected. Ask for a description that excludes passwords, MFA codes, pairing
secrets and customer images. Record actions and results in the incident record.

## Public site unavailable

From the project root, run:

```powershell
node scripts/check-public-site.mjs
```

Exit 0 means the four public HTML pages and unique entry assets were delivered
with expected types and headers. Exit 1 means investigate the reported failure.
Each request has a 20-second timeout and redirects are rejected. Requests are
sequential, public and unauthenticated; no account or cloud configuration is
changed. It requires Node with built-in fetch, not Firebase login or a local build.

A pass does not test dynamic imports, sign-in, permissions, databases, workers,
media decoding or playback. A local network failure can look like an outage;
confirm from another connection before declaring a service-wide incident.
Do not repeatedly retry in a tight loop or weaken security to make checks pass.

After a deployment, use the existing full Firebase postflight with the matching
release build. For a confirmed frontend regression, follow HOSTING_ROLLBACK.md.
A Hosting rollback will not repair a database or backend service failure.

## A screen is blank, stale or disconnected

1. Confirm power, selected display input and that the app is open. Check whether
   the issue affects one region, one screen or every screen at the location.
2. Refresh portal screen status. Applied is an acknowledgement, not proof of
   visible playback. Check saved playlist, media validation, location time zone,
   campaign dates and whether any items are currently eligible.
3. Check trial end and revocation state. Do not bypass expiry or re-enable a
   revoked device without the owner's authorization and the normal pairing flow.
4. Check connectivity. Downloaded Android playback can continue only within its
   current foreground authorization (up to 24 hours, capped by trial/schedule).
   Restart/resume needs fresh online authorization. A restart during an outage
   can stop otherwise valid cached playback, so restore connectivity first.
5. For persistent errors, capture the non-sensitive error text and escalate with
   device/app details. Do not clear app data or reinstall as a first response:
   doing so can remove pairing and cached media. Do not promise universal hardware
   compatibility; physical acceptance is still pending.

## Uploads or client adverts fail

Check the file's visible status and supported limits. Private originals are not
playable until validated. Client submissions additionally need owner approval.
Check quota before retrying; unfinished uploads count. Eligible cleanup is bounded
by retention rules and must use the existing owner controls, not raw storage or
database deletion. Do not clean customer content as a diagnostic shortcut.

## Access or security concern

Use the MFA-protected admin diagnostics only within assigned platform authority.
Check the business, role, location, trial and device state. Never ask for a user's
password, setup key or MFA code. If access appears wider than intended, stop the
affected pilot activity and escalate. Do not disable App Check/rules or broaden IAM.
Use existing revocation controls when authorized; preserve minimal incident evidence.

## Close the incident

Record the cause, changes, version and verification. Recheck the affected screen
visually with the operator; a passing HTTP probe alone is not recovery. Record
remaining limitations and any follow-up. No external messages are sent by these
scripts; customer communication requires the agreed contact and authorization.

## Evidence — 24 October 2026

Three public-check tests passed, including missing-page/asset HTML fallback,
network failure, bad HTTP status and missing security headers. The live probe
passed at 6:49 pm AEDT for four pages and nine entry assets. This does not close
the automatic monitoring, alert-delivery or backup/restore release gates.
