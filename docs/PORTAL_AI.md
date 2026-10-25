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
