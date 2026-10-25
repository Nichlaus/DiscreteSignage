# Portal AI

## Foundation — 25 October 2026

Food-market expansion is paused. Advertising workflows and AI are the next focus;
existing menu features remain available.

Implemented locally: a provider-neutral playlist draft service and an isolated
owner review component. Neither is connected to the deployed portal. No callable
is exported, no AI provider is configured, and no real prompts have been sent.

The service requires verified active business ownership, App Check, active signage
and aiStudio trial entitlements, a registered active screen and 1–20 validated
media from the same business. It checks access again after planning. Changed screen
versions or location time zones require a new draft.

A planner receives the owner's bounded prompt, selected media IDs/names/types,
selected current playlist entries, local date and location time zone. It receives
no file bytes, playback URLs, device credentials or account identifiers. Names
and prompts remain untrusted input. Planner output is restricted to a clarification
or a validated primary playlist; unknown actions, extra authority fields and media
outside the selection are rejected. Draft preparation performs no database writes.

The review shows the old and proposed primary playlists, durations and schedules.
Approval calls the existing versioned updateScreenSettings operation, which checks
authorization and media again and records its existing audit event. Discard does
nothing. A failed save requires refreshing status before another draft. This review
is a user interaction safeguard, not a new authorization boundary: authorized
owners already have permission to update their screens through ordinary controls.

## Validation

- Full emulator suite: 150 tests passed, including five draft-service tests.
- Separate review tests: two passed (escaping, explicit approval, duplicate-click
  prevention and discard).
- Local synthetic browser preview: before/after review displayed correctly;
  simulated save failure disabled retry, and discard removed the draft.
- No production deployment or live AI test in this milestone.

## Before enabling live AI

Choose a provider; configure its server-side secret and bounded structured-output
adapter. Add request/concurrency quotas, cost limits, timeout/output limits,
operational controls and privacy disclosure before exposing a callable. Integrate
the prompt, screen and media selection form with this review. Test real ambiguous
requests, hostile media names, cross-business isolation, stale settings and approval
end to end. Do not log raw prompts or provider secrets. Provider data-retention
settings and pricing remain undecided. Paid entitlements are not implemented here.

Image generation and customer-facing camera/gesture AI are later milestones, with
separate entitlements and usage budgets; neither is part of this foundation.

## OpenAI integration — 25 October 2026

The user selected OpenAI. The backend now exports preparePlaylistDraft with enforced
App Check and a Secret Manager binding for OPENAI_API_KEY. It uses the Responses API,
gpt-4o-mini, strict structured output, store:false, no tools, no automatic retries,
a 25-second request timeout, a 16,000-character input envelope and 3,000 maximum
output tokens. Server validation still applies after response parsing. Refusal,
incomplete and invalid responses fail without publishing. store:false is not a
claim of zero provider retention; review provider data controls before activation.

The owner portal now includes screen selection, validated-media checkboxes, a bounded
request field, provider disclosure, examples, allowance feedback and explicit
before/after approval. Changing the request or selection discards the old review.
Neither generation nor clarification saves screen settings. Ordinary versioned
screen authorization remains the only save path.

Server-only platformConfig/assistant must contain enabled:true before any provider
request can be reserved. Missing configuration disables the service. Transactional
reservations enforce 20 requests per UTC day and 100 lifetime requests per business
(currently trial-only), plus 1,000 requests per UTC day across the platform. One
business request can be in flight, with a 60-second lease and 15-second minimum
spacing. Failures consume a reservation; counts are not refunded. Crashed leases
expire automatically, and an older completion cannot clear a newer lease.

These are request caps, not an AUD billing meter. No raw prompt, output or API key
is stored in quota records. Actual provider-token accounting and admin usage UI
remain planned. The current caps are fixed server constants. Do not reset total
usage to extend a trial. Daily usage is in platformUsage/assistant and
businesses/{businessId}/assistantUsage/current; client SDK access remains denied.

### Activation checklist (not performed)

1. Configure OPENAI_API_KEY through the Firebase secret prompt or Secret Manager,
   never chat, source files, VITE variables or shell command arguments. Use a dedicated
   OpenAI project and configure provider billing alerts/limits as available.
2. Review deployment changes and bind secret access to the existing service account.
   Deploy backend and Hosting together; do not enable until the secret is configured.
