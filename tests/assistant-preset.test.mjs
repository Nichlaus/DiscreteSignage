import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allDayPrompt } from '../functions/src/assistant-presets.js';
import { openAIPlanner } from '../functions/src/assistant-provider.js';

test('built-in all-day draft keeps selected order, exact duration and no midnight gap without a provider call', async () => {
  const planner = openAIPlanner({ fetchImpl: () => { throw Error('Must not call provider'); } });
  const draft = await planner({ prompt: allDayPrompt, context: { media: [{ id: 'b' }, { id: 'a' }] } });
  assert.deepEqual(draft, { kind: 'playlist', playlist: [{ mediaId: 'b', duration: 15 }, { mediaId: 'a', duration: 15 }] });
});

test('editing the starter cannot silently receive the fixed all-day draft', async () => {
  const planner = openAIPlanner({ apiKey: 'test', fetchImpl: async () => { throw Error('custom request reached provider'); } });
  await assert.rejects(planner({ prompt: allDayPrompt + ' Only Mondays.', context: { media: [{ id: 'a' }] } }), /custom request reached provider/);
});
