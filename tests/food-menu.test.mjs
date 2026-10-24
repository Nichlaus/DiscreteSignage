import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceCents, menuPreview } from '../web/food-menu.js';
test('AUD parsing preserves cents without rounding or accepting ambiguous inputs', () => {
  for (const [value, cents] of [['0', 0], ['0.01', 1], ['12.5', 1250], ['109.99', 10999], ['9999.99', 999999]]) assert.equal(priceCents(value), cents);
  for (const value of ['-1', '1.001', '1e2', '$12', '12,50', '', '10000', 'NaN']) assert.throws(() => priceCents(value));
});
test('preview escapes menu content and labels sold-out items without publishing promises', () => {
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  const html = menuPreview({ categories: [{ id: 'a', name: '<img>' }], items: [{ categoryId: 'a', name: '<script>', description: '<svg>', priceCents: 1250, available: false }] }, escape);
  assert.doesNotMatch(html, /<script>|<svg>|<img>/);
  assert.match(html, /Sold out/); assert.match(html, /\$12.50/); assert.match(html, /does not publish/);
});
