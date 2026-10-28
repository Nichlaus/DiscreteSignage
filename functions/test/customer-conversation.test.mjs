import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCustomerConversation, openAICustomerConversation } from '../src/customer-conversation.js';

const card = { name: 'Coffee', description: 'Iced', priceCents: 525, available: true };
const request = () => ({ app: {}, auth: { uid: 'screen', token: { device: true, businessId: 'business' } }, data: { message: 'How much?', history: [] } });
const offer = () => ({ product: card, products: [card], version: 1, expiresAt: 2000 });
const deny = (p, code) => assert.rejects(p, error => error.code === code);

test('uses a reserved request and rechecks the approved products before responding', async () => {
  let calls = 0, finished = 0;
  const service = createCustomerConversation({ now: () => 1000, deliver: async req => {
    assert.deepEqual(req.data, {}); calls++; return offer();
  }, reserve: async (business, screen) => {
    assert.equal(business, 'business'); assert.equal(screen, 'screen');
    return { enabled: async () => true, finish: async () => { finished++; } };
  }, generate: async input => { assert.deepEqual(input.products, [card]); return 'AUD $5.25'; } });
  assert.deepEqual(await service(request()), { answer: 'AUD $5.25' });
  assert.equal(calls, 2); assert.equal(finished, 1);
});

test('denies malformed input, inactive access, changed products and releases the reservation on failure', async () => {
  let calls = 0, finished = 0;
  const service = createCustomerConversation({ now: () => 1000, deliver: async () => ++calls === 1 ? offer() : { ...offer(), version: 2 },
    reserve: async () => ({ enabled: async () => true, finish: async () => { finished++; } }), generate: async () => 'Hello' });
  await deny(service({ ...request(), data: { message: 'x', history: [{ role: 'assistant', text: 'x' }] } }), 'invalid-argument');
  await deny(service({ ...request(), data: { message: 'x', history: [], locationId: 'other' } }), 'invalid-argument');
  await deny(service(request()), 'failed-precondition'); assert.equal(finished, 1);
  const disabled = createCustomerConversation({ now: () => 1000, deliver: async () => ({ product: null, expiresAt: 1000 }),
    reserve: async () => { throw Error('must not reserve'); }, generate: async () => 'x' });
  await deny(disabled(request()), 'failed-precondition');
});

test('provider request disables storage and carries no tools or hidden account data', async () => {
  let sent;
  const generate = openAICustomerConversation({ apiKey: 'synthetic', fetchImpl: async (url, options) => {
    sent = JSON.parse(options.body); assert.equal(url, 'https://api.openai.com/v1/responses');
    return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Ask staff.' }] }] }) };
  } });
  assert.equal(await generate({ products: [card], history: [], message: 'Ingredients?' }), 'Ask staff.');
  assert.equal(sent.store, false); assert.equal(sent.tools, undefined); assert.equal(sent.max_output_tokens, 250);
  assert.deepEqual(JSON.parse(sent.input[0].content), { products: [card], history: [], message: 'Ingredients?' });
});

test('does not return an answer after a kill switch or device revocation, and counts failures', async () => {
  let finished = 0, calls = 0;
  const reserve = async () => ({ enabled: async () => false, finish: async () => { finished++; } });
  const disabled = createCustomerConversation({ now: () => 1000, deliver: async () => offer(), reserve, generate: async () => 'Hello' });
  await deny(disabled(request()), 'failed-precondition'); assert.equal(finished, 1);
  const revoked = createCustomerConversation({ now: () => 1000, deliver: async () => {
    if (++calls === 2) throw Object.assign(new Error('Revoked'), { code: 'permission-denied' });
    return offer();
  }, reserve, generate: async () => 'Hello' });
  await deny(revoked(request()), 'permission-denied'); assert.equal(finished, 2);
  const failed = createCustomerConversation({ now: () => 1000, deliver: async () => offer(), reserve,
    generate: async () => { throw Error('Provider unavailable'); } });
  await assert.rejects(failed(request()), /Provider unavailable/); assert.equal(finished, 3);
});
