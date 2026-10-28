# Staff food orders: foundation

Local implementation only; not deployed or ready for taking customer orders. The
first release is staff-operated and dine-in. Customer phone ordering is deferred.
The current local preview includes staff ordering and order-list controls. It is
not a finished POS or customer-facing order screen.

`getPosMenu` and `createFoodOrder` require verified, enabled user authentication,
App Check, live owner membership or active staff/manager assignment for the requested
location, an existing business/location, and the active `orders` trial entitlement.
Menu data is obtained from the location's server-owned menu. The create request
contains a menu version, distinct item IDs and bounded quantities only: no client
price, payment state or total is accepted. The server rejects stale menus and sold-out
items, snapshots names and AUD cent prices, and calculates the total. The request ID
is scoped to the staff user and location; concurrent identical retries create one
order, while reuse with different content is rejected. Creating an order and its
minimal audit entry is transactional. Direct Firestore access is denied.

`listFoodOrders` returns a bounded, paginated list for the authorised location,
including after trial expiry. It excludes internal request fingerprints and actor
IDs. Refresh the list to see changes made by other staff; this is not a live feed.
`setFoodOrderStatus` allows assigned staff and owners to advance a versioned order:
new → preparing → ready → completed, with cancellation from any non-final stage.
It does not alter `paymentStatus`: all orders in this foundation remain `unpaid`.
Existing orders can be progressed after the trial ends to avoid abandoning active
work; new order creation requires active access. This is fulfilment status, not
proof of payment. An actual paid workflow must first define and verify payment
provider events and refunds, and must address cancellation of paid orders.

The local staff preview opens a location menu, chooses quantities, creates an unpaid
order, loads older orders and advances or cancels their fulfilment. An uncertain
create request is retained in browser local storage scoped to user, business and
location, containing item IDs, quantities, menu version and a request ID, not card
or customer information. The operator can retry it or check and close the request.
`resolveFoodOrderRequest` atomically returns an already-created order or writes a
tombstone that prevents a delayed request from creating one later. The browser only
clears its retry record after a confirmed outcome. Clearing browser storage or using
another device can lose this recovery context; confirm recent orders before re-entry.
The preview does not synchronize carts or enforce a single operator across tabs.

No tables, taxes, item options, receipts, customer order board,
payment integration, refund, offline POS or customer-facing access is implemented.
Order creation does not charge a card or establish that money was received. Prices
are displayed totals; no GST or tax calculation is represented. Do not deploy
this preview as a working commerce release.

Validation on 28 October 2026: all 231 tests in the local Firebase/backend suite
passed, including order access, server-calculated prices, concurrent retry, status
transitions, trial expiry and direct Firestore denial. No live data was used.
The subsequent staff preview milestone passed 234 local Firebase/backend tests,
including pagination and retry-resolution races, plus a portal production build.
Only the initial view's escaping and unpaid notice received a standalone UI test;
visual and interactive browser acceptance remains outstanding because the browser
control service failed to start. No production deployment or customer data was used.

Remaining milestones include visual and usability acceptance, production-safe
deployment, kitchen/order display with appropriate device scope,
verified Stripe payment and reconciliation, receipt/tax requirements, operational
controls and release review. The existing reference POS has placeholder terminal
integration and must not be assumed to prove payment success.
