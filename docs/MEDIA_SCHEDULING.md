# Weekly media scheduling

Implemented and tested locally on 2026-10-21; not deployed.

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
hours repeat eligibility. No date campaigns, holiday exceptions, priority rules,
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

Release: deploy `updateScreenSettings` and `getScreenPlayback`, then Hosting; reload
players. Test a scheduled start/end on an approved live display and revoke afterward.
No live scheduled-screen test or production deployment has happened yet.
