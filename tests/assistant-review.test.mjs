import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assistantReview, bindAssistantReview } from '../web/assistant-review.js';
const draft = { kind: 'playlist', screenName: '<script>bad</script>', timezone: 'Australia/Sydney',
  media: [{ id: 'image', name: '<img src=x onerror=bad>', type: 'image' }], before: [],
  settings: { expectedVersion: 4, playlist: [{ mediaId: 'image', duration: 15,
    schedule: { days: [6], start: '22:00', end: '02:00', startDate: '2026-11-01', endDate: '2026-11-30' } }] } };
test('review escapes untrusted text and spells out replacement, timezone and overnight dates', () => {
  const html = assistantReview(draft);
  assert.ok(!html.includes('<script>') && !html.includes('<img src='));
  for (const text of ['Nothing has changed yet', 'Australia/Sydney', 'Saturday', 'overnight', '2026-11-30', 'Menu snapshots', 'Approve and save']) assert.ok(html.includes(text));
  assert.ok(!assistantReview({ kind: 'clarification', message: '<script>bad</script>' }).includes('data-approve'));
});
test('review never saves until explicit approval and prevents double-submit/retry', async () => {
  const approve = {}, discard = {}, status = {};
  const container = { innerHTML: '', querySelector: selector => selector.includes('approve') ? approve : selector.includes('discard') ? discard : status,
    replaceChildren() { this.innerHTML = ''; } };
  let calls = 0, received;
  bindAssistantReview(container, draft, async (name, data) => { calls++; received = data; assert.equal(name, 'updateScreenSettings'); });
  assert.equal(calls, 0);
  await approve.onclick(); await approve.onclick();
  assert.equal(calls, 1); assert.equal(received.expectedVersion, 4);
  assert.match(status.textContent, /Playlist saved/);
  discard.onclick(); assert.equal(container.innerHTML, '');
});
