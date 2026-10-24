import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupGuide } from '../web/setup-guide.js';
import { bindDashboard } from '../web/dashboard.js';

test('first-screen guide is owner-only and opens only for an active trial without active screens', () => {
  const owner = { role: 'owner', trialEndsAt: 2000, screens: [{ active: false }] };
  assert.match(setupGuide(owner, 1000), /class="setup-guide" open/);
  assert.doesNotMatch(setupGuide({ ...owner, screens: [{ active: true }] }, 1000), /class="setup-guide" open/);
  assert.doesNotMatch(setupGuide(owner, 2000), /class="setup-guide" open/);
  for (const role of ['staff', 'manager']) assert.equal(setupGuide({ ...owner, role }, 1000), '');
});

test('pairing shortcut opens its disclosure and focuses the summary', () => {
  let clicked;
  let focused = false;
  const target = { open: false, querySelector: () => ({ focus: () => { focused = true; } }) };
  const previous = globalThis.document;
  globalThis.document = { getElementById: id => id === 'pair-display' ? target : null };
  try {
    bindDashboard({ querySelectorAll: () => [{ hash: '#pair-display', addEventListener: (_, fn) => { clicked = fn; } }] });
    clicked();
    assert.equal(target.open, true);
    assert.equal(focused, true);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
