import { randomUUID } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';

// Reservations count even on provider failure: retries cannot evade spending caps.
export function assistantUsage(db, now = () => Date.now(), kind = 'playlist') {
  if (!['playlist', 'image'].includes(kind)) throw Error('Unknown assistant allowance');
  const image = kind === 'image', dailyLimit = image ? 3 : 20, totalLimit = image ? 10 : 100;
  const globalLimit = image ? 100 : 1000, leaseMs = image ? 240000 : 60000;
  const name = image ? 'imageGeneration' : 'assistant', collection = image ? 'imageGenerationUsage' : 'assistantUsage';
  return async businessId => {
    const config = db.doc(`platformConfig/${name}`), global = db.doc(`platformUsage/${name}`);
    const local = db.doc(`businesses/${businessId}/${collection}/current`), lease = randomUUID();
    const time = now(), day = new Date(time).toISOString().slice(0, 10);
    const usage = await db.runTransaction(async tx => {
      const [c, g, b] = await tx.getAll(config, global, local);
      if (c.data()?.enabled !== true) throw new HttpsError('failed-precondition', image ? 'AI image creation is not enabled yet.' : 'The portal assistant is not enabled yet.');
      const daily = b.data()?.day === day ? b.data().daily : 0;
      const total = b.data()?.total ?? 0, globalDaily = g.data()?.day === day ? g.data().daily : 0;
      if (daily >= dailyLimit || total >= totalLimit || globalDaily >= globalLimit) throw new HttpsError('resource-exhausted', `${image ? 'Image creation' : 'Assistant'} request allowance reached. Daily allowances reset at midnight UTC; the trial allows ${totalLimit} requests in total.`);
      if ((b.data()?.leaseUntil ?? 0) > time || (b.data()?.nextAt ?? 0) > time) {
        throw new HttpsError('resource-exhausted', image ? 'An image request is still running. Please try again in a few minutes.' : 'Please wait a minute before requesting another draft.');
      }
      tx.set(global, { day, daily: globalDaily + 1 });
      tx.set(local, { day, daily: daily + 1, total: total + 1, lease, leaseUntil: time + leaseMs, nextAt: time + (image ? 30000 : 15000) });
      return { remainingToday: dailyLimit - 1 - daily, remainingTrial: totalLimit - 1 - total,
        resetsAt: new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString() };
    });
    return { usage, finish: async () => db.runTransaction(async tx => {
      const current = await tx.get(local);
      if (current.data()?.lease === lease) tx.update(local, { leaseUntil: 0 });
    }) };
  };
}
