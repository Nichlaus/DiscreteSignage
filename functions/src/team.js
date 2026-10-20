import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (code, message) => { throw new HttpsError(code, message); };
function requireOwner(member) {
  if (member.data()?.active !== true || member.data()?.role !== 'owner') {
    fail('permission-denied', 'Active business ownership is required.');
  }
}
export function createTeam({ firestore: db, auth, now = () => Date.now() }) {
  async function createInvitation(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'requestId', 'email', 'role', 'locationIds']);
    const { role, locationIds } = request.data;
    const businessId = identifier(request.data.businessId);
    const requestId = identifier(request.data.requestId);
    const email = typeof request.data.email === 'string' ? request.data.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
      || !['manager', 'staff'].includes(role)
      || !Array.isArray(locationIds) || locationIds.length < 1 || locationIds.length > 100
      || new Set(locationIds).size !== locationIds.length) {
      fail('invalid-argument', 'Supply an email, staff/manager role, and unique assigned locations.');
    }
    locationIds.forEach(identifier);
    const normalized = { email, role, locationIds: [...locationIds].sort() };
    const fingerprint = hash(JSON.stringify(normalized));
    const business = db.doc(`businesses/${businessId}`);
    const invitationId = hash(`${user.uid}:${requestId}`);
    const invitation = business.collection('invitations').doc(invitationId);
    return db.runTransaction(async tx => {
      const [member, existing, ...locations] = await tx.getAll(
        business.collection('members').doc(user.uid), invitation,
        ...locationIds.map(id => business.collection('locations').doc(id)));
      requireOwner(member);
      if (locations.some(location => !location.exists)) fail('invalid-argument', 'Unknown assigned location.');
      if (existing.exists) {
        if (existing.data().fingerprint !== fingerprint) fail('already-exists', 'Request ID already used.');
        if (existing.data().status !== 'pending' || existing.data().expiresAt.toMillis() <= now()) {
          fail('failed-precondition', 'Create a new invitation.');
        }
        return { businessId, invitationId };
      }
      const createdAt = Timestamp.fromMillis(now());
      tx.create(invitation, {
        ...normalized, fingerprint, createdBy: user.uid, createdAt,
        expiresAt: Timestamp.fromMillis(now() + 7 * 86400000), status: 'pending',
      });
      tx.create(business.collection('audit').doc(`invite-${invitationId}`),
        { type: 'invitation.created', actorUid: user.uid, invitationId, createdAt });
      return { businessId, invitationId };
    });
  }
  async function acceptInvitation(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'invitationId']);
    const businessId = identifier(request.data.businessId);
    const invitationId = identifier(request.data.invitationId);
    const business = db.doc(`businesses/${businessId}`);
    return db.runTransaction(async tx => {
      const invitationRef = business.collection('invitations').doc(invitationId);
      const invitation = await tx.get(invitationRef);
      const data = invitation.data();
      if (!data || data.email !== user.email.trim().toLowerCase()) {
        fail('permission-denied', 'Invitation unavailable for this account.');
      }
      const memberRef = business.collection('members').doc(user.uid);
      const [issuer, member, ...locations] = await tx.getAll(
        business.collection('members').doc(data.createdBy), memberRef,
        ...data.locationIds.map(id => business.collection('locations').doc(id)));
      requireOwner(issuer);
      if (data.status === 'accepted' && data.acceptedBy === user.uid && member.data()?.active === true) {
        return { businessId, accepted: true };
      }
      if (data.status !== 'pending' || data.expiresAt.toMillis() <= now()) {
        fail('failed-precondition', 'Invitation expired or is no longer available.');
      }
      if (member.exists) fail('already-exists', 'Membership already exists; ask the owner to manage access.');
      if (locations.some(location => !location.exists)) fail('failed-precondition', 'Assigned location unavailable.');
      const acceptedAt = Timestamp.fromMillis(now());
      tx.create(memberRef, {
        active: true, role: data.role,
        locations: Object.fromEntries(data.locationIds.map(id => [id, true])),
        createdAt: acceptedAt,
      });
      tx.set(db.doc(`userAccess/${hash(user.uid)}/businesses/${businessId}`), { businessId });
      tx.update(invitationRef, { status: 'accepted', acceptedBy: user.uid, acceptedAt });
      tx.create(business.collection('audit').doc(`accepted-${invitationId}`),
        { type: 'invitation.accepted', actorUid: user.uid, invitationId, createdAt: acceptedAt });
      return { businessId, accepted: true };
    });
  }
  async function revokeInvitation(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'invitationId']);
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    const invitationId = identifier(request.data.invitationId);
    return db.runTransaction(async tx => {
      const ref = business.collection('invitations').doc(invitationId);
      const [member, invitation] = await tx.getAll(business.collection('members').doc(user.uid), ref);
      requireOwner(member);
      if (!invitation.exists) fail('not-found', 'Invitation unavailable.');
      if (invitation.data().status === 'revoked') return { revoked: true };
      if (invitation.data().status !== 'pending') fail('failed-precondition', 'Invitation already accepted.');
      const createdAt = Timestamp.fromMillis(now());
      tx.update(ref, { status: 'revoked', revokedAt: createdAt });
      tx.create(business.collection('audit').doc(`revoked-${invitationId}`),
        { type: 'invitation.revoked', actorUid: user.uid, invitationId, createdAt });
      return { revoked: true };
    });
  }
  async function getWorkspace(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId']);
    const selection = request.data.businessId === '' ? '' : identifier(request.data.businessId);
    const index = await db.collection(`userAccess/${hash(user.uid)}/businesses`).get();
    const businesses = [];
    for (const entry of index.docs) {
      const business = db.doc(`businesses/${entry.id}`);
      const [meta, member] = await db.getAll(business, business.collection('members').doc(user.uid));
      if (meta.exists && member.data()?.active === true
        && ['owner', 'manager', 'staff'].includes(member.data().role)) {
        businesses.push({ id: entry.id, name: meta.data().name, role: member.data().role,
          assigned: member.data().locations ?? {} });
      }
    }
    const selected = businesses.find(b => b.id === selection) ?? (!selection ? businesses[0] : null);
    if (selection && !selected) fail('permission-denied', 'Business unavailable.');
    if (!selected) return { businesses: [], workspace: null };
    const ref = db.doc(`businesses/${selected.id}`);
    const [locations, trial, invitations] = await Promise.all([
      ref.collection('locations').get(),
      ref.collection('entitlements').doc('current').get(),
      selected.role === 'owner'
        ? ref.collection('invitations').orderBy('createdAt', 'desc').limit(50).get() : null,
    ]);
    const visibleLocations = locations.docs.filter(d => selected.role === 'owner' || selected.assigned[d.id] === true);
    const screens = (await Promise.all(visibleLocations.map(async location => {
      const result = await location.ref.collection('screens').limit(100).get();
      return result.docs.map(d => ({ id: d.id, locationId: location.id, name: d.data().name,
        deviceId: d.data().deviceId, active: d.data().active === true }));
    }))).flat();
    return {
      businesses: businesses.map(({ assigned, ...business }) => business),
      workspace: {
        id: selected.id, name: selected.name, role: selected.role,
        trialEndsAt: trial.data()?.trialEndsAt?.toMillis() ?? null,
        screens,
        locations: locations.docs.filter(d => selected.role === 'owner' || selected.assigned[d.id] === true)
          .map(d => ({ id: d.id, name: d.data().name, timezone: d.data().timezone })),
        invitations: invitations?.docs.map(d => ({
          id: d.id, email: d.data().email, role: d.data().role,
          status: d.data().status === 'pending' && d.data().expiresAt.toMillis() <= now()
            ? 'expired' : d.data().status, expiresAt: d.data().expiresAt.toMillis(),
        })) ?? [],
      },
    };
  }
  return { createInvitation, acceptInvitation, revokeInvitation, getWorkspace };
}
