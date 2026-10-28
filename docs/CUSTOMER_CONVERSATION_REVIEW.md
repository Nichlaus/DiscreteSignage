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

## Expanded review — 28 October 2026

The repeatable synthetic provider set is `scripts/conversation-evaluation.mjs`.
It calls the provider directly, incurs charges, bypasses application usage counters,
and needs a key supplied privately in the environment. Use only invented data and
have a person review every response against the printed criteria; a completed API
call does not establish correctness. It must not be run automatically on production
customer data. Record model, date, outcomes and failures when rerunning, particularly
after changing models, prompts or moderation. One sample per case is not a reliability
measurement.

In one run with `gpt-4o-mini`, 14 of 16 synthetic cases met their stated criteria:
two prices, ambiguous products, two multi-turn cases, allergy and health questions,
discount, unavailable item, two injections, card-details request, a child question
and Spanish. The missing-hours answer did not invent hours but failed to refer to
staff as required. The abusive-input case returned unavailable or was declined;
the evaluation intentionally does not distinguish a moderation decline from a
provider failure, so this case was inconclusive. Prompt compliance remains
probabilistic. These observations are not a customer-release approval.

The automated backend tests also cover malformed moderation, provider errors,
refusal, incomplete output, timeouts, withdrawn products and expired leases.
They exercise mocked failures, not provider reliability or on-device accessibility.

### Privacy assessment and release gates

The text and recent history may contain unsolicited personal or sensitive data
despite the warning. Public screens and third-party keyboards can expose text to
people nearby or the keyboard provider; the app cannot guarantee keyboard privacy.
The provider receives approved product data as well as the question and history.
Do not make claims about a customer's data residency or zero retention without
checking this specific OpenAI project's settings and contractual terms. OpenAI's
published defaults list Responses abuse monitoring retention of 30 days, with
exceptions and account-specific controls; the moderation endpoint is listed
separately. `store: false` is not a promise of zero retention.

Before a pilot, the operator must identify the responsible legal entity and contact,
confirm actual provider retention, locations and terms, and have an appropriate
Australian privacy review of a project-specific notice and policy, cross-border
disclosure, children, unsolicited sensitive information, incident handling and
access/deletion requests. Define staff escalation and make the final notice and
contact path available before collecting text. Review the separate camera feature
and its notices independently. Do not represent this technical review as legal
approval. Keep the global conversation switch off until these checks and an
adequate human-reviewed quality evaluation are complete.

Sources: [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data),
[OpenAI safety practices](https://developers.openai.com/api/docs/guides/safety-best-practices),
[OpenAI evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices),
and [OAIC AI privacy guidance](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/guidance-on-privacy-and-the-use-of-commercially-available-ai-products).

### Spending configuration

The owner selected USD 50 per month for the OpenAI project on 28 October 2026.
This is a target only: it has not been verified or applied to the OpenAI account.
Existing request limits are independent of OpenAI billing and do not enforce a
dollar cap. To apply the target, an authorised project owner should open OpenAI
Platform > project settings > Limits > Spend, enter USD 50 as the monthly spend
limit, enable **Enforce a hard limit**, save and verify the setting. Add spend
alerts before the limit (for example at 50% and 80%) and verify recipients and
delivery. Confirm the selected project is the one used by the Firebase key first.
OpenAI documents that enforcement is not instantaneous and spend may exceed the
limit slightly. A project-wide limit affects every feature billed to that project,
including advert creation and the portal assistant, and may interrupt them; review
existing project and organisation limits first. Do not lower an existing stricter
limit without understanding its scope. The currency here is USD, not AUD.

The admin can disable customer conversation through the existing global switch;
screen owners can disable it per screen. A project limit reached at OpenAI can
also interrupt the other AI features. Check the provider's usage, limits, and
credit balance before changing limits; do not expose API keys or customer text in
support tickets. Normal signage should remain independent of AI availability.
See [OpenAI spend limits](https://developers.openai.com/api/docs/guides/spend-limits).
