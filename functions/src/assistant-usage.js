import { randomUUID } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';

// Reservations count even on provider failure: retries cannot evade spending caps.
export function assistantUsage(db, now = () => Date.now()) {
  return async businessId => {
    const config = db.doc('platformConfig/assistant'), global = db.doc('platformUsage/assistant');
    const local = db.doc(`businesses/${businessId}/assistantUsage/current`), lease = randomUUID();
    const time = now(), day = new Date(time).toISOString().slice(0, 10);
    const usage = await db.runTransaction(async tx => {
      const [c, g, b] = await tx.getAll(config, global, local);
      if (c.data()?.enabled !== true) throw new HttpsError('failed-precondition', 'The portal assistant is not enabled yet.');
      const daily = b.data()?.day === day ? b.data().daily : 0;
      const total = b.data()?.total ?? 0, globalDaily = g.data()?.day === day ? g.data().daily : 0;
      if (daily >= 20 || total >= 100 || globalDaily >= 1000) throw new HttpsError('resource-exhausted', 'Assistant request allowance reached. Daily allowances reset at midnight UTC; the trial allows 100 requests in total.');
      if ((b.data()?.leaseUntil ?? 0) > time || (b.data()?.nextAt ?? 0) > time) {
        throw new HttpsError('resource-exhausted', 'Please wait a minute before requesting another draft.');
      }
      tx.set(global, { day, daily: globalDaily + 1 });
      tx.set(local, { day, daily: daily + 1, total: total + 1, lease, leaseUntil: time + 60000, nextAt: time + 15000 });
      return { remainingToday: 19 - daily, remainingTrial: 99 - total,
        resetsAt: new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString() };
    });
    return { usage, finish: async () => db.runTransaction(async tx => {
      const current = await tx.get(local);
      if (current.data()?.lease === lease) tx.update(local, { leaseUntil: 0 });
    }) };
  };
}
