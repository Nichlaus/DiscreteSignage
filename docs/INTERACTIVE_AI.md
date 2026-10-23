# Interactive AI and packaging

Agreed direction, 2026-10-23. Planned only; no billing, camera access or interactive
character implementation is enabled yet.

## Packages

- Basic advertising: 1-screen, 3-screen and 5-screen tiers.
- POS plus basic advertising: bundle; included screen count remains undecided.
- Interactive AI: separately charged. Per-screen versus per-business charging,
  usage allowances and overage behaviour remain undecided.
- Preserve the 14-day trial without a payment method. Backend entitlements must
  enforce screen limits and interactive AI access. Prices and billing cadence are
  undecided; currency is AUD. Do not promise unlimited AI usage.

## First interaction prototype

A friendly animated cat follows the visitor's position on screen and waves back.
“Follow” means ephemeral position tracking, not recognising people. Use authored
animation states (idle, attend, wave, ask, correct, try again) and local gesture
detection; an AI request is not needed for every frame or gesture.

Trivia displays a question and five large answers. Four directions cannot uniquely
select five answers: the proposed design adds a centre zone to top/bottom/left/right.
Show a practice prompt, highlight the target and require a short steady hold before
submission. Include reset timeouts, one active player at a time, and touch or QR
alternatives. Curate initial questions and answers; AI may later vary wording while
preserving the approved answer. Specify “above sea level” for tallest-mountain trivia.

Camera use requires business opt-in, device permission and a visible customer
notice. Default to local processing, no stored frames, no audio and no face
identification. Clear tracking at session end. Microphone and cloud processing need
separate controls. Denied/missing/disconnected cameras must fall back to advertising.

Prototype on one Android device and compatible camera before promising streamer
support. Test accuracy, latency, lighting, distance, multiple people and thermal
load on real hardware. These are proposed implementation defaults, not completed
features or confirmed hardware capabilities.

## Planned administrator controls

Audited package entitlements, screen allowances, AI usage and trial expiry; versioned
prices when billing exists; interactive-AI disable switch; approved animation and
question versions; camera diagnostics and fallback settings. Never bypass business
or device camera permission. Diagnostics must not collect visitor recordings or identity.
