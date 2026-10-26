# Interactive AI and packaging

Agreed direction, 2026-10-23. A local interaction prototype is implemented as of
26 October. No production interactive experience, billing or camera access is enabled.

## Local prototype — 26 October 2026

Run the existing Vite development server and open `/prototypes/interactive.html`.
This page is excluded from the production build inputs. It imports no Firebase
or AI SDK, requests no camera/microphone access, and stores no visitor data.

Authored SVG cat eyes follow pointer position; a labelled button simulates a wave.
One curated mountain question uses top/left/centre/right/bottom answer zones.
Pointer dwell selects after 900 ms; changing/leaving a zone resets dwell. Tap or
keyboard activation selects directly. Answers lock until restart. End session,
Escape, page hiding or 30 seconds without input clear transient interaction state.
Reduced-motion styling avoids the repeated wave animation. This is interaction
simulation, not real camera tracking, person detection or generative conversation.

Three focused policy tests passed (steady hold, target loss/change, locked answer,
invalid zone and idle reset). Production build passed with no new production entry.
Local browser acceptance verified correct/incorrect feedback, restart, explicit end
disabling answers, and the wave control; narrow layout was visually checked.
Evidence: ignored `artifacts/interactive-prototype.png`. Live camera accuracy,
Android integration, TV layout, physical-device acceptance, business/device opt-in,
advertising fallback and separate entitlement enforcement remain unimplemented.

Next milestone: a local-only camera input adapter with explicit opt-in and visible
camera status, loss-of-tracking reset and stop/release behavior. Keep real-camera
validation distinct from the pointer simulation. No deployment in this milestone.

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
