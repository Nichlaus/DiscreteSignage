# Food menu management

Deployed and live-tested on 24 October 2026. Owners can open a menu by
location, add/rename categories, add/edit items and choose Available or Sold out.
Each Add/Save persists that change and refreshes the portal preview. Unsubmitted
form fields are not saved. Switching locations requires Open menu, and clears the
previous editor. The menu remains available regardless of business-type guidance.

The preview shows category order, item names/descriptions, AUD prices and sold-out
labels. It does not publish to screens, create orders or calculate tax/payments.
Screen publishing, images, sizes/extras, scheduled availability, reordering,
archiving/removal and menu revision history are later work. No delete control is
introduced in this milestone. Use Sold out for temporary unavailability.

## Storage and authorization

One document per location: businesses/{businessId}/locations/{locationId}/menus/current.
Maximum 20 categories, 100 items, names 80/100 characters, descriptions 300.
Every item references an existing category. IDs are unique within each list.
AUD is server-owned; priceCents is a whole number from 0 to 999999. The UI parses
decimal strings without floating-point rounding; zero is an allowed displayed price.
Availability is a boolean. Inputs reject extra fields and control characters.

getFoodMenu and saveFoodMenu use verified enabled Auth, App Check and active owner
membership. The location must exist in that business. Reads remain available after
trial expiry; writes require the active screens trial. Business type is not an
entitlement. Direct Firestore access remains denied, including for owners/devices.
No rule grants, IAM changes or additional indexes are required.

Writes compare expectedVersion in a transaction. Conflicting stale changes fail
with a reload message; retrying identical current content is a no-op. Audit events
record actor, location, version and counts, without duplicating menu descriptions.
Concurrent writes cannot silently overwrite a newer version. Audit entries are
not full historical snapshots and cannot undo a previous menu edit.

## Deployment and operation

Deploy platform:getFoodMenu and platform:saveFoodMenu before Hosting, then run
firebase-postflight.mjs (now expects both callables). Live acceptance should use a
clearly labelled test location: add category/item, save exact price, edit Sold out,
reload and compare another location. No existing screen should change.

On a stale-edit error, preserve any intended text separately, reopen the location
menu and reapply after reviewing the current version. Network/save errors leave
current form fields available for correction/retry. Do not bypass authorization
or edit menu documents directly as a routine support step.

Developer-admin menu diagnostics/editing are not implemented. Record them as
follow-up: location, saved version, counts, last update and validation errors;
any future repair must use explicit authorization, version checks and audit.

## Local acceptance — 24 October 2026

All 142 release tests across 28 files passed, including menu ownership, tenant and
location isolation, verified/disabled/device/revoked access, invalid fields/prices,
exact cents, stale edits, idempotent retry, trial preservation and direct-rule denials.
Initial run exposed menu fixture cleanup leaking into an unrelated provisioning
test; cleanup was fixed and the full suite rerun successfully. Guarded production
build passed (14 Hosting files). Emulators stopped after the run.

Synthetic browser acceptance used the actual editor with an in-memory test service:
created Meals, added Chicken burger at $12.50, edited Sold out, checked preview,
switched to an empty second location and back to the retained first menu. This
checks UI behavior, not live Firebase calls. Evidence: artifacts/food-menu-preview.png
and artifacts/food-menu-tests.log (local, ignored). Deployment and live owner
save/readback remain pending. No real menus, devices or customer records changed.

## Live deployment acceptance — 24 October 2026

Deployed 9d787df: platform:getFoodMenu and platform:saveFoodMenu completed before
Hosting was released. Guarded build checked 14 files. Full firebase-postflight
passed, including unauthenticated rejection for both new callables, security
configuration, live entry-asset matching and Hosting headers.

Owner signed back into the Codex browser. Test Cafe / blacktown loaded an empty
menu at version 0. Created Test meals — acceptance (v1), then TEST Chicken burger
with description Synthetic acceptance item — not for sale at AUD 12.50 (v2).
Edited price to AUD 10.99 and availability to Sold out (v3); renamed the category
TEST Menu acceptance (v4). Preview showed the exact cents and sold-out label.
Reloaded the portal and reopened blacktown: version 4, renamed category, item,
description, AUD 10.99 and Sold out all persisted. Screenshot confirms readable
preview at the narrow browser width.

Retained one clearly labelled synthetic category/item, sold out. No pre-existing
menu was overwritten; no media uploads, device grants or screen edits occurred.
No second location was created; cross-location behavior and stale-edit rejection
remain covered by local acceptance/tests, not newly exercised live. Admin menu
diagnostics, publishing and removal remain planned. Evidence: artifacts/food-menu-live.png
and artifacts/food-menu-postflight.log (local, ignored).
