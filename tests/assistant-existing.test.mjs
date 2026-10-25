import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existingPlaylistPlan } from '../web/assistant-existing.js';

test('existing playlist retains order, duration and overnight days without mutation', () => {
  const schedule = { days: [5, 1], start: '22:00', end: '02:00' };
  const screen = { playlist: [{ mediaId: 'video', duration: 22, schedule },
    { mediaId: 'image', duration: 22, schedule: { ...schedule, days: [1, 5] } }] };
  const before = structuredClone(screen);
  assert.deepEqual(existingPlaylistPlan(screen, ['image', 'video']), {
    ids: ['video', 'image'], duration: 22, schedule,
  });
  assert.deepEqual(screen, before);
});

test('all-day and legacy single-image playlists load without inventing a schedule', () => {
  assert.deepEqual(existingPlaylistPlan({ mediaId: 'image' }, ['image']), { ids: ['image'], duration: 10, schedule: null });
  assert.deepEqual(existingPlaylistPlan({ playlist: [{ mediaId: 'image', duration: 30 }] }, ['image']),
    { ids: ['image'], duration: 30, schedule: null });
  assert.match(existingPlaylistPlan({ playlist: [], mediaId: 'image' }, ['image']).error, /no Playlist/);
});

test('unsupported playlists are rejected as a whole instead of silently dropping details', () => {
  const item = { mediaId: 'image', duration: 15 };
  for (const playlist of [
    [item, item], [item, { mediaId: 'other', duration: 20 }],
    [item, { mediaId: 'other', duration: 15, schedule: { days: [1], start: '09:00', end: '17:00' } }],
  ]) assert.ok(existingPlaylistPlan({ playlist }, ['image', 'other']).error);
  assert.match(existingPlaylistPlan({ playlist: [item] }, []).error, /unavailable/);
});

test('shared campaign dates are preserved when reusing a playlist', () => {
  const schedule = { days: [1], start: '22:00', end: '02:00', startDate: '2026-10-25', endDate: '2026-10-30' };
  const item = { mediaId: 'image', duration: 15, schedule };
  assert.deepEqual(existingPlaylistPlan({ playlist: [item] }, ['image']).schedule, schedule);
  assert.ok(existingPlaylistPlan({ playlist: [item, { ...item, mediaId: 'other', schedule: { ...schedule, endDate: '2026-10-31' } }] }, ['image', 'other']).error);
});
