import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenHealth, dashboardView, trialNotice } from '../web/dashboard.js';

test('stale, future, loading or errored reports cannot be presented as recently applied', () => {
  const now = 200000;
  const ready = { active: true, version: 2, appliedVersion: 2, deviceState: 'ready', reportedAt: now - 1000 };
  assert.equal(screenHealth(ready, now).kind, 'ready');
  for (const change of [{ reportedAt: now - 120000 }, { reportedAt: now + 6000 },
    { reportedAt: null }, { deviceState: 'error' }, { deviceState: 'downloading' },
    { appliedVersion: 1 }, { deviceState: null }]) {
    assert.equal(screenHealth({ ...ready, ...change }, now).kind, 'attention');
  }
  assert.equal(screenHealth({ ...ready, active: false }, now).kind, 'inactive');
});

test('trial notice distinguishes upcoming expiry from the exact expiry boundary', () => {
  const trialEndsAt = Date.UTC(2026, 10, 3, 12);
  const workspace = { role: 'owner', trialEndsAt };
  assert.match(trialNotice(workspace, trialEndsAt - 1, String), /Less than a day/);
  assert.match(trialNotice(workspace, trialEndsAt, String), /Your trial has ended/);
  assert.match(trialNotice(workspace, trialEndsAt + 1, String), /Your trial has ended/);
  assert.match(trialNotice(workspace, trialEndsAt - 2 * 86400000, String), /2 days remaining/);
  assert.match(trialNotice(workspace, trialEndsAt - 86400000, String), /1 day remaining/);
  assert.equal(trialNotice({ role: 'owner', trialEndsAt: null }, trialEndsAt, String), '');
  assert.match(trialNotice({ ...workspace, role: 'staff' }, trialEndsAt, String), /Ask your business owner/);
});

test('scoped staff overview omits owner shortcuts and revoked screens from attention', () => {
  const html = dashboardView({ role: 'staff', locations: [], screens: [{ id: 'old', name: 'Revoked screen', active: false }] }, 200000, String);
  assert.ok(!html.includes('href="#media-section"'));
  assert.ok(!html.includes('href="#reports-section"'));
  assert.ok(!html.includes('Revoked screen'));
  assert.ok(html.includes('Ask the owner'));
});
