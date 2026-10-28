# Customer conversation: pilot review

## Scope and data

The planned experience is an optional public text dialog on a paired Android
display. The business owner opts in for each screen; the platform-wide switch is
off by default. The customer sees a notice before sending a question. The notice
warns against entering personal information and explains that OpenAI receives the
question, up to three previous exchanges and approved product facts. OpenAI may
retain content for safety monitoring; `store: false` does not prove zero retention.
The app keeps conversation turns in memory for the active session and does not
write them to its database. Usage counters and platform audits do not include text.
The Android keyboard is asked not to learn from this field, but third-party keyboard
behavior is outside this app's control. No camera or microphone is used for the text
conversation. Advertising can continue underneath.

OpenAI documents default abuse-monitoring retention of up to 30 days, subject to
exceptions and account-specific controls. The account's actual retention controls,
data processing locations, provider terms, published privacy policy, business
owner obligations and escalation process must be confirmed before customer rollout.
Australian privacy obligations depend on the circumstances; the OAIC's guidance on
collection and overseas disclosure should inform a qualified review. A notice and
this engineering review alone do not establish legal compliance.

Sources: https://developers.openai.com/api/docs/guides/your-data and
https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-8-app-8-cross-border-disclosure-of-personal-information

## Synthetic provider review — 28 October 2026

Six synthetic prompts were sent to the configured OpenAI text and moderation APIs
using a synthetic iced coffee priced at AUD 5.25. The answer gave the correct price;
for an allergy it directed the visitor to staff without claiming ingredients; it
did not invent closing hours or a discount; it resisted a prompt requesting a free
price; and it declined to save a hypothetical credit-card number. The inputs and
outputs contained no actual customer details. This is a small manual smoke test,
not evidence of comprehensive safety, factuality, privacy or model reliability.
Responses may change; moderation does not check product truth or prevent all abuse.

Live paired emulator acceptance used the existing synthetic product and two
questions. The notice appeared before submission; the price response said $5.25,
and the allergy follow-up directed the visitor to staff without an ingredient claim.
The administrator turned off the global switch and the conversation disappeared on
the next device refresh. The synthetic product was marked unavailable, the test
screen revoked and its debug registration removed. These two additional checks do
not substitute for the broader evaluation below or physical-device acceptance.

Before enabling customer access, evaluate multi-turn and product-name ambiguity,
allergen/medical claims, invented availability and discounts, prompt injection,
personal-data attempts, children, abusive content, different languages, failed or
slow moderation, product withdrawal and device revocation. Have a person assess
outputs against known facts and record failures without real customer data. Verify
the notice and contact path on the final customer interface. Keep the service off
if the provider or safety checks are unavailable.

## Operations

The platform administrator can control a global switch and request-count limits;
these are not dollar caps. Configure and monitor the OpenAI project spending limit
separately. Per-business daily and lifetime request caps, a global daily cap, and
per-device cooldown and in-flight limits apply. Failures count toward usage. The
switch is checked before and after the provider call. An individual business owner
still controls opt-in for each screen. Document support ownership and emergency
disable procedures before a pilot. Physical camera/device testing remains separate.
