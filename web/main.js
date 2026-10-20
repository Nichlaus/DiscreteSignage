import './style.css';
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, reload, getIdToken,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { uploadMedia } from './media-upload.js';

const root = document.querySelector('#app');
const escape = value => String(value ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let auth, functions, user, mode = 'signup', workspace, businesses = [], message = '', busy = false;
let selected = sessionStorage.getItem('businessId') ?? '';
let workspaceLoaded = false;
let mediaItems = [];
let invite;
const fragment = new URLSearchParams(location.hash.slice(1));
if (fragment.has('invitationId') && fragment.has('businessId')) {
  sessionStorage.setItem('invitation', JSON.stringify(Object.fromEntries(fragment)));
  history.replaceState(null, '', location.pathname);
}
try { invite = JSON.parse(sessionStorage.getItem('invitation') ?? 'null'); } catch { /* Ignore invalid local state. */ }
let configurationError = '';
try {
  const config = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || '{}');
  if (!config.apiKey || !config.authDomain || !config.appId || config.projectId !== 'discretesignage'
    || !import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) throw Error('setup');
  const app = initializeApp(config);
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
  auth = getAuth(app);
  functions = getFunctions(app, 'australia-southeast1');
} catch {
  configurationError = 'Local preview · Firebase web configuration and App Check are not connected yet. Account actions are disabled.';
}
const call = async (name, data) => (await httpsCallable(functions, name)(data)).data;
const timezoneOptions = () => ['Sydney', 'Melbourne', 'Brisbane', 'Adelaide', 'Perth', 'Darwin',
  'Hobart', 'Lord_Howe', 'Broken_Hill', 'Eucla', 'Lindeman']
  .map(zone => `<option value="Australia/${zone}">${zone.replaceAll('_', ' ')}</option>`).join('');
const field = (label, name, type = 'text', extra = '') =>
  `<label>${label}<input name="${name}" type="${type}" required ${extra}></label>`;
