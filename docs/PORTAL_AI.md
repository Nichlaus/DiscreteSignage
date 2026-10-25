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
