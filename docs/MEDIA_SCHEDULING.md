# Weekly media scheduling

Deployed on 2026-10-21: `updateScreenSettings`, `getScreenPlayback` and Hosting.
Firebase postflight passed, including protected callables and exact release assets.

Implemented locally on 2026-10-22, not deployed: optional campaign first/last dates
inside each weekly schedule. Enable “Limit this advert to a date range” and choose
both dates; existing schedules without dates retain their behavior. The extended
contract adds `startDate` and `endDate` together as strict YYYY-MM-DD calendar dates
from 2000–2199. Impossible dates and reversed ranges are rejected server-side.
Both dates are inclusive in the location timezone and clip actual playback, rather
than the nominal start day of an overnight slot. This means an eligible prior-night
tail can play after midnight on the first date, but an overnight slot on the last
date stops at midnight. Weekly days/hours remain required; full-day date-only
campaigns remain a later enhancement. Removing the date checkbox drops both fields.

The existing lease boundary logic caps authorization at local midnight when date
eligibility changes. Playback and reported-start validation share the same evaluator.
All 80 tests and build pass; new tests cover strict dates/leap years, same-day campaigns,
timezone boundaries and overnight expiry. Browser checks cover date serialization,
reversed-date validation and removing limits. Screenshot: `artifacts/campaign-dates-preview.png`.
Rollout: deploy `updateScreenSettings`, `getScreenPlayback` and `reportPlayback` before
Hosting, then reload owner portals so older editors cannot drop the new date fields.
Live date-boundary acceptance is pending. No Firebase rules or IAM changes are needed.

Each playlist item defaults to Any time. Owners can choose selected weekdays and
one start/end time window per item in either screen region. Times use the location's
stored IANA timezone, shown above the playlists. Add the same media again for a
second window, within the existing 20-item limit. Eligible entries retain playlist
order; overlapping schedules share the rotation rather than reserving airtime.

The optional item field is `schedule: { days, start, end }`, with unique weekday
numbers Sunday=0 through Saturday=6 and strict HH:mm times. Start is inclusive;
end is exclusive. Earlier end times mean the following day, attributed to the
selected start day. Equal times are rejected; omit schedule for unrestricted use.
On DST spring-forward, nonexistent local times are skipped; repeated fall-back
hours repeat eligibility. Date campaigns are implemented locally as described above. No holiday exceptions, priority rules,
calendar editor, full-day weekday preset or proof-of-play reporting yet.

The backend evaluates the location's timezone using server time, signs only
currently eligible assets and caps the shared manifest lease at the next eligibility
change within its normal 60-second lifetime. All original owner, tenant, trial,
device, validated-media and audit checks remain. No Firebase rule/IAM grants change.
Inactive items are still validated on assignment; they receive no playback URL.
Logos remain independent of schedules. An empty eligible region shows calibration;
an unrestricted item can serve as fallback, but also plays during scheduled hours.

The player clears expired content, including an unfinished video, at the lease
deadline. A changed eligible list clears old content before downloading replacements.
A short gap can occur at a boundary while the next grant/media loads; this is not
frame-accurate airtime booking. Displays still require connectivity and a correct
device clock for lease enforcement. Browser suspension/hardware acceptance remains
a separate release check.

Validation: 66 emulator, contract, decoder and player tests passed. Coverage includes
strict inputs, start/end boundaries, overnight week wrap, Sydney DST, Adelaide's
offset, split-region filtering, tenant/owner rejection, audited settings, unsigned
inactive media, cutoff timestamps and clearing old content before a slow load.
Local browser checks verified overnight serialization, no-day validation and removal
of a schedule via Any time. Local screenshot: `artifacts/scheduling-preview.png`.

Live browser acceptance on 2026-10-21 used the approved temporary “Schedule acceptance”
display in Test Cafe → blacktown and the existing synthetic MP4. Wednesday-only
20:36–20:37 Australia/Sydney persisted and the portal reported Applied. Observations:

- 20:35:02 and 20:35:52: calibration, no video element.
- 20:36:13: video playing automatically, readyState 4, decoded at 960×540.
- 20:37:08: video removed and calibration restored without a manual reload.

These observations verify automatic eligibility changes, not frame-exact boundary
latency. Local ignored evidence: `artifacts/schedule-live-before.png`,
`schedule-live-playing.png` and `schedule-live-ended.png`. Existing displays should
reload to load the current player. Physical Android/Google TV scheduling, suspension,
overnight and DST transitions remain hardware/live acceptance work; automated tests
cover overnight and DST semantics.
The test display was revoked afterward: access unavailable, zero remaining media
elements (`artifacts/schedule-live-revoked.png`). No new uploads or permissions.
