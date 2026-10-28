import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { api, project } from './firebase-project.mjs';

const action = process.argv[2];
const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
if (action === 'enable-mfa') {
  let config = await api(configUrl);
  if (config.subtype !== 'IDENTITY_PLATFORM') {
    await api(`https://identitytoolkit.googleapis.com/v2/projects/${project}/identityPlatform:initializeAuth`, { method: 'POST', body: {} });
    config = await api(configUrl);
  }
  const providers = (config.mfa?.providerConfigs ?? []).filter(p => !p.totpProviderConfig);
  providers.push({ state: 'ENABLED', totpProviderConfig: { adjacentIntervals: 1 } });
  await api(`${configUrl}?updateMask=mfa`, { method: 'PATCH', body: {
    mfa: { ...config.mfa, state: config.mfa?.state === 'MANDATORY' ? 'MANDATORY' : 'ENABLED', providerConfigs: providers },
  } });
  const updated = await api(configUrl);
  assert.equal(updated.subtype, 'IDENTITY_PLATFORM');
  assert.ok(updated.mfa.providerConfigs.some(p => p.state === 'ENABLED' && p.totpProviderConfig?.adjacentIntervals === 1));
  console.log('Identity Platform TOTP enabled; existing sign-in settings preserved.');
} else if (action === 'grant') {
  const email = process.argv[3];
  assert.ok(email?.includes('@'), 'Provide the explicitly approved administrator email.');
  const lookup = await api(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`, {
    method: 'POST', body: { email: [email] },
  });
  assert.equal(lookup.users?.length, 1, 'One existing account is required.');
  const user = lookup.users[0];
  assert.equal(user.email.toLowerCase(), email.toLowerCase());
  assert.equal(user.emailVerified, true, 'Email must be verified.');
  assert.notEqual(user.disabled, true, 'Account must be active.');
  assert.ok(user.mfaInfo?.some(f => f.totpInfo), 'Enrol an authenticator before granting access.');
  assert.match(user.localId, /^[a-zA-Z0-9_-]{1,128}$/);
  const root = `projects/${project}/databases/(default)/documents`;
  const name = `${root}/platformAdmins/${user.localId}`;
  const timestampValue = new Date().toISOString();
  await api(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', body: { writes: [
    { update: { name, fields: { active: { booleanValue: true }, permissions: { arrayValue: { values: [{ stringValue: 'business.read' }] } }, createdAt: { timestampValue } } }, currentDocument: { exists: false } },
    { update: { name: `${root}/platformAudit/${randomUUID()}`, fields: {
      type: { stringValue: 'platform.admin.bootstrap' }, targetUid: { stringValue: user.localId },
      actor: { stringValue: 'firebase-cli-project-operator' }, reason: { stringValue: 'Project owner explicitly requested administrator setup' },
      permission: { stringValue: 'business.read' }, createdAt: { timestampValue },
    } }, currentDocument: { exists: false } },
  ] } });
  const record = await api(`https://firestore.googleapis.com/v1/${name}`);
  assert.equal(record.fields.active.booleanValue, true);
  console.log('Read-only administrator permission created and audited for the approved verified account.');
 } else if (action === 'grant-interactive') {
  const email = process.argv[3];
  assert.ok(email?.includes('@'), 'Provide the explicitly approved administrator email.');
  const lookup = await api(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`, { method:'POST',body:{email:[email]} });
  assert.equal(lookup.users?.length,1); const user=lookup.users[0];
  assert.equal(user.email.toLowerCase(),email.toLowerCase()); assert.equal(user.emailVerified,true);
  assert.notEqual(user.disabled,true); assert.ok(user.mfaInfo?.some(f=>f.totpInfo));
  assert.match(user.localId,/^[a-zA-Z0-9_-]{1,128}$/);
  const root=`projects/${project}/databases/(default)/documents`, name=`${root}/platformAdmins/${user.localId}`;
  const record=await api(`https://firestore.googleapis.com/v1/${name}`);
  assert.equal(record.fields.active.booleanValue,true);
  const permissions=(record.fields.permissions?.arrayValue?.values??[]).map(v=>v.stringValue);
  assert.ok(permissions.includes('business.read'),'Existing diagnostics administrator required.');
  if(!permissions.includes('interactive.manage')) {
    permissions.push('interactive.manage');
    await api(`https://firestore.googleapis.com/v1/${root}:commit`,{method:'POST',body:{writes:[
      {update:{name,fields:{permissions:{arrayValue:{values:permissions.map(stringValue=>({stringValue}))}}}},updateMask:{fieldPaths:['permissions']},currentDocument:{updateTime:record.updateTime}},
      {update:{name:`${root}/platformAudit/${randomUUID()}`,fields:{type:{stringValue:'platform.admin.interactive.granted'},targetUid:{stringValue:user.localId},actor:{stringValue:'firebase-cli-project-operator'},createdAt:{timestampValue:new Date().toISOString()}}},currentDocument:{exists:false}}
    ]}});
  }
  console.log('Interactive management permission verified; existing permissions preserved.');
} else if (action === 'grant-conversation') {
  const email = process.argv[3];
  assert.ok(email?.includes('@'), 'Provide the explicitly approved administrator email.');
  const lookup = await api(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`, { method:'POST', body:{email:[email]} });
  assert.equal(lookup.users?.length, 1); const user = lookup.users[0];
  assert.equal(user.email.toLowerCase(), email.toLowerCase()); assert.equal(user.emailVerified, true);
  assert.notEqual(user.disabled, true); assert.ok(user.mfaInfo?.some(f=>f.totpInfo));
  assert.match(user.localId, /^[a-zA-Z0-9_-]{1,128}$/);
  const root = `projects/${project}/databases/(default)/documents`, name = `${root}/platformAdmins/${user.localId}`;
  const record = await api(`https://firestore.googleapis.com/v1/${name}`);
  assert.equal(record.fields.active.booleanValue, true);
  const permissions = (record.fields.permissions?.arrayValue?.values ?? []).map(v=>v.stringValue);
  assert.ok(permissions.includes('business.read'), 'Existing diagnostics administrator required.');
  if (!permissions.includes('conversation.manage')) {
    permissions.push('conversation.manage');
    await api(`https://firestore.googleapis.com/v1/${root}:commit`, {method:'POST',body:{writes:[
      {update:{name,fields:{permissions:{arrayValue:{values:permissions.map(stringValue=>({stringValue}))}}}},updateMask:{fieldPaths:['permissions']},currentDocument:{updateTime:record.updateTime}},
      {update:{name:`${root}/platformAudit/${randomUUID()}`,fields:{type:{stringValue:'platform.admin.conversation.granted'},targetUid:{stringValue:user.localId},actor:{stringValue:'firebase-cli-project-operator'},createdAt:{timestampValue:new Date().toISOString()}}},currentDocument:{exists:false}}
    ]}});
  }
  console.log('Conversation management permission verified; existing permissions preserved.');
} else throw Error('Use enable-mfa, grant <approved-email>, grant-interactive <approved-email>, or grant-conversation <approved-email>.');
