import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayPresets, timingSummary } from '../web/assistant-timing.js';
const input = { scheduled: true, days: [1,2,3,4,5], start: '09:00', end: '17:00', startDate: '', endDate: '', timezone: 'Australia/Sydney' };

test('quick days and summaries distinguish weekends, weekdays and all-day playback', () => {
  assert.deepEqual(dayPresets.weekends, [0, 6]);
  assert.match(timingSummary(input), /Monday–Friday, 09:00–17:00.*Australia\/Sydney/);
  assert.match(timingSummary({ ...input, days: dayPresets.weekends }), /Saturday and Sunday/);
  assert.match(timingSummary({ ...input, days: dayPresets.daily }), /Every day, 09:00/);
  assert.match(timingSummary({ ...input, scheduled: false, startDate: '2026-10-25' }), /all day.*No campaign date limits/);
});
test('overnight and campaign boundaries are explicit; incomplete schedules are not described as valid', () => {
  assert.match(timingSummary({ ...input, days: [5], start: '22:00', end: '02:00', startDate: '2026-10-25', endDate: '2026-10-31' }), /Friday.*next day.*2026-10-25 through 2026-10-31.*midnight/);
  assert.match(timingSummary({ ...input, days: [] }), /Choose at least/);
  assert.match(timingSummary({ ...input, end: '09:00' }), /different start/);
  assert.match(timingSummary({ ...input, startDate: '2026-10-25' }), /Choose both/);
  assert.match(timingSummary({ ...input, timezone: '' }), /Set a location/);
});
