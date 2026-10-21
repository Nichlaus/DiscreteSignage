# Split screens and logo overlays

Deployed on 2026-10-21: settings, workspace and playback functions, then Hosting.
Firebase and Storage postflight checks pass; live entry assets match the tested build.

Owners can choose full-screen, equal side-by-side regions or equal top/bottom
regions. Each region has its own ordered playlist (up to 20 items), image timing
and independent video playback. The screen-wide transition, fit mode and
orientation apply to both regions. Empty regions show calibration. Saving full
screen from the portal clears playlist 2; the form explains this before saving.

One optional logo floats above the regions without receiving clicks. Only validated
images are accepted. Six positions cover left/centre/right at the top or bottom.
Small and medium use a 12% or 18% bounding box, with 3% edge spacing; contain fit
preserves aspect ratio and transparent pixels. Placement follows screen rotation.
The editor offers a simple layout preview and hides irrelevant logo/region fields.

`updateScreenSettings` adds `layout`, `secondaryPlaylist` and nullable
`logo: { mediaId, position, size }`. Omitted fields preserve existing configuration;
legacy screens default to full-screen with no logo. The existing owner, trial,
registration and version checks apply. All assignments are validated inside the
business and audited; videos cannot become logos. No client rule grants change.

`getScreenPlayback` returns ordered `regions` and a separately signed `logo`.
Every active assignment must still be ready; one invalid assignment denies the
manifest. Generation-bound signed URLs share the same expiry (at most 60 seconds)
and repeated media IDs are signed once. The original first-region `items`/`asset`
remain for older players during rollout. Hidden secondary media is not signed.

The player uses the existing lease player for each region and the logo. A shared
manifest cache coalesces in-flight requests and reuses authorization only while
more than 30 seconds remain. Each slot independently enforces the original expiry;
reconfiguration/revocation invalidates pending loads and releases video blobs.
Applied status requires every configured slot to be ready. A fatal video error
stops the whole composition; heartbeat reports an error rather than Applied.

Verification: 59 automated emulator/contract/player tests passed, including invalid
layout/logo inputs, cross-business secondary/logo IDs, video-logo rejection,
deduplicated signing and denial when secondary media is no longer ready. Build
passed. Local synthetic browser checks cover side-by-side and stacked layouts,
portrait rotation, image/video concurrency, logo placement and separate editor
controls. An eight-second synthetic lease with failed renewals removed all region
and logo media; stopping an active composition also cleared every media element.
Evidence: local ignored `artifacts/split-screen-preview.png`.

Limits: no arbitrary region sizes, per-region fit/transitions, animated logos,
offline caching or exact advertising airtime. Two simultaneous video streams and
overlapping transitions increase memory and decoder demand. Android/Google TV
hardware acceptance is required before promising smooth dual-video playback.
There can be up to 41 unique signed assets per manifest; monitor signing latency
and quota with larger playlists.

Live browser acceptance (2026-10-21): the approved temporary “Layout acceptance”
display used Test Cafe's existing synthetic WebP and MP4. Side-by-side and stacked
regions played concurrently; the video decoded at 960×540 and continued looping.
The small top-right logo changed to medium bottom-centre. Removing the logo left
both playlists playing. Reload restored the saved composition and the portal
reported Applied. Screenshots are retained locally in ignored
`artifacts/split-screen-live-columns.png`, `split-screen-live-rows.png` and
`split-screen-live-no-logo.png`.
Both regions continued playing across a full 60-second authorization window.
Revoking the temporary display showed “Display access unavailable” and removed
all media elements; evidence is `artifacts/split-screen-live-revoked.png`.
The display remains revoked and no new media files were uploaded.

Existing displays must reload to load the new composition player. Physical Android
and Google TV testing, live trial expiry and live offline lease expiry remain
untested; local expiry tests do not substitute for those acceptance checks.
