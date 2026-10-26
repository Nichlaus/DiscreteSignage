import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featuredProductPreview, featuredProductView } from '../web/featured-product.js';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
test('featured product preview escapes facts and explicitly marks unavailable products', () => {
  const html = featuredProductPreview({ name: '<script>', description: '<img>', priceCents: 1099, available: false }, escape);
  assert.doesNotMatch(html, /<script>|<img>/);
  assert.match(html, /\$10.99 AUD/); assert.match(html, /Unavailable — do not promote/);
  assert.match(featuredProductPreview(null, escape), /No featured product/);
});
test('product form promises preparation, not activation, and escapes locations', () => {
  const html = featuredProductView([{ id: 'a"', name: '<shop>' }], escape);
  assert.match(html, /does not activate/); assert.doesNotMatch(html, /<shop>/);
  assert.match(html, /a&quot;/);
});
