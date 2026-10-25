import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assistantForm } from '../web/assistant-form.js';
const escape = s => String(s).replaceAll('<', '&lt;').replaceAll('"', '&quot;');
test('assistant form provides setup guidance and explicit provider disclosure with escaped choices', () => {
  assert.match(assistantForm({ screens: [], locations: [] }, [], escape), /Pair a screen/);
  const html = assistantForm({ screens: [{ id: 'screen', active: true, name: '<unsafe>', locationId: 'l' }], locations: [{ id: 'l', name: 'Main' }] },
    [{ id: 'image', name: '<img>', status: 'ready' }], escape);
  assert.ok(!html.includes('<unsafe>')); assert.ok(!html.includes('<img>'));
  assert.match(html, /sent to OpenAI/); assert.match(html, /maxlength="2000"/);
  assert.match(html, /20 requests per UTC day/); assert.match(html, /Prepare a draft/);
});
