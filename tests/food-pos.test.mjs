import { test } from 'node:test';
import assert from 'node:assert/strict';
import { posView } from '../web/food-pos.js';

test('staff order preview escapes locations and identifies payment limitations', () => {
  const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const html = posView([{ id: 'a"b', name: '<unsafe>' }], escape);
  assert.doesNotMatch(html, /<unsafe>|value="a"b"/);
  assert.match(html, /&lt;unsafe>/);
  assert.match(html, /All orders remain unpaid/);
  assert.match(posView([], escape), /disabled/);
});