3. Set platformConfig/assistant enabled:true through trusted administration, then
   run bounded real-provider tests and a temporary-screen approval test. Verify
   ambiguous requests, hostile names, timezone schedules, usage and stale versions.
4. Disable new provider calls by setting enabled:false. Already prepared drafts and
   in-flight requests are not revoked by this switch; normal screen authorization
   still applies. Hosting rollback does not reset quota records.

Current validation uses mocked provider responses and the isolated demo Firebase
emulators, plus a synthetic local browser form. No API key configured, real OpenAI
request, production configuration mutation or deployment in this milestone.

Validation result: all 157 tests passed and the production build passed. The local
browser check verified missing-selection guidance, draft review with allowance
feedback, and removal of the old draft after editing the request.

API implementation reference: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Deployment — 25 October 2026

347a65f assistant callable and Hosting deployed successfully. The user configured
OPENAI_API_KEY version 1; only version metadata was inspected. Firebase granted the
runtime service account secretAccessor on this secret and bound it to the callable.
The backend enablement switch is on. Postflight now checks the assistant's secret
binding, concurrency/timeout limits and rejection of unauthenticated requests.
Live application acceptance is pending owner sign-in after the portal refresh.
The user-approved OpenAI assistant acceptance browser display is paired at Test
Cafe / blacktown and must be revoked after the test. No AI draft has been requested
or approved yet; deployment alone does not verify provider billing or model access.

### Live acceptance follow-up

Real OpenAI requests succeeded in the owner portal. The first draft incorrectly
used 10 seconds instead of the requested 8; it was discarded. An explicit second
request produced the correct image-first 8-second entry and full video entry, and
approval saved it. The image was visibly rendered and the portal reported Applied.
A video-only follow-up was approved and visibly played at 960×540 with readyState
4, paused:false and advancing currentTime. Initial loading required retries; this
was not a latency or continuous mixed-playlist stability certification.

An ambiguous opening-hours request initially invented 09:00–17:00. That draft was
discarded. Added and deployed a deterministic clarification guard for opening,
business, trading and operating hours (no such records are supplied to this planner).
Its three provider tests passed, and the same live request then asked for exact
days/times without a save button. Other ambiguous wording still depends on the
model; human review remains essential. No claim of general semantic correctness.

Five reservations were consumed: portal feedback showed 15 daily / 95 trial
remaining. One was the guarded clarification, which makes no provider call but
still counts as an assistant request. Full postflight passed for the initial
release; the targeted guard update completed successfully afterward. Evidence is
in ignored artifacts/assistant-live-image.png and assistant-live-video.png.
Cleanup completed: owner portal marked OpenAI assistant acceptance revoked;
the player stopped and returned to its pairing screen. Temporary tab closed.

## Guided scheduling — 25 October 2026 (deployed)

The playlist assistant now offers “Choose exact days and times” alongside custom
AI requests. Owners select an image duration (3–300 seconds), any-time playback or
weekdays with start/end times. The screen location's timezone is shown and updates
with screen selection. The form explains overnight start-day semantics, blank
periods and Android offline schedule-boundary behavior. Every selected item receives
the same timing in displayed order; videos play in full unless a schedule ends.
Campaign date controls and per-item guided timing are not included in this step.

preparePlaylistDraft accepts exactly one of prompt or guided. Guided values use
existing schedule validation and preserve exact duration/day/time choices; no
provider call occurs. The existing owner/device/media/entitlement checks, quota
reservation, post-preparation access/version check and explicit reviewed save remain.
Guided drafts count toward the existing allowance; the form states this. Other
regions, logos and layout remain unchanged. No permissions or Firebase rules changed.

Local synthetic browser checks confirmed Friday 22:00–02:00 at 22 seconds in the
review, blocked an empty day selection and removed the stale review, then switched
to Any time with no residual schedule. Evidence: artifacts/guided-scheduling-local.png.
The initial emulator run caught a request-schema mistake; corrected mutually
exclusive fields before final validation. No production writes or provider calls.

Final validation: 169 tests passed against isolated demo emulators, zero failures;
production build and diff checks passed. Guided request tests verify overnight
precision, any-time schedule removal, usage reservation/release, no provider call,
no screen mutation before approval, preserved secondary playlist, owner-only access,
foreign-media rejection and rejection of mixed guided/custom requests. Deployment
and live acceptance were completed in the follow-up below.

