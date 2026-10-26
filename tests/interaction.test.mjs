import test from 'node:test';
import assert from 'node:assert/strict';
import { createInteraction, HOLD_MS, IDLE_MS } from '../prototypes/interaction.js';

test('steady selection requires a full hold and centre resolves the fifth-zone ambiguity', () => {
  const model = createInteraction();
  model.update(2, 100);
  assert.equal(model.update(2, 100 + HOLD_MS - 1).result, null);
  assert.equal(model.update(2, 100 + HOLD_MS).result, 'correct');
});
test('changing targets or losing tracking cancels accumulated dwell', () => {
  const model = createInteraction();
  model.update(0, 100); model.update(1, 800);
  assert.equal(model.update(1, 1000).result, null);
  model.update(null, 1100);
  assert.equal(model.update(1, 1900).progress, 0);
  assert.equal(model.update(1, 2800).result, 'try-again');
});
test('answers lock until reset; invalid tracking cannot select and stale sessions reset', () => {
  const model = createInteraction();
  model.update(0, 100); assert.equal(model.update(0, 1000).result, 'try-again');
  assert.equal(model.update(2, 2000).result, 'try-again');
  model.reset(); assert.equal(model.update(9, 2100).target, null);
  model.update(2, 2200);
  assert.equal(model.update(2, 2200 + IDLE_MS).result, null);
});
