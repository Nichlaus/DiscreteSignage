import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markets, marketFor } from '../functions/src/markets.js';
import { marketView } from '../web/market-view.js';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');

test('legacy and unknown markets use general guidance without rendering untrusted values', () => {
  for (const market of [undefined, null, '<script>']) {
    const html = marketView({ market, role: 'owner' }, escape);
    assert.match(html, /General signage/);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /value="general" selected/);
  }
});
test('all markets have distinct options and only owners get the edit form', () => {
  assert.equal(new Set(markets.map(m => m.id)).size, markets.length);
  for (const market of markets) {
    assert.equal(marketFor(market.id), market);
    assert.match(marketView({ market: market.id, role: 'owner' }, escape), new RegExp(`value="${market.id}" selected`));
    for (const role of ['manager', 'staff']) {
      assert.doesNotMatch(marketView({ market: market.id, role }, escape), /<form|<select/);
    }
  }
  assert.match(marketFor('food').guide, /planned separately/);
  assert.match(marketFor('advertising').guide, /not audience views/);
});
