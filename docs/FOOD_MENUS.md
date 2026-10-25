# Food menu management

Deployed and live-tested on 24 October 2026. Owners can open a menu by
location, add/rename categories, add/edit items and choose Available or Sold out.
Each Add/Save persists that change and refreshes the portal preview. Unsubmitted
form fields are not saved. Switching locations requires Open menu, and clears the
previous editor. The menu remains available regardless of business-type guidance.

The preview shows category order, item names/descriptions, AUD prices and sold-out
labels. It does not publish to screens, create orders or calculate tax/payments.
Screen publishing is implemented locally in the checkpoint below, pending deployment.
Item photos, sizes/extras, scheduled availability, reordering,
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

## Menu publishing checkpoint — 25 October 2026

Implemented locally, not deployed. After opening a location menu, owners can find
its active screens, choose full screen or left/right/top/bottom, preview pages and
publish the saved version. Text-only PNG pages are rendered at the logical region
size (1920x1080 landscape / 1080x1920 portrait, halved for splits). Categories,
item names, AUD prices and Sold out are included; descriptions remain portal-only.
Names wrap, oversized rows or more than 20 pages are rejected instead of silently
truncated. Pages play for 15 seconds each. These are snapshots: edits require
republishing and existing downloaded pages can remain within their playback lease.

Publishing uses existing begin/authorize/complete/validate media calls followed by
updateScreenSettings. All pages must validate before screen assignment. No new
backend route, rules, IAM or native renderer is required. Ready image bytes use the
same signed manifests, Android caching and revoked-device protections as adverts.
Compatibility follows the image pipeline design; this milestone has not performed
live or Android acceptance of generated menu pages.

The selected region is replaced. For a newly split single-screen playlist, existing
adverts move to the other region. For an existing split, its other playlist stays.
Full screen clears the secondary playlist. Fit scaling applies to both regions;
orientation, transitions and logo remain. Existing logos may obscure menu text:
check the real screen and adjust the overlay through normal screen settings.
Schedules on preserved adverts remain unchanged; menu pages are unscheduled.

Menu version is rechecked before preparation and publication. Screen changes use
the fetched expected version, so concurrent settings changes fail instead of being
overwritten. A menu edit after the final version check does not mutate the chosen
snapshot. Retry within the current preview retains reservation IDs and uploaded/
validated-page state. Refreshing/repreparing loses that in-memory retry state.
Failures can leave private library entries and consume the existing allowance;
no automatic file deletion is attempted. Screen assignment remains atomic.

Five focused publishing/menu tests and guarded production build passed. Synthetic
browser test rendered a one-page right menu and a five-page bottom menu; mocked
upload/validation/assignment preserved the original advert in the top region.
Evidence: artifacts/menu-publish-preview.png (local, ignored). Backend security
remains covered by the earlier 142-test baseline; new tests cover region planning,
all-pages-ready gating, validation failure and upload retry after a lost response.
Hosting deployment and approved synthetic live upload/device acceptance are next.

## Menu publishing live acceptance — 25 October 2026

Deployed 3c2a7e1 to Hosting. Guarded build checked 14 files, five focused tests
passed again, and the full Firebase postflight passed, including exact live entry
assets, authorization rejection checks and existing security configuration.

With user approval, paired Menu publishing acceptance at Test Cafe / blacktown
(d_f47028f33c82bd47c60c9bbbbfec8ab1). Assigned existing video-fixture.mp4, then
opened saved menu v4 and published one previewed page to the right. The generated
PNG passed validation before assignment; library reference bf63762a is Ready for
screens (0.04 MiB). The browser player visibly retained the moving synthetic video
on the left and showed TEST Chicken burger, AUD $10.99 and Sold out on the right.
Portal status confirmed Applied. Fit scaling correctly letterboxed the wide video
inside its half-screen region. Evidence: artifacts/menu-publish-live.png and
artifacts/menu-publish-postflight.log (local, ignored).

Revoked the temporary screen through the owner portal; it reports Revoked and no
active displays remain. The labelled menu page remains private in the test library
as approved. No menu edits, existing screen changes, rules or IAM changes occurred.
This verifies live browser playback; physical Android and multi-page live playback
remain untested in this milestone. Saved menus still require explicit republishing
after edits; generated images are snapshots, not a live menu feed.
