import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { customerConversationUsage } from '../src/customer-conversation-usage.js';

let app, db, time = Date.parse('2026-10-28T00:00:00Z');
before(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'conversation-usage'); db = getFirestore(app);
});
after(async () => {
  await db.recursiveDelete(db.doc('businesses/conversation-usage'));
  await db.doc('platformConfig/customerConversation').delete();
  await db.doc('platformUsage/customerConversation').delete();
  await db.terminate(); await deleteApp(app);
});
test('default-off switch, concurrency, daily limits and in-flight disable', async () => {
  const reserve = customerConversationUsage(db, () => time);
  const config = db.doc('platformConfig/customerConversation');
  const local = db.doc('businesses/conversation-usage/customerConversationUsage/current');
  await assert.rejects(reserve('conversation-usage', 'screen'), e => e.code === 'failed-precondition');
  await config.set({ enabled: true });
  const attempts = await Promise.allSettled([reserve('conversation-usage', 'screen'), reserve('conversation-usage', 'screen')]);
  assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
  const lease = attempts.find(item => item.status === 'fulfilled').value;
  await config.set({ enabled: false }); assert.equal(await lease.enabled(), false); await lease.finish();
  assert.equal((await local.get()).data().total, 1);
  await config.set({ enabled: true }); time += 6000;
  await local.update({ daily: 100 });
  await assert.rejects(reserve('conversation-usage', 'screen'), e => e.code === 'resource-exhausted');
  assert.equal((await local.get()).data().total, 1);
});
