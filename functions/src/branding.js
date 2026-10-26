import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';
import { advertBrand } from './image-references.js';

export function createBranding({ firestore: db, auth, now = () => Date.now() }) {
  async function handle(request, write) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', ...(write ? ['profile', 'expectedVersion'] : [])]);
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`), ref = business.collection('settings').doc('branding');
    let profile;
    if (write) {
      fields(request.data.profile, ['logoId', 'logoPlacement', 'colours']);
      profile = request.data.profile;
      advertBrand({ ...profile, mode: 'new', sourceId: null, consent: true });
      if (!Number.isSafeInteger(request.data.expectedVersion) || request.data.expectedVersion < 0) throw new HttpsError('invalid-argument', 'Load saved branding first.');
    }
    return db.runTransaction(async tx => {
      const [member, meta, stored, trial] = await tx.getAll(business.collection('members').doc(user.uid), business, ref, business.collection('entitlements').doc('current'));
      if (member.data()?.active !== true || member.data()?.role !== 'owner') throw new HttpsError('permission-denied', 'Active business ownership is required.');
      if (!meta.exists) throw new HttpsError('not-found', 'Business unavailable.');
      const old = stored.data() ?? { version: 0, profile: { logoId: null, logoPlacement: 'top-right', colours: [] } };
      if (!write) return { version: old.version, profile: old.profile };
      const t = trial.data();
      if (t?.source !== 'trial' || !t.trialModules?.includes('screens') || !t.trialModules?.includes('aiStudio') || !(t.trialStartedAt?.toMillis() <= now()) || !(t.trialEndsAt?.toMillis() > now())) throw new HttpsError('failed-precondition', 'Active signage and AI trial access is required.');
      if (profile.logoId) {
        const media = (await tx.get(business.collection('media').doc(profile.logoId))).data();
        if (media?.status !== 'ready' || media.playback?.policy !== 'image-v1') throw new HttpsError('failed-precondition', 'Choose a ready logo from this business.');
      }
      if (old.version !== request.data.expectedVersion) throw new HttpsError('failed-precondition', 'Branding changed elsewhere. Load it again before saving.');
      const version = old.version + 1, updatedAt = Timestamp.fromMillis(now());
      tx.set(ref, { version, profile, updatedAt });
      tx.create(business.collection('audit').doc(), { type: 'branding.saved', actorUid: user.uid, version, createdAt: updatedAt });
      return { version, profile };
    });
  }
  return { getBranding: request => handle(request, false), saveBranding: request => handle(request, true) };
}
