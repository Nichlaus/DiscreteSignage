import { createScreens } from '../src/screens.js';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createInteractiveDelivery } from '../src/interactive-delivery.js';
let app, db, deliver, business, clock = Date.now(), disabled = false, revokedAt;
const product = { name: 'Tote', description: 'Cotton bag', priceCents: 1250, available: true };
const request = () => ({ data: {}, app: { appId: 'test' }, auth: { uid: 'player',
  token: { device: true, businessId: 'delivery-test', auth_time: Math.floor(clock / 1000) } } });
const deny = (promise, code) => assert.rejects(promise, e => e.code === code);
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'interactive-delivery'); db = getFirestore(app);
  business = db.doc('businesses/delivery-test');
  deliver = createInteractiveDelivery({ firestore: db, now: () => clock,
    auth: { getUser: async uid => ({ uid, disabled, tokensValidAfterTime: revokedAt }) } });
  await business.set({ name: 'Test' });
  await business.collection('devices').doc('player').set({ active: true, locationId: 'main', screenId: 'front' });
  await business.collection('locations').doc('main').set({ name: 'Main' });
  await business.collection('locations').doc('main').collection('screens').doc('front').set({ active: true, deviceId: 'player' });
  await business.collection('entitlements').doc('current').set({ source: 'trial', trialModules: ['screens','customerAi'],
    trialStartedAt: Timestamp.fromMillis(clock - 1000), trialEndsAt: Timestamp.fromMillis(clock + 120000) });
  await business.collection('locations').doc('main').collection('settings').doc('featuredProduct').set({ product, currency: 'AUD', version: 1 });
});
after(async () => { if (db) { await db.recursiveDelete(business); await db.terminate(); } if (app) await deleteApp(app); });
test('delivery rejects missing attestation, wrong identity, injected location and revoked auth', async () => {
  const r = request();
  await deny(deliver({ ...r, app: undefined }), 'failed-precondition');
  await deny(deliver({ ...r, auth: undefined }), 'permission-denied');
  await deny(deliver({ ...r, auth: { ...r.auth, token: { ...r.auth.token, device: false } } }), 'permission-denied');
  await deny(deliver({ ...r, data: { locationId: 'other' } }), 'invalid-argument');
  await deny(deliver({ ...r, auth: { ...r.auth, token: { ...r.auth.token, businessId: 'other' } } }), 'permission-denied');
  disabled = true; await deny(deliver(r), 'permission-denied'); disabled = false;
  revokedAt = new Date(clock + 1000).toISOString(); await deny(deliver(r), 'permission-denied'); revokedAt = undefined;
});
test('activation defaults off; available product has a short lease bounded by trial', async () => {
  assert.equal((await deliver(request())).product, null);
  const screen = business.collection('locations').doc('main').collection('screens').doc('front');
  await screen.update({ interactive: { enabled: true } });
  const result = await deliver(request());
  assert.deepEqual(result.product, product); assert.equal(result.expiresAt, clock + 60000);
  const trial = business.collection('entitlements').doc('current');
  await trial.update({ trialEndsAt: Timestamp.fromMillis(clock + 5000) });
  assert.equal((await deliver(request())).expiresAt, clock + 5000);
  await trial.update({ trialModules: ['screens'] }); assert.equal((await deliver(request())).product, null);
  await trial.update({ trialModules: ['screens','customerAi'], trialEndsAt: Timestamp.fromMillis(clock) });
  assert.equal((await deliver(request())).product, null);
  await trial.update({ trialEndsAt: Timestamp.fromMillis(clock + 120000) });
});
test('unavailable or malformed products and wrong/revoked assignments never deliver', async () => {
  const location = business.collection('locations').doc('main'), card = location.collection('settings').doc('featuredProduct');
  await card.update({ 'product.available': false }); assert.equal((await deliver(request())).product, null);
  await card.update({ product: { ...product, priceCents: -1 } }); assert.equal((await deliver(request())).product, null);
  await card.update({ product });
  const screen = location.collection('screens').doc('front');
  await screen.update({ deviceId: 'someone-else' }); await deny(deliver(request()), 'permission-denied');
  await screen.update({ deviceId: 'player', active: false }); await deny(deliver(request()), 'permission-denied');
  await screen.update({ active: true });
  await business.collection('devices').doc('player').update({ active: false }); await deny(deliver(request()), 'permission-denied');
});

test('owner enable switch is versioned, audited, entitlement checked and preserves playlists', async () => {
  const screen = business.collection('locations').doc('main').collection('screens').doc('front');
  await screen.set({ active:true, deviceId:'player', version:1, orientation:'landscape', scaleType:'fit', playlist:[] });
  await business.collection('devices').doc('player').update({active:true});
  await business.collection('members').doc('owner').set({active:true,role:'owner'});
  const settings = createScreens({firestore:db,now:()=>clock,auth:{getUser:async uid=>({uid,email:'test@example.test',emailVerified:true})}});
  const payload = {businessId:'delivery-test',locationId:'main',screenId:'front',expectedVersion:1,orientation:'landscape',scaleType:'fit',interactiveEnabled:true};
  const req = data => ({data,app:{appId:'test'},auth:{uid:'owner',token:{auth_time:Math.floor(clock/1000)}}});
  await deny(settings.updateScreenSettings(req({...payload,interactiveEnabled:'true'})),'invalid-argument');
  await deny(settings.updateScreenSettings({...req(payload),auth:{uid:'outsider',token:{auth_time:Math.floor(clock/1000)}}}),'permission-denied');
  await business.collection('entitlements').doc('current').update({trialModules:['screens']});
  await deny(settings.updateScreenSettings(req(payload)),'failed-precondition');
  await business.collection('entitlements').doc('current').update({trialModules:['screens','customerAi']});
  assert.equal((await settings.updateScreenSettings(req(payload))).version,2);
  assert.equal((await settings.updateScreenSettings(req(payload))).changed,false);
  assert.equal((await deliver(request())).product.name,'Tote');
  await deny(settings.updateScreenSettings(req({...payload,interactiveEnabled:false})),'failed-precondition');
  await settings.updateScreenSettings(req({...payload,expectedVersion:2,interactiveEnabled:false}));
  assert.equal((await deliver(request())).product,null);
  assert.deepEqual((await screen.get()).data().playlist,[]);
  assert.equal((await business.collection('audit').doc('settings-front-3').get()).data().after.interactive.enabled,false);
});
