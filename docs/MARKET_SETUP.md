# Business market setup

Implemented locally on 24 October 2026; not deployed.

Business owners can choose General signage, Food stall/cafe/restaurant, Retail,
Gym/fitness, Salon/services or Advertising operator from the workspace. The
shared catalogue supplies relevant signage guidance. Existing businesses default
to General without migration; onboarding requests retain their existing schema
and retry fingerprints. Owners select the type after creating their workspace.

The updateBusinessMarket callable accepts exactly businessId and market. Verified,
enabled Auth, App Check and active ownership are required. A transaction validates
membership and business existence, updates only market and writes an audit event
with the previous/new values. Repeating the current value does not write another
event. It does not grant features, modify trial dates, charge money or overwrite
playlists. It is allowed after trial expiry because this is descriptive metadata.
Staff can see guidance but cannot edit; platform MFA diagnostics show the type.
No Firestore client-write grants or new IAM permissions are introduced.

This milestone is a business profile and guidance foundation, not a menu editor,
POS, order queue, booking integration or AI implementation. Those remain planned.
General is also the fallback for unknown legacy values in the view.

Deploy the new updateBusinessMarket callable and updated getWorkspace and
getPlatformBusiness backends before Hosting. Run full Firebase postflight after
rollout; it now expects the new callable. Live owner-save/readback and admin
visibility acceptance remain pending. To correct a type, an owner saves another
selection in the same form; no database migration or rollback is required.

Validation: all 136 release tests passed across 26 files, including market owner,
manager, cross-business, unverified/disabled/device and revoked-owner checks,
strict input validation, retry behavior, trial preservation and workspace readback.
View tests cover unknown/legacy fallback and owner-only editing. The guarded
production build passed with 14 Hosting files. Local synthetic browser preview
verified food guidance and switching to advertising guidance; evidence is
artifacts/market-setup-preview.png (ignored). Not a live callable acceptance.
