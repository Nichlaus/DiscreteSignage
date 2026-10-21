# Workspace overview

Implemented locally on 2026-10-21; not deployed. Hosting-only change, using the
existing authorized workspace response. No new backend calls, rules or IAM grants.

The overview shows active screens, recently applied screens, screens needing
attention and visible locations. Revoked screens do not contribute to active counts.
Owner shortcuts lead to screens, library and reports; staff see only the screens
shortcut and their existing assigned-location scope. Attention links expand and focus
the corresponding screen's settings. Trial days are rounded up from the fetched
trial end, with an ended-state message; no subscription/payment promise is added.

A screen is Applied only when active, reporting ready within two minutes, and
acknowledging the current settings version. Missing/stale reports, more-than-five-
second future timestamps, errors, downloading and pending versions need attention.
The same classifier is used in the settings summary. This is a timestamped snapshot,
not live presence or proof that a physical screen is visible. Refresh overview uses
the existing workspace refresh action. There is no background polling or automatic
form replacement. As with Refresh screen status, an explicit refresh reloads forms;
save edits before using it.

Validation: two targeted tests passed for stale/future/error/loading/pending status
and scoped staff presentation; production build passed. Desktop and 390px browser
previews showed no horizontal overflow; attention link opened the correct details.
Synthetic local screenshot: `artifacts/dashboard-preview.png`. The backend/rules
are unchanged, so the previous 71-test security run was not repeated for this UI-only
milestone. The two tests are included in the full runner for subsequent releases.

Next: deploy Hosting and verify the live workspace overview, shortcuts and refresh.
The developer admin portal remains a separate planned feature.