Production deployment: preparePlaylistDraft and Hosting released successfully.
The live owner flow preserved a 22-second image duration, Sunday 18:49–18:50
Australia/Sydney, and required reviewed approval. The advert appeared after the
start boundary and stopped after the end. This exposed a browser fallback bug:
an explicitly empty authorized playlist loaded calibration. The player now keeps
empty schedules blank, acknowledges the authorized version, and retains lease
expiry/revocation behavior. A regression covers empty/image/empty and offline expiry;
all 15 targeted player, assistant review/form and Hosting tests passed.

The overnight test used 23:59–18:57: Sunday selected stayed blank before Sunday's
start; Saturday selected played on Sunday in the previous day's overnight tail.
This does not constitute observing an actual midnight rollover. Evidence is in
artifacts/guided-live-start.png, guided-live-empty-fixed.png and
guided-live-overnight-active.png. No provider generation, uploads or quota resets
were needed; three guided requests left 8/day and 88/trial.

At the live 18:57 end boundary the advert disappeared. The connection notice was
briefly visible during lease renewal, then the authorized empty stage was black
(artifacts/guided-live-overnight-ended.png). A completely seamless boundary was
not demonstrated. Final full postflight passed, including live asset matching,
security headers, endpoint authentication, App Check and database protections.
Cleanup completed: Guided schedule acceptance is revoked, the player displayed
access unavailable, and its temporary browser tab was closed.

## Smooth browser cutoff — 25 October 2026

Deployed a follow-up that leaves the playback stage visible when individual leases
clear their content. Previously the last cleared region exposed the connection
notice until the next authorization response. Expired content is still removed
immediately, error status is still reported, and an explicit player stop (including
device revocation) restores connection UI. During lease failures after playback,
the customer-facing display stays blank instead of showing a connection message.
Ten player tests passed, including a screen-player regression covering the instant
of expiry, subsequent empty authorization and explicit stop.

Live acceptance passed at Test Cafe / blacktown with approved temporary screen
Smooth cutoff acceptance (d_f0e26f7a09f01ce2ea97a5e4592d1da5). The existing coffee
advert used 15 seconds, Sunday/Friday 19:00–19:04 Australia/Sydney. On Sunday
25 October, 252 read-only DOM observations over 55 seconds spanning the end
boundary found no visible connection notice. The first blank sample was
08:04:00.134 UTC (19:04:00.134 AEDT); it stayed blank through 08:04:21.320 UTC.
Sampling was approximately every 200 ms, not frame-level video capture. Screenshots
confirmed advert then black output. Evidence: artifacts/smooth-cutoff-before.png,
smooth-cutoff-after.png and smooth-cutoff-observations.json. One guided request
left 7/day and 87/trial. No generation, uploads or quota resets.

Cleanup verified: owner portal marked the screen revoked; player showed access
unavailable and its temporary tab was closed. Production postflight had passed
for this same release; no code or deployment changes were needed during acceptance.

## Reuse an existing playlist — 25 October 2026 (local, not deployed)

The playlist assistant now offers “Use this screen’s current playlist”. It copies
Playlist 1 from the last refreshed workspace, selects its ready media in existing
order, and fills the guided duration/days/times. Loading is local and does not
consume quota or call OpenAI. Preparing a draft still uses the existing allowance,
server checks and explicit reviewed save. Users are prompted to refresh screen
status first; this is not a fresh server fetch. Other regions and logos are untouched.

The shortcut rejects empty playlists, missing library media, repeated media, more
than 20 items, mixed per-item timings and campaign dates rather than silently losing
those details. The screen editor remains available for those playlists. Adding new
media places it after the reused items in the displayed order. No backend, rules,
permissions or provider changes were needed.

Validation: six targeted tests passed and production build passed. Synthetic local
browser acceptance preserved video/image order, 22 seconds and Friday 22:00–02:00
through draft review. Switching screens cleared the old review; mixed timing showed
a helpful refusal without changing selections. Evidence:
artifacts/assistant-existing-review.png. No production writes or deployment in this
milestone. Live deployment/acceptance is the next step.
The guided timing fieldsets now expand fully instead of nesting scrollbars; the media list keeps its height limit.
