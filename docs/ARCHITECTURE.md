# Architecture direction

This is a proposed implementation direction, not an implemented system.

## Shared platform

Use a modular backend and shared typed contracts for the management web app,
customer ordering app, POS, and player. Avoid microservices initially.
Keep provider integrations behind narrow interfaces.

Firestore is proposed for durable business state. Use RTDB only where justified
for presence; the provided Firebase URL confirms an RTDB instance, not that
Firestore, Storage, Authentication, or billing are configured.
Use Storage for media. Verify service availability and region choices before deployment.

## Ownership

Durable business data lives beneath `businesses/{businessId}` with explicit
location ownership. Membership and device credentials determine access; a
client-supplied business ID alone never does. Server-controlled documents store
roles, entitlements, trial dates, payment state, and audit events.

Public menus are separate projections containing only approved public fields.
Guest ordering uses narrow backend endpoints and scoped order access, not
anonymous collection-wide reads. Public collection boards expose order numbers
and status without customer contact information.

## Device lifecycle

Pair devices through expiring, single-use codes approved by an authorised user.
Issue revocable device identities scoped to a business and location.
Settings carry versions; commands carry IDs and expiry times. Devices acknowledge
applied versions and errors. Retry safely without applying an action twice.
Push is a wake-up hint; persisted authenticated state is authoritative.

Download and verify media before switching active content. Retain a last-known
working playlist. Treat cached live order data as stale when disconnected.
Hardware capability checks determine playback and peripheral options.

## Commerce

All order channels use one catalogue and order model. The backend calculates
totals from trusted prices and validates availability. Payment provider events
are signature-verified, deduplicated, and reconciled against stored orders.
Payment and preparation states are separate. External-terminal payments require
an explicit authorised reconciliation flow, not an invented provider success.

## AI and notifications

Staff and customer AI use different tool permissions. Authorize every tool call
on the backend. Customer AI cannot change prices, grant access, or mark payments
successful. Keep business knowledge scoped and treat retrieved content as data.

Notifications use business events, recipient permissions, preferences, and
deduplication. Recheck permissions when actions execute. Store minimal content
in push messages, particularly on lock screens.
