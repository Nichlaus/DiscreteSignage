import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClientLink, clientLink } from '../web/client-link.js';

test('client invitations round-trip without email or credentials in the URL query', () => {
  const data = { businessId: 'business_a', advertiserId: 'client-1', invitationId: 'invite_1' };
  const url = new URL(clientLink('https://discretesignage.web.app', data));
  assert.equal(url.pathname, '/client.html'); assert.equal(url.search, '');
  assert.deepEqual(parseClientLink(url.hash), data);
  assert.deepEqual(parseClientLink('businessId=a&advertiserId=b'), { businessId: 'a', advertiserId: 'b' });
});
test('malformed, ambiguous and unexpected client link fields are rejected', () => {
  for (const value of ['', 'businessId=a', 'businessId=a&advertiserId=b&invitationId=',
    'businessId=a&advertiserId=b&role=owner', 'businessId=a&businessId=b&advertiserId=c',
    'businessId=a&advertiserId=../other', `businessId=a&advertiserId=${'x'.repeat(129)}`]) {
    assert.equal(parseClientLink(value), null, value);
  }
});
