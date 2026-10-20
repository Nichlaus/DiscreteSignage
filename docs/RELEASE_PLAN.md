# Release plan

## Agreed requirements

- Name: Discrete Signage.
- Build a new platform without modifying existing customer systems.
- Food stores first; reusable modules later support retail, salons, and gyms.
- Dine-in only in the first release: table QR/web ordering and in-store POS.
- Stripe customer payments in AUD; support additional providers through adapters.
- Explain that more payment options are planned and offer an integration request form.
- Software subscriptions and module prices remain undecided.
- A 14-day trial unlocks all features without a payment method.
- Disclose AI usage allowances; exact limits and trial-expiry behavior are undecided.
- Staff AI controls screens and creates images; customer-facing AI is in scope.
- Display orientation, fit, fill/crop, and stretch/Fit XY are configurable locally
  and remotely, with applied/pending/failed status.
- Preserve high-quality media and support device-appropriate playback.
- Initial hardware testing: Google TV Streamer and Android devices.
- Notifications: Android, iOS, desktop web, and in-app; actual delivery depends on
  platform support, permissions, and connectivity.
- Web/Android first; iOS last when Mac build/test access is available.
- Regular GitHub checkpoints, concise progress updates, and autonomous routine decisions.

## Bounded milestones

Completed: repository bootstrap and initial authorization model with 14 passing
emulator tests. Storage uploads and RTDB presence grants remain deferred until
their corresponding features; both currently deny all client access.
Completed next: authenticated business/location provisioning with server-owned
14-day trials and retry protection; combined suite has 21 passing tests.
Completed next: initial onboarding portal and staff invitation lifecycle.
Combined emulator suite has 25 passing tests; production web build passes.
Live signup awaits Firebase web/Auth/App Check configuration and deployment.
Next: connect and verify the live onboarding flow, then screen pairing.

1. Repository bootstrap, scope, reference audit, and default-deny configuration.
2. Local emulator tooling, tenant model, tested Firestore/Storage/RTDB authorization.
3. Authentication, business/location onboarding, and staff membership.
4. Screen pairing, device credentials, settings commands, acknowledgements.
5. Media library, schedules, cached playback, and device health dashboard.
6. Shared menu/catalogue, tables, dine-in orders, kitchen and collection views.
7. Merchant onboarding, Stripe web payments and Terminal, reconciliation and refunds.
8. Staff and customer AI with scoped tools, content generation, and usage accounting.
9. Notification routing, preferences, trials, and module entitlements.
10. Android integration and hardware acceptance tests; then iOS.

Dependencies may require small changes to this order. Every milestone should
state what shipped, how it was checked, and any remaining limitation.

## Reference inventory

| Source | Purpose | Inspection status |
| --- | --- | --- |
| `C:\xampp\htdocs\reutos` | Existing management site and backend | Structure and selected rules inspected |
| `C:\Users\charm\AndroidStudioProjects\ReutosCafe` | Android POS | Structure inspected |
| `C:\Users\charm\AndroidStudioProjects\ReutosDisplayApp` | Dedicated player | Structure inspected |
| `E:\Reutos Programming\Cafe order` | Ordering site | README, dependencies, and Firestore rules inspected |
| `C:\Users\charm\AndroidStudioProjects\ReutosSiteManagement` | Android WebView shell | WebView and manifest inspected |
| `https://github.com/Nichlaus/reutosIOS` | Flutter iOS shell | Selected Flutter sources inspected |

Reference code is not assumed secure or production-ready. Local reference rules
do not prove the currently deployed rules.

## Outstanding decisions

- Separate development Firebase project before shared environment testing.
- Trial allowances, expiry grace period, and operational behavior after expiry.
- Stripe account model and merchant onboarding configuration.
- Approved AI provider/model, costs, retention, and business knowledge sources.
- Exact supported hardware, cameras/microphones, and display resolutions.
- Production domain, app identifiers, email sender, and privacy/support details.
