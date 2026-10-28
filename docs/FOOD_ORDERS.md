# Staff food orders: foundation

Local implementation only; not deployed or ready for taking customer orders. The
first release is staff-operated and dine-in. Customer phone ordering is deferred.
This milestone adds three backend callables, not a POS interface or order screen.

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

`setFoodOrderStatus` allows assigned staff and owners to advance a versioned order:
new → preparing → ready → completed, with cancellation from any non-final stage.
It does not alter `paymentStatus`: all orders in this foundation remain `unpaid`.
Existing orders can be progressed after the trial ends to avoid abandoning active
work; new order creation requires active access. This is fulfilment status, not
proof of payment. An actual paid workflow must first define and verify payment
provider events and refunds, and must address cancellation of paid orders.

No tables, taxes, item options, receipts, staff UI, list/order retrieval, order board,
payment integration, refund, offline POS or customer-facing access is implemented.
Order creation does not charge a card or establish that money was received. Prices
are displayed totals; no GST or tax calculation is represented. Staff cannot use
these functions through the portal until a separate interface is built. Do not
deploy this foundation as a working commerce release.

Validation on 28 October 2026: all 231 tests in the local Firebase/backend suite
passed, including order access, server-calculated prices, concurrent retry, status
transitions, trial expiry and direct Firestore denial. No live data was used.

Remaining milestones include staff interface and authorised order retrieval,
concurrent-order handling, kitchen/order display with appropriate device scope,
verified Stripe payment and reconciliation, receipt/tax requirements, operational
controls and release review. The existing reference POS has placeholder terminal
integration and must not be assumed to prove payment success.
