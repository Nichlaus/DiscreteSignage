import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openAIPlanner } from '../src/assistant-provider.js';
import { allDayPrompt } from '../src/assistant-presets.js';
const result = { kind: 'playlist', message: '', playlist: [{ mediaId: 'image', duration: 10, schedule: null }] };
const response = value => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }) });

test('editing cannot use the replacement all-day shortcut and sends preservation instructions', async () => {
  let called = false;
  const planner = openAIPlanner({ apiKey: 'fixture', fetchImpl: async (_, options) => {
    called = true; const body = JSON.parse(options.body);
    assert.match(body.input.find(i => i.role === 'developer').content, /Preserve each retained entry duration and schedule exactly/);
    assert.equal(JSON.parse(body.input.find(i => i.role === 'user').content).context.mode, 'edit');
    return response(result);
  } });
  await planner({ prompt: allDayPrompt, context: { mode: 'edit', media: [{ id: 'image' }], currentPlaylist: [] } });
  assert.equal(called, true);
});
test('unknown business opening hours require clarification without a provider call', async () => {
  const planner = openAIPlanner({ apiKey: 'fixture', fetchImpl: async () => { throw Error('Must not call provider'); } });
  assert.equal((await planner({ prompt: 'Show these during our opening hours.' })).kind, 'clarification');
});
test('OpenAI request is bounded, stateless and has no tools; nullable schedules normalize', async () => {
  const planner = openAIPlanner({ apiKey: 'fixture-only', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(body.store, false); assert.equal(body.max_output_tokens, 3000);
    assert.equal(body.tools, undefined); assert.equal(body.text.format.strict, true);
    assert.ok(options.signal instanceof AbortSignal); return response(result);
  } });
  assert.deepEqual(await planner({ prompt: 'Show it', context: {} }), { kind: 'playlist', playlist: [{ mediaId: 'image', duration: 10 }] });
});
test('provider rejects unavailable, refused, incomplete, oversized and malformed responses', async () => {
  for (const value of [{ ok: false }, { ok: true, json: async () => ({ status: 'incomplete' }) },
    { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }) }, response({})]) {
    await assert.rejects(openAIPlanner({ apiKey: 'fixture', fetchImpl: async () => value })({}));
  }
  let called = false;
  await assert.rejects(openAIPlanner({ apiKey: 'fixture', fetchImpl: async () => { called = true; } })({ prompt: 'a'.repeat(16001) }));
  assert.equal(called, false);
});
