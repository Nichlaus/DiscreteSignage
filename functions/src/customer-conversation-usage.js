import { randomUUID } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { identifier } from './provisioning.js';
import { conversationConfig } from './conversation-config.js';

// Internal preview limits, not a paid plan. No customer text is stored here.
export function customerConversationUsage(db, now = () => Date.now()) {
  return async (businessId, deviceId) => {
    const business = identifier(businessId), device = identifier(deviceId);
    const globalConfig = db.doc('platformConfig/customerConversation');
    const global = db.doc('platformUsage/customerConversation');
    const local = db.doc(`businesses/${business}/customerConversationUsage/current`);
    const screen = db.doc(`businesses/${business}/customerConversationDevices/${device}`);
    const time = now(), day = new Date(time).toISOString().slice(0, 10), lease = randomUUID();
    await db.runTransaction(async tx => {
      const [config, g, b, d] = await tx.getAll(globalConfig, global, local, screen);
      const settings = conversationConfig(config.data());
      if (settings?.enabled !== true) throw new HttpsError('failed-precondition', 'Conversation is unavailable.');
      const daily = b.data()?.day === day ? b.data().daily : 0;
      const globalDaily = g.data()?.day === day ? g.data().daily : 0;
      const total = b.data()?.total ?? 0;
      if (![daily, globalDaily, total].every(n => Number.isSafeInteger(n) && n >= 0)
        || daily >= settings.businessDaily || total >= settings.businessTotal || globalDaily >= settings.globalDaily
        || (d.data()?.leaseUntil ?? 0) > time || (d.data()?.nextAt ?? 0) > time) {
        throw new HttpsError('resource-exhausted', 'Please try again later.');
      }
      tx.set(global, { day, daily: globalDaily + 1 });
      tx.set(local, { day, daily: daily + 1, total: total + 1 });
      tx.set(screen, { lease, leaseUntil: time + 60000, nextAt: time + 5000 });
    });
    return { enabled: async () => conversationConfig((await globalConfig.get()).data())?.enabled === true,
      finish: async () => db.runTransaction(async tx => {
      const state = await tx.get(screen);
      if (state.data()?.lease === lease) tx.update(screen, { leaseUntil: 0 });
    }) };
  };
}
