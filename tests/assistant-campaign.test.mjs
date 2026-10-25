import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignDates } from '../web/assistant-campaign.js';

test('optional campaigns allow repeating schedules, same-day campaigns and leap days', () => {
  assert.deepEqual(campaignDates('', ''), {});
  for (const [startDate, endDate] of [['2026-10-25', '2026-10-25'], ['2028-02-29', '2028-03-01']])
    assert.deepEqual(campaignDates(startDate, endDate), { startDate, endDate });
});

test('incomplete, reversed and impossible campaign dates are rejected before requesting a draft', () => {
  for (const pair of [['2026-10-25', ''], ['', '2026-10-25'], ['2026-10-26', '2026-10-25'],
    ['2026-02-29', '2026-03-01'], ['2026-04-31', '2026-05-01'], ['1999-01-01', '2000-01-01']])
    assert.throws(() => campaignDates(...pair), /Choose both campaign dates/);
});
