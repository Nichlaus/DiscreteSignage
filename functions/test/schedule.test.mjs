import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedule, scheduledRegions } from '../src/schedule.js';
import { playlist } from '../src/playlist.js';

const slot = { mediaId: 'advert', duration: 10, schedule: { days: [1], start: '09:00', end: '17:00' } };
const eligible = (iso, value = slot, zone = 'Australia/Sydney') =>
  scheduledRegions([[value]], zone, Date.parse(iso));

test('weekly schedules validate strictly and preserve unscheduled playlist compatibility', () => {
  for (const value of [null, {}, { ...slot.schedule, days: [] }, { ...slot.schedule, days: [1, 1] },
    { ...slot.schedule, days: [7] }, { ...slot.schedule, start: '9:00' },
    { ...slot.schedule, end: '24:00' }, { ...slot.schedule, end: '09:00' },
    { ...slot.schedule, timezone: 'UTC' }]) assert.throws(() => schedule(value));
  assert.deepEqual(playlist([{ mediaId: 'advert', duration: 10 }]), [{ mediaId: 'advert', duration: 10 }]);
  assert.deepEqual(playlist([slot]), [slot]);
  assert.throws(() => playlist([{ ...slot, schedule: null }]));
  assert.throws(() => scheduledRegions([[slot]], undefined, Date.now()));
});

test('inclusive starts, exclusive ends and signed lease cutoff use location time', () => {
  assert.equal(eligible('2026-10-18T21:59:40Z').regions[0].length, 0);
  assert.equal(eligible('2026-10-18T22:00:00Z').regions[0].length, 1);
  const end = eligible('2026-10-19T05:59:40Z');
  assert.equal(end.expiresAt, Date.parse('2026-10-19T06:00:00Z'));
  assert.equal(eligible('2026-10-19T06:00:00Z').regions[0].length, 0);
  assert.equal(eligible('2026-10-19T22:00:00Z').regions[0].length, 0);
});

test('overnight windows wrap Sunday into Monday without enabling Monday night', () => {
  const overnight = { ...slot, schedule: { days: [0], start: '22:00', end: '02:00' } };
  assert.equal(eligible('2026-10-18T14:00:00Z', overnight).regions[0].length, 1);
  assert.equal(eligible('2026-10-18T15:00:00Z', overnight).regions[0].length, 0);
  assert.equal(eligible('2026-10-19T12:00:00Z', overnight).regions[0].length, 0);
});

test('DST skips nonexistent hours and repeats wall-clock slots on fall-back', () => {
  const sunday = { ...slot, schedule: { days: [0], start: '02:00', end: '03:00' } };
  assert.equal(eligible('2026-10-03T15:59:00Z', sunday).regions[0].length, 0);
  assert.equal(eligible('2026-10-03T16:00:00Z', sunday).regions[0].length, 0);
  assert.equal(eligible('2026-04-04T15:30:00Z', sunday).regions[0].length, 1);
  assert.equal(eligible('2026-04-04T16:30:00Z', sunday).regions[0].length, 1);
  assert.equal(eligible('2026-04-04T17:00:00Z', sunday).regions[0].length, 0);
});

test('regions retain order and always-on fallback while inactive assets are omitted', () => {
  const fallback = { mediaId: 'fallback', duration: 10 };
  const result = scheduledRegions([[slot, fallback], [slot]], 'Australia/Adelaide', Date.parse('2026-10-18T22:15:00Z'));
  assert.deepEqual(result.regions, [[fallback], []]);
});

test('campaign dates reject partial, impossible, reversed and unexpected date input', () => {
  const range = { ...slot.schedule, startDate: '2026-10-19', endDate: '2026-10-25' };
  assert.deepEqual(schedule(range), range);
  for (const bad of [{ ...slot.schedule, startDate: '2026-10-19' }, { ...range, startDate: '2026-02-30' },
    { ...range, endDate: '2026-10-18' }, { ...range, endDate: null }, { ...range, startDate: '26-10-19' },
    { ...range, startDate: '2026-13-01' }, { ...range, extra: true }]) assert.throws(() => schedule(bad));
  assert.doesNotThrow(() => schedule({ ...range, startDate: '2028-02-29', endDate: '2028-02-29' }));
});

test('campaign date bounds use location calendar dates and preserve weekly eligibility', () => {
  const dated = { ...slot, schedule: { ...slot.schedule, startDate: '2026-10-19', endDate: '2026-10-19' } };
  assert.equal(eligible('2026-10-11T22:00:00Z', dated).regions[0].length, 0);
  assert.equal(eligible('2026-10-18T22:00:00Z', dated).regions[0].length, 1);
  assert.equal(eligible('2026-10-25T22:00:00Z', dated).regions[0].length, 0);
  assert.deepEqual(playlist([dated]), [dated]);
});

test('campaign expiry cuts overnight playback at local midnight and caps the lease', () => {
  const dated = { ...slot, schedule: { days: [1], start: '22:00', end: '02:00', startDate: '2026-10-19', endDate: '2026-10-19' } };
  const last = eligible('2026-10-19T12:59:40Z', dated);
  assert.equal(last.regions[0].length, 1);
  assert.equal(last.expiresAt, Date.parse('2026-10-19T13:00:00Z'));
  assert.equal(eligible('2026-10-19T13:00:00Z', dated).regions[0].length, 0);
  const starts = { ...dated, schedule: { ...dated.schedule, days: [0], startDate: '2026-10-19', endDate: '2026-10-20' } };
  assert.equal(eligible('2026-10-18T12:59:40Z', starts).regions[0].length, 0);
  assert.equal(eligible('2026-10-18T13:00:00Z', starts).regions[0].length, 1);
});