const safeError = error => {
  const code = error.code?.replace('functions/', '') ?? '';
  const authErrors = {
    'auth/invalid-credential': 'Email or password was not recognised.',
    'auth/email-already-in-use': 'This email already has an account. Sign in instead.',
    'auth/weak-password': 'Choose a stronger password of at least 12 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
    'auth/network-request-failed': 'Connection failed. Please try again.',
  };
  return authErrors[code] ?? (['permission-denied', 'invalid-argument', 'already-exists',
    'failed-precondition', 'resource-exhausted', 'unauthenticated'].includes(code)
    ? error.message : 'We couldn’t complete that action. Please try again.');
};
async function action(task) {
  if (busy) return;
  busy = true;
  root.querySelectorAll('button, select').forEach(control => { control.disabled = true; });
  try { message = ''; await task(); } catch (error) { message = safeError(error); }
  finally { busy = false; render(); }
}
async function refresh() {
  const result = await call('getWorkspace', { businessId: selected });
  businesses = result.businesses;
  workspace = result.workspace;
  selected = workspace?.id ?? '';
  sessionStorage.setItem('businessId', selected);
  workspaceLoaded = true;
}
async function requestWithRetryId(operation, data) {
  const key = `request:${operation}:${JSON.stringify(data)}`;
  const requestId = sessionStorage.getItem(key) || crypto.randomUUID();
  sessionStorage.setItem(key, requestId);
  const result = await call(operation, { ...data, requestId });
  sessionStorage.removeItem(key);
  return result;
}
function shell(content) {
  return `<div class="layout">
    <aside class="brand-panel">
      <a class="brand" href="/"><span class="brand-icon">d<span>•</span></span><span>discrete<span class="brand-sub">SIGNAGE</span></span></a>
      <div class="intro"><span class="eyebrow">A BETTER EVERYDAY BUSINESS</span>
      <h1>Your space.<br>Your screens.<br><em>All connected.</em></h1>
      <p>Bring your menus, orders and customer experiences together. Start with one location. Grow from there.</p></div>
      <div class="screen-art" aria-hidden="true"><div class="screen-top"><span>YOUR NEXT CHAPTER</span><i></i></div>
      <div class="screen-body"><div class="art-heading">Good things<br>start here<span>↗</span></div><div class="art-lines"><b></b><b></b><b></b></div></div>
      <div class="screen-bottom"><span>MENUS</span><span>ORDERS</span><span>EXPERIENCES</span></div></div>
      <div class="brand-footer"><span>Made for the way you work.</span><span>AU / AUD</span></div>
    </aside>
    <main><header><span class="product-tag">BUSINESS PORTAL</span>${user ? `<button class="text-button" id="signout">Sign out</button>` : '<span class="header-note">Less admin. More possibility.</span>'}</header>
    ${configurationError ? `<div class="notice">${configurationError}</div>` : ''}
    <div class="content">${message ? `<div class="notice" role="status" aria-live="polite">${escape(message)}</div>` : ''}${content}</div>
    <footer>Discrete Signage <span>Built around your business.</span></footer></main></div>`;
}
function authView() {
  const signup = mode === 'signup';
  return `<div class="step-label"><span>01</span> YOUR ACCOUNT</div>
    <h2>${signup ? 'Make yourself at home.' : 'Welcome back.'}</h2>
    <p class="subtitle">${invite ? 'Sign in with the invited email to join your team.' : 'One account for your screens, team and daily operations.'}</p>
    <div class="tabs" role="group" aria-label="Account options"><button id="signup" class="${signup ? 'active' : ''}">Create account</button><button id="login" class="${!signup ? 'active' : ''}">Sign in</button></div>
    <form id="auth-form">
      ${field('Work email', 'email', 'email', 'autocomplete="email" placeholder="you@yourbusiness.com.au"')}
      ${field('Password', 'password', 'password', `autocomplete="${signup ? 'new-password' : 'current-password'}" ${signup ? 'minlength="12"' : ''} placeholder="${signup ? 'At least 12 characters' : 'Enter your password'}"`)}
      ${!signup ? '<button type="button" class="text-button forgot" id="reset">Forgot password?</button>' : '<p class="field-note">We’ll ask you to verify your email before setting up your business.</p>'}
      <button class="primary" ${configurationError ? 'disabled' : ''}>${signup ? 'Create your account' : 'Sign in'} <span>↗</span></button>
    </form>
    ${!invite ? '<div class="trial"><span class="trial-icon">✦</span><div><strong>Your first 14 days are on us.</strong><p>Try every feature. No payment method required.<br>AI usage allowances apply. Payment processing fees are separate.</p></div></div>' : '<p class="field-note">Joining a team does not start a new business trial.</p>'}`;
}
function verifyView() {
  return `<div class="step-label"><span>02</span> VERIFY EMAIL</div><h2>Check your inbox.</h2>
  <p class="subtitle">Verify <strong>${escape(user.email)}</strong> to keep your business account secure.</p>
  <button class="primary" id="check-email">I’ve verified my email <span>↗</span></button>
  <button class="secondary" id="resend">Send verification email</button>
  <p class="field-note">Open the verification link, then return here to continue.</p>`;
}
function setupView() {
  if (invite) return `<div class="step-label"><span>02</span> JOIN YOUR TEAM</div><h2>A place on the team.</h2>
    <p class="subtitle">Accept the invitation using <strong>${escape(user.email)}</strong>. Your owner has chosen your role and locations.</p>
    <button class="primary" id="accept">Accept invitation <span>↗</span></button><button class="secondary" id="dismiss">Dismiss invitation</button>`;
  return `<div class="step-label"><span>02</span> YOUR BUSINESS</div><h2>Let’s set the scene.</h2>
    <p class="subtitle">Tell us a little about your business. Your 14-day trial starts when you finish this step.</p>
    <form id="business-form">${field('Business name', 'businessName', 'text', 'minlength="2" maxlength="100" placeholder="e.g. Corner House Cafe"')}
    ${field('First location', 'locationName', 'text', 'minlength="2" maxlength="100" placeholder="e.g. Newtown"')}
    <label>Location timezone<select name="timezone">${timezoneOptions()}</select></label>
    <div class="country"><span>Country <strong>Australia</strong></span><span>Currency <strong>AUD</strong></span></div>
    <button class="primary">Create business <span>↗</span></button></form>`;
}
function workspaceView() {
  return `<div class="step-label"><span>✓</span> YOUR WORKSPACE</div><h2>${escape(workspace.name)}</h2>
    <p class="subtitle">Your foundation is ready. Manage your locations and bring your team on board.</p>
    ${businesses.length > 1 ? `<label>Business<select id="business-select">${businesses.map(b => `<option value="${escape(b.id)}" ${b.id === selected ? 'selected' : ''}>${escape(b.name)}</option>`).join('')}</select></label>` : ''}
    <div class="summary"><span>Your role<strong>${escape(workspace.role)}</strong></span><span>Trial ends<strong>${workspace.trialEndsAt ? new Date(workspace.trialEndsAt).toLocaleDateString('en-AU') : 'Not available'}</strong></span></div>
    <section><h3>Locations <span>${workspace.locations.length}</span></h3><ul class="locations">${workspace.locations.map(l => `<li><span class="location-icon">⌖</span><div><strong>${escape(l.name)}</strong><small>${escape(l.timezone)}</small></div><span class="pill">Configured</span></li>`).join('')}</ul></section>
    ${workspace.role === 'owner' ? `<details><summary>Add a location</summary><form id="location-form">
      ${field('Location name', 'name', 'text', 'minlength="2" maxlength="100"')}
      <label>Timezone<select name="timezone">${timezoneOptions()}</select></label><button class="primary">Add location</button></form></details>
      <section><h3>Invite your team</h3><p class="field-note">Invitations last 7 days and work only for the email you specify.</p>
      <form id="invite-form">${field('Staff email', 'email', 'email', 'placeholder="teammate@yourbusiness.com.au"')}
      <label>Role<select name="role"><option value="staff">Staff</option><option value="manager">Manager</option></select></label>
      <fieldset><legend>Assigned locations</legend>${workspace.locations.map(l => `<label class="checkbox"><input type="checkbox" name="locationIds" value="${escape(l.id)}">${escape(l.name)}</label>`).join('')}</fieldset>
      <button class="primary">Create invitation link <span>↗</span></button></form>
      <div id="invite-link"></div></section>
      <section><h3>Recent invitations</h3>${workspace.invitations.length ? `<ul class="invitations">${workspace.invitations.map(i => `<li><div><strong>${escape(i.email)}</strong><small>${escape(i.role)} · ${escape(i.status)}</small></div>${i.status === 'pending' ? `<div><button class="text-button" data-copy="${escape(i.id)}">Copy link</button><button class="text-button" data-revoke="${escape(i.id)}">Revoke</button></div>` : ''}</li>`).join('')}</ul>` : '<p class="field-note">No invitations yet.</p>'}</section>` : ''}
    <section><h3>Screens</h3><ul class="locations">${(workspace.screens ?? []).map(s => `<li><div><strong>${escape(s.name)}</strong><small>${escape(workspace.locations.find(l => l.id === s.locationId)?.name)} · ${s.active ? 'Paired' : 'Revoked'}</small></div>${s.active && workspace.role === 'owner' ? `<button class="text-button" data-revoke-screen="${escape(s.deviceId)}">Revoke access</button>` : ''}</li>`).join('')}</ul>
    <button class="text-button" id="refresh-screens">Refresh screen status</button>
    ${(workspace.screens ?? []).filter(s => s.active).map(screenSettingsView).join('')}
    ${workspace.role === 'owner' ? `<details><summary>Pair a display</summary><p class="field-note">Open <a href="/display.html" target="_blank" rel="noopener">the display page</a> on your screen, then enter its code here. Codes expire after ten minutes.</p>
    <form id="pair-form">${field('Display code', 'code', 'text', 'pattern="[A-Fa-f0-9]{10}" minlength="10" maxlength="10" autocomplete="off"')}
    ${field('Screen name', 'name', 'text', 'minlength="2" maxlength="100" placeholder="e.g. Front counter"')}
    <label>Location<select name="locationId">${workspace.locations.map(l => `<option value="${escape(l.id)}">${escape(l.name)}</option>`).join('')}</select></label>
    <button class="primary">Pair display</button></form></details>` : ''}</section>
    ${workspace.role === 'owner' ? `<section><h3>Media library</h3>
    <p class="field-note">JPEG, PNG or WebP up to 20 MiB. Validate still images before assigning them to a screen. MP4/WebM uploads up to 100 MiB remain quarantined; video playback is not available yet.</p>
    <button class="text-button" id="load-media">Refresh library</button>
    <button class="text-button" id="cleanup-media">Clean expired uploads</button>
    <p class="field-note">Abandoned or rejected uploads can be removed eight days after expiry to free your allowance. Successfully uploaded media is kept.</p>
    <form id="media-form"><label>Choose an image or video<input name="file" type="file" required accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"></label>
    <button class="primary">Upload media</button><p id="upload-progress" role="status"></p></form>
    <ul class="locations">${mediaItems.map(m => `<li><div><strong>${escape(m.name)}</strong><small>${escape((m.size / 1024 / 1024).toFixed(2))} MiB · ${escape(m.status === 'ready' ? 'Ready for screens' : m.status)}</small>${m.validationError ? `<small>${escape(m.validationError)}</small>` : ''}</div>${m.status === 'uploading' ? `<button class="text-button" data-complete-media="${escape(m.id)}">Confirm uploaded file</button>` : ''}${m.canValidate ? `<button class="text-button" data-validate-media="${escape(m.id)}">Validate image</button>` : ''}</li>`).join('')}</ul></section>` : ''}
    <div class="notice">Refresh the library to choose a validated image in each screen’s settings. Displays require an internet connection to keep playback authorized. Video playback, ordering and AI are coming in upcoming milestones.</div>`;
}
function screenSettingsView(s) {
  const choices = mediaItems.filter(m => m.status === 'ready');
  if (s.mediaId && !choices.some(m => m.id === s.mediaId)) choices.push({ id: s.mediaId, name: 'Current assigned image' });
  const recent = s.reportedAt && Date.now() - s.reportedAt < 120000;
  const state = !s.reportedAt ? 'Waiting for display' : !recent ? 'No recent report'
    : s.deviceState === 'error' ? 'Display reports an error'
    : s.appliedVersion === s.version ? 'Applied' : 'Pending';
  const options = (items, selected) => items.map(([value, label]) =>
    `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
  return `<details><summary>${escape(s.name)} · ${state}</summary>
    <p class="field-note">Saved version ${escape(s.version)} · Reported version ${escape(s.appliedVersion)}${s.reportedAt ? ` · Last report ${escape(new Date(s.reportedAt).toLocaleString('en-AU'))}` : ''}</p>
    ${workspace.role === 'owner' ? `<form data-settings="${escape(s.id)}">
    <label>Orientation<select name="orientation">${options([['landscape', 'Landscape (0°)'], ['portrait', 'Portrait (90° clockwise)'], ['landscape-flipped', 'Landscape reversed (180°)'], ['portrait-flipped', 'Portrait reversed (270° clockwise)']], s.orientation)}</select></label>
    <label>Scale<select name="scaleType">${options([['fit', 'Fit · show the whole image'], ['fill', 'Fill · crop to cover'], ['stretch', 'Stretch / Fit XY · may distort']], s.scaleType)}</select></label>
    <label>Content<select name="mediaId"><option value="">Calibration card</option>${choices.map(m => `<option value="${escape(m.id)}" ${m.id === s.mediaId ? 'selected' : ''}>${escape(m.name)}</option>`).join('')}</select></label>
    <p class="field-note">Rotation is relative to the device’s normal display. Settings apply when the display is connected. Save does not mean applied.</p>
    <button class="primary">Save screen settings</button></form>` : `<p>${escape(s.orientation)} · ${escape(s.scaleType)}</p>`}</details>`;
}
function invitationUrl(id) {
  return `${location.origin}${location.pathname}#${new URLSearchParams({ businessId: selected, invitationId: id })}`;
}
function bind(id, handler) { document.getElementById(id)?.addEventListener('click', handler); }
function form(id, handler) {
  document.getElementById(id)?.addEventListener('submit', event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    action(() => handler(values, event.currentTarget));
  });
}
function render() {
  root.innerHTML = shell(!user ? authView() : !user.emailVerified ? verifyView()
    : !workspaceLoaded ? '<h2>Open your workspace.</h2><p class="subtitle">Load your business memberships to continue.</p><button id="retry-workspace" class="primary">Load workspace ↗</button>'
    : invite || !workspace ? setupView() : workspaceView());
  bind('retry-workspace', () => action(refresh));
  bind('refresh-screens', () => action(refresh));
  bind('load-media', () => action(async () => {
    mediaItems = (await call('listMedia', { businessId: selected })).items;
  }));
  bind('cleanup-media', () => action(async () => {
    const result = await call('cleanupMedia', { businessId: selected });
    mediaItems = (await call('listMedia', { businessId: selected })).items;
    message = `${result.removed} expired uploads cleaned.`;
  }));
  form('media-form', async values => {
    const file = values.get('file');
    if (!file?.size) throw { code: 'invalid-argument', message: 'Choose a file first.' };
    const reservation = await requestWithRetryId('beginMediaUpload', {
      businessId: selected, name: file.name, contentType: file.type, size: file.size,
    });
    const grant = await call('authorizeMediaUpload', { businessId: selected, mediaId: reservation.mediaId });
    await uploadMedia(file, grant, percent => {
      const progress = document.querySelector('#upload-progress');
      if (progress) progress.textContent = `Uploading ${percent}%`;
    });
    const result = await call('completeMediaUpload', { businessId: selected, mediaId: reservation.mediaId });
    mediaItems = (await call('listMedia', { businessId: selected })).items;
    message = result.status === 'uploaded' ? 'Upload received. Playback validation is still pending.' : 'File rejected: its contents did not match the declared format.';
  });
  document.querySelectorAll('[data-complete-media]').forEach(button => button.addEventListener('click', () => action(async () => {
    await call('completeMediaUpload', { businessId: selected, mediaId: button.dataset.completeMedia });
    mediaItems = (await call('listMedia', { businessId: selected })).items;
  })));
  document.querySelectorAll('[data-validate-media]').forEach(button => button.addEventListener('click', () => action(async () => {
    const result = await call('validateMedia', { businessId: selected, mediaId: button.dataset.validateMedia });
    mediaItems = (await call('listMedia', { businessId: selected })).items;
    message = result.status === 'ready' ? 'Image validated. Choose it in your screen settings.' : 'Image validation failed. Check the library for details.';
  })));
  document.querySelectorAll('[data-settings]').forEach(element => element.addEventListener('submit', event => {
    event.preventDefault();
    const screen = workspace.screens.find(s => s.id === element.dataset.settings);
    const values = Object.fromEntries(new FormData(element));
    action(async () => {
      await call('updateScreenSettings', { businessId: selected, locationId: screen.locationId,
        screenId: screen.id, expectedVersion: screen.version, ...values, mediaId: values.mediaId || null });
      await refresh(); message = 'Settings saved. Refresh screen status to check the display acknowledgement.';
    });
  }));
  bind('signup', () => { mode = 'signup'; message = ''; render(); });
  bind('login', () => { mode = 'login'; message = ''; render(); });
  bind('signout', () => action(async () => { selected = ''; workspace = null; sessionStorage.removeItem('businessId'); await signOut(auth); }));
  form('auth-form', async values => {
    if (!auth) return;
    if (mode === 'signup') {
      const result = await createUserWithEmailAndPassword(auth, values.get('email'), values.get('password'));
      await sendEmailVerification(result.user);
      message = 'Verification email sent.';
    } else await signInWithEmailAndPassword(auth, values.get('email'), values.get('password'));
  });
  bind('reset', () => action(async () => {
    if (!auth) return;
    const input = document.querySelector('[name="email"]');
    if (!input.reportValidity()) return;
    await sendPasswordResetEmail(auth, input.value);
    message = 'If this account can receive a reset email, instructions are on their way.';
  }));
  bind('resend', () => action(async () => { await sendEmailVerification(user); message = 'Verification email sent. Check your spam folder too.'; }));
  bind('check-email', () => action(async () => {
    await reload(user); await getIdToken(user, true);
    if (!user.emailVerified) { message = 'Your email is not verified yet.'; return; }
    await refresh();
  }));
  form('business-form', async values => {
    const result = await call('provisionBusiness', Object.fromEntries(values));
    selected = result.businessId; await refresh();
  });
  form('location-form', async values => {
    await requestWithRetryId('createLocation', { ...Object.fromEntries(values), businessId: selected });
    await refresh();
  });
  form('pair-form', async values => {
    await call('claimScreen', { ...Object.fromEntries(values), code: values.get('code').toUpperCase(), businessId: selected });
    await refresh(); message = 'Display claimed. It will connect automatically.';
  });
  document.querySelectorAll('[data-revoke-screen]').forEach(button => button.addEventListener('click', () => action(async () => {
    await call('revokeScreen', { businessId: selected, deviceId: button.dataset.revokeScreen });
    await refresh(); message = 'Display access revoked.';
  })));
  form('invite-form', async values => {
    await requestWithRetryId('createInvitation', {
      businessId: selected,
      email: values.get('email'), role: values.get('role'), locationIds: values.getAll('locationIds'),
    });
    await refresh(); message = 'Invitation created. Use Copy link below and share it with your teammate. No email has been sent.';
  });
  bind('accept', () => action(async () => {
    const result = await call('acceptInvitation', { businessId: invite.businessId, invitationId: invite.invitationId });
    invite = null; sessionStorage.removeItem('invitation'); selected = result.businessId; await refresh();
  }));
  bind('dismiss', () => { invite = null; sessionStorage.removeItem('invitation'); render(); });
  document.getElementById('business-select')?.addEventListener('change', event => {
    selected = event.target.value; mediaItems = []; action(refresh);
  });
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', () => action(async () => {
    const url = invitationUrl(button.dataset.copy);
    try { await navigator.clipboard.writeText(url); message = 'Invitation link copied. Share it with the invited teammate.'; }
    catch { message = `Copy this invitation link: ${url}`; }
  })));
  document.querySelectorAll('[data-revoke]').forEach(button => button.addEventListener('click', () => action(async () => {
    await call('revokeInvitation', { businessId: selected, invitationId: button.dataset.revoke }); await refresh();
  })));
}
render();
if (auth) onAuthStateChanged(auth, async current => {
  user = current; workspace = null; businesses = []; mediaItems = []; workspaceLoaded = false;
  if (user?.emailVerified) {
    try { await refresh(); }
    catch (error) { selected = ''; message = safeError(error); }
  }
  render();
});
