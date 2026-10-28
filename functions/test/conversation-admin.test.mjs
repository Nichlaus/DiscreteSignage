import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createPlatformAdmin } from '../src/platform-admin.js';

let app, db, service; const uid = 'conversation-admin-test';
const req = data => ({ data, app:{appId:'test'}, auth:{uid,token:{auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_second_factor:'totp'}}} });
const deny = (p, code) => assert.rejects(p, e => e.code === code);
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({projectId:'demo-discretesignage'}, 'conversation-admin'); db = getFirestore(app);
  service = createPlatformAdmin({firestore:db,auth:{getUser:async()=>({uid,email:'admin@example.test',emailVerified:true,disabled:false})}});
  await db.doc(`platformAdmins/${uid}`).set({active:true,permissions:['interactive.manage']});
});
after(async () => {
  await db.doc(`platformAdmins/${uid}`).delete(); await db.doc('platformConfig/customerConversation').delete();
  const audit = await db.collection('platformAudit').where('actorUid','==',uid).get();
  await Promise.all(audit.docs.map(doc => doc.ref.delete())); await db.terminate(); await deleteApp(app);
});
test('global conversation controls require distinct permission, MFA, valid limits and audited versioned updates', async () => {
  await deny(service.getConversationSettings(req({})), 'permission-denied');
  await db.doc(`platformAdmins/${uid}`).update({permissions:['conversation.manage']});
  const noMfa=req({}); delete noMfa.auth.token.firebase;
  await deny(service.getConversationSettings(noMfa), 'permission-denied');
  await deny(service.getConversationSettings({...req({}),app:undefined}), 'failed-precondition');
  const original = await service.getConversationSettings(req({})); assert.equal(original.enabled, false);
  const data = {enabled:true,businessDaily:25,businessTotal:200,globalDaily:500,expectedVersion:0,reason:'Controlled pilot rehearsal'};
  for (const change of [{businessDaily:501},{globalDaily:0},{businessTotal:1.1},{reason:'no'},{enabled:'true'},{extra:'bad'}])
    await deny(service.setConversationSettings(req({...data,...change})), 'invalid-argument');
  const saved = await service.setConversationSettings(req(data)); assert.equal(saved.version,1); assert.equal(saved.businessDaily,25);
  await deny(service.setConversationSettings(req(data)), 'failed-precondition');
  const disabled = await service.setConversationSettings(req({...data,enabled:false,expectedVersion:1,reason:'End pilot rehearsal'}));
  assert.equal(disabled.enabled,false); assert.equal(disabled.version,2);
  const audits = await db.collection('platformAudit').where('actorUid','==',uid).get();
  assert.equal(audits.docs.filter(doc=>doc.data().type==='platform.conversation.updated').length,2);
  await db.doc(`platformAdmins/${uid}`).update({active:false});
  await deny(service.setConversationSettings(req({...data,expectedVersion:2})), 'permission-denied');
});
