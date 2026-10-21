# Screen playlists and transitions

Deployed on 2026-10-21, including the form usability improvements.

Owners can add, remove and reorder up to 20 validated images/videos per screen.
Image durations are whole seconds from 3 to 300 (default 10). Videos use their
validated duration and remain muted. A single video loops; a mixed playlist repeats
in order. Empty playlists show the calibration card. Repeated media is permitted.

Transitions are fade (default), slide, zoom and instant cut. Effects last 450 ms;
reduced-motion preference or missing animation support uses an instant cut.
Rotation and scaling apply to the outer stage independently of the transition.
The outgoing asset remains visible while the next asset downloads, then it is
released after the swap. This bounds memory to current/incoming media, but slow
downloads can extend a slot. Scheduling and exact advertising airtime are not
implemented by these durations. Videos can hold their last frame during loading.

`updateScreenSettings` accepts `playlist: [{ mediaId, duration }]` and `transition`.
It checks every unique media ID within the business, active ownership, entitlement,
device registration and expected version in a transaction. Changes are audited.
Legacy `mediaId` assignments remain supported, but cannot accompany `playlist`.
Omitting both preserves the existing assignment. No Firebase client grants change.

`getScreenPlayback` validates every assigned item and returns ordered `items`,
each with a duration and private, generation-bound signed asset. The first `asset`
remains in the response for older players during rollout. Renewals refresh URLs
without restarting the current slot. Authorization lasts at most 60 seconds;
expiry/revocation clears playback and invalidates pending loads/transitions.
Load failures retry another slot after five seconds within the existing lease.
There is no persistent offline cache or whole-playlist preloading.

Validation: 58 emulator/contract/player tests passed, including invalid playlist
inputs, cross-business media, stale updates, permission checks, mixed ordering,
wraparound, renewed URLs and revocation during loading/transition. Production
build passed. Local synthetic browser preview passed all four effect selections,
mixed playback, add/remove/reorder and revocation clearing the stage. Evidence:
local ignored `artifacts/playlist-preview.png`.
Physical Android/Google TV acceptance remains pending.

Live acceptance (2026-10-21): paired the approved “Playlist acceptance” display
with Test Cafe → blacktown, using the existing synthetic image and video. Saved
an image-first playlist with a five-second image and default fade; observed both
media types, Applied acknowledgement and playback beyond the renewal window.
Portal reload retained order, duration and effect. Reordered video first and
selected slide; the saved settings were acknowledged and playback resumed after
a display reload. Revocation removed every media element and showed access
unavailable. The display is revoked; existing fixtures remain unchanged.
Zoom and instant-cut selections were checked locally, not repeated live.
Local evidence: `artifacts/live-playlist-playing.png`,
`artifacts/live-playlist-settings.png`, `artifacts/live-playlist-revoked.png`.

Release order: `updateScreenSettings`, `getWorkspace` and `getScreenPlayback`,
then Hosting. Verify mixed playback, editor persistence, effects, renewal and
revocation on an approved test display. Older players show only the first item
until reloaded onto the new release. Existing single-media screens migrate lazily.
