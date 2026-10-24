# First-time operator acceptance

Prepared 24 October 2026. **Not run: no operator available.** This checks whether
someone can use the signage portal without developer help. Existing emulator and
developer-led browser checks do not satisfy this gate.

## Arrange the session

- Recruit someone unfamiliar with the portal. If the founder runs it, record it
  as a new-account rehearsal, not independent usability acceptance.
- Use an email the operator controls that has never created a business. They
  enter their own password and verification codes; do not record either.
- Use a separate browser profile so the existing owner's session is preserved.
  The observer should not need access to the mailbox or password manager.
- Agree a clearly labelled test business and location, in Australia, with the
  correct local time zone. Creating it starts a real 14-day trial with no card.
- Have a second browser window or Android display ready. Browser playback is
  sufficient for this session; it does not replace physical Android acceptance.
- Provide a non-personal JPEG, PNG or WebP under 20 MiB with a clearly visible
  word or shape. Keep it in the test business only. Do not use customer adverts.
- Agree that the test business/account and uploaded image will remain after the
  session; no business deletion flow is being promised. Revoke the test screen
  at the end. Never use production customer screens for the exercise.

Allow about 30 minutes; this is a session budget, not a measured onboarding time.
The operator performs account creation, verification, upload and pairing themselves.
An agent operating those steps must follow its applicable credential, upload and
device-access approval requirements.

## Give the operator only this task brief

> Open https://discretesignage.web.app and set up your test business. Get the
> supplied image playing on your test screen. Use the help on the site as needed.
> Tell us when you believe it is working, then explain what happens when the trial
> ends and when the screen loses internet. Finally, disconnect the test screen
> from your business using the portal. Please say aloud anything confusing.

The observer keeps the checklist below out of view initially. Do not coach the
click sequence. If the operator asks for help, record the exact obstacle and help
given; continue the session, but mark that task assisted. Stop for unexpected
customer data, access to another business, or an unintended account/device grant.

## Observer checklist

Record each row as unassisted pass, assisted, failed or not tested. Record actual
start/end times and pauses separately; do not count mailbox delay as UI effort.

| Task | Acceptance evidence | Result / elapsed time / help |
| --- | --- | --- |
| Understand the offer | Identifies signage as available, POS/ordering/AI as later; no card required | Not tested |
| Create and verify account | Finds password guidance, receives verification email, returns and proceeds; no credentials captured | Not tested |
| Create business | Correct business/location and time zone; trial end displayed; no duplicate setup after refresh | Not tested |
| Find first-screen guide | Uses built-in guide or navigation without observer directions | Not tested |
| Connect test screen | Correct location/name; display leaves pairing state | Not tested |
| Prepare media | Upload completes; operator finds validation and waits for Ready for screens | Not tested |
| Choose and save media | Finds screen settings, chooses correct file/reference, saves a one-item playlist | Not tested |
| Confirm playback | Visually sees the supplied image; distinguishes Applied from proof of visible playback | Not tested |
| Return to workspace | Refreshes or signs out/in and finds the same business, screen and saved playlist | Not tested |
| Explain limits | Finds trial end/no automatic charge and relevant browser/Android offline and restart guidance | Not tested |
| End test access | Revokes only the test screen; confirms it stops playing and cannot resume its old pairing | Not tested |

Ask after the tasks: What was hardest? Which words were unclear? What did you
expect to happen differently? What would you do if the screen stayed blank?
Keep answers in their own words; avoid suggesting the desired answer.

## Record the outcome

Record date/time with zone, deployed commit, browser/OS and viewport, display type,
prior experience, test business/screen references, each task result and any visible
error. Use minimal redacted screenshots: no passwords, verification links,
authenticator codes, pairing codes, tokens or mailbox contents in evidence or Git.
Do not put personal email addresses into the public acceptance report.

An unassisted completion of the core account-to-visible-image flow is the pass
criterion for this session. Account/validation/pairing dead ends, wrong-business
access or failure to revoke are blockers. Confusing copy and assisted tasks become
specific issues with reproduction steps; retest the affected task after fixing it.
One successful operator is pilot evidence, not broad usability or accessibility proof.

Record final screen revocation, retained test records, outstanding issues and the
observer's recommendation in SIGNAGE_RELEASE.md. A stalled session remains pending
or failed with the reason; do not turn not-tested rows into passes. Physical-device
quality, full accessibility review, cloud recovery and paid-plan decisions stay
separate release gates.
