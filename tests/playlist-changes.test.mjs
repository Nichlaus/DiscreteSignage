import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playlistChanges } from '../web/playlist-changes.js';
const item = (mediaId, duration = 15, schedule) => ({ mediaId, duration, ...(schedule ? { schedule } : {}) });
test('additions and removals do not falsely report reordering', () => {
  const result = playlistChanges([item('a'), item('b')], [item('new'), item('b')]);
  assert.deepEqual(result.added.map(x => x.item.mediaId), ['new']);
  assert.deepEqual(result.removed.map(x => x.item.mediaId), ['a']);
  assert.equal(result.reordered, false);
  assert.equal(playlistChanges([item('a'), item('b')], [item('b'), item('a')]).reordered, true);
});
test('schedule comparison normalizes weekday order but detects overnight dates and duration changes', () => {
  const schedule = { days: [1, 2], start: '22:00', end: '02:00', startDate: '2026-10-26', endDate: '2026-11-02' };
  assert.equal(playlistChanges([item('a', 15, schedule)], [item('a', 15, { ...schedule, days: [2, 1] })]).changed.length, 0);
  const result = playlistChanges([item('a', 15, schedule)], [item('a', 30, { ...schedule, endDate: '2026-11-03' })]);
  assert.equal(result.changed[0].scheduleChanged, true); assert.equal(result.changed[0].durationChanged, true);
  assert.equal(playlistChanges([item('a', 15, schedule)], [item('a')]).changed[0].scheduleChanged, true);
});
test('repeated media are matched once per occurrence', () => {
  const result = playlistChanges([item('a', 10), item('a', 20)], [item('a', 10)]);
  assert.equal(result.removed.length, 1); assert.equal(result.removed[0].item.duration, 20);
  assert.equal(result.changed.length, 0);
});
