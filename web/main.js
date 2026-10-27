import { featuredProductView, bindFeaturedProduct } from './featured-product.js';
import { layoutEditor, bindLayout, readLogo } from './layout-editor.js';
import { assistantForm, bindAssistantForm, selectAdvertForPlanning } from './assistant-form.js';
import { imageCreationView, bindImageCreation } from './image-creation.js';
import { marketView } from './market-view.js';
import { foodMenuView, bindFoodMenu } from './food-menu.js';
import { screenHelpView } from './screen-help.js';
import { advertisersView } from './advertisers.js';
import { clientLink } from './client-link.js';
import { submissionList } from './submission-view.js';
import { labelMedia } from './media-labels.js';
import { closeSubmissionPreview, showSubmissionPreview } from './submission-preview.js';
import { signInWithMfa } from './mfa.js';
import { mediaReportView } from './media-report.js';
import { dashboardView, bindDashboard, screenHealth, screenAnchor } from './dashboard.js';
import { bindFormHelp, formFeedback } from './form-help.js';
import { playlistEditor, bindPlaylist, readPlaylist } from './playlist-editor.js';
import './style.css';
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
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
let workspaceCheckedAt = Date.now();
let mediaItems = [];
let clearMenuPreview = () => {};
let clearImagePreview = () => {};
let mediaReport;
let advertisers;
let advertiserInvitation;
let advertiserSubmissions;
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
const call = async (name, data) => (await httpsCallable(functions, name, { timeout: name === 'generateAdvertImage' ? 220000 : ['validateMedia', 'validateSubmission'].includes(name) ? 190000 : 70000 })(data)).data;
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
async function action(task, form = document.activeElement?.closest('form')) {
  if (busy) return;
  busy = true;
  const controls = [...root.querySelectorAll('button, input, select')].map(control => [control, control.disabled]);
  controls.forEach(([control]) => { control.disabled = true; });
  form?.setAttribute('aria-busy', 'true');
  if (form) formFeedback(form, form.id === 'media-form' ? 'Uploading your file. Please keep this page open…' : 'Please wait while we complete this step…');
  let failed = false;
  try { message = ''; await task(); }
  catch (error) {
    failed = true; message = safeError(error);
    // Preserve the actual form, including selected files and playlist rows, on failure.
    if (form?.isConnected) formFeedback(form, message, true);
    else { render(); document.querySelector('#feedback')?.focus(); }
  } finally {
    busy = false;
    controls.forEach(([control, disabled]) => { control.disabled = disabled; });
    form?.removeAttribute('aria-busy');
    if (!failed) { render(); if (message) document.querySelector('#feedback')?.focus(); }
  }
}
async function refresh() {
  const result = await call('getWorkspace', { businessId: selected });
  businesses = result.businesses;
  workspace = result.workspace;
  workspaceCheckedAt = Date.now();
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
    <div class="content">${message ? `<div class="notice" id="feedback" tabindex="-1" role="status" aria-live="polite">${escape(message)}</div>` : ''}${content}</div>
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
      <button type="button" class="text-button password-toggle" data-password-toggle aria-pressed="false">Show password</button>
      ${signup ? '<p class="field-note">Use at least 12 characters. A few unrelated words make a memorable password.</p>' : ''}
      ${!signup ? '<button type="button" class="text-button forgot" id="reset">Forgot password?</button>' : '<p class="field-note">We’ll ask you to verify your email before setting up your business.</p>'}
      <button class="primary" ${configurationError ? 'disabled' : ''}>${signup ? 'Create your account' : 'Sign in'} <span>↗</span></button>
    </form>
    ${!invite ? '<div class="trial"><span class="trial-icon">✦</span><div><strong>Your first 14 days are on us.</strong><p>Try the available signage features. No payment method required.<br>POS, ordering and interactive AI are planned for later releases.</p></div></div>' : '<p class="field-note">Joining a team does not start a new business trial.</p>'}`;
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
    <form id="business-form">${field('Business name', 'businessName', 'text', 'minlength="2" maxlength="100" autocomplete="organization" placeholder="e.g. Corner House Cafe"')}
    ${field('First location', 'locationName', 'text', 'minlength="2" maxlength="100" placeholder="e.g. Newtown"')}
    <p class="field-note">Give your location a name your team will recognise, such as a suburb or branch.</p>
    <label>Location timezone<select name="timezone">${timezoneOptions()}</select></label>
    <div class="country"><span>Country <strong>Australia</strong></span><span>Currency <strong>AUD</strong></span></div>
    <button class="primary">Create business <span>↗</span></button></form>`;
}
function workspaceView() {
  return `<div class="step-label"><span>✓</span> YOUR WORKSPACE</div><h2>${escape(workspace.name)}</h2>
    <p class="subtitle">Check your screens, manage your media and keep your business up to date.</p>
    ${businesses.length > 1 ? `<label>Business<select id="business-select">${businesses.map(b => `<option value="${escape(b.id)}" ${b.id === selected ? 'selected' : ''}>${escape(b.name)}</option>`).join('')}</select></label>` : ''}
    <div class="summary"><span>Your role<strong>${escape(workspace.role)}</strong></span><span>Trial ends<strong>${workspace.trialEndsAt ? new Date(workspace.trialEndsAt).toLocaleDateString('en-AU') : 'Not available'}</strong></span></div>
    ${dashboardView(workspace, workspaceCheckedAt, escape)}
    ${marketView(workspace, escape)}
    ${workspace.role === 'owner' ? assistantForm(workspace, mediaItems, escape) : ''}
    ${workspace.role === 'owner' ? imageCreationView(mediaItems) : ''}
    ${workspace.role === 'owner' ? featuredProductView(workspace.locations, escape) : ''}
    ${workspace.role === 'owner' ? foodMenuView(workspace.locations, escape) : ''}
    <section id="locations-section"><h3>Locations <span>${workspace.locations.length}</span></h3><ul class="locations">${workspace.locations.map(l => `<li><span class="location-icon">⌖</span><div><strong>${escape(l.name)}</strong><small>${escape(l.timezone)}</small></div><span class="pill">Configured</span></li>`).join('')}</ul></section>
    ${workspace.role === 'owner' ? `<details><summary>Add a location</summary><form id="location-form">
      ${field('Location name', 'name', 'text', 'minlength="2" maxlength="100"')}
      <label>Timezone<select name="timezone">${timezoneOptions()}</select></label><button class="primary">Add location</button></form></details>
      <section><h3>Invite your team</h3><p class="field-note">Invitations last 7 days and work only for the email you specify.</p>
      <form id="invite-form">${field('Staff email', 'email', 'email', 'placeholder="teammate@yourbusiness.com.au"')}
      <p class="field-note">Create a link to share yourself. We won’t send an email automatically.</p><label>Role<select name="role" aria-describedby="role-help"><option value="staff">Staff</option><option value="manager">Manager</option></select></label>
      <p class="field-note" id="role-help">Staff and managers currently have access to their assigned locations. Screen and media changes require the business owner.</p>
      <fieldset><legend>Choose at least one location</legend>${workspace.locations.map(l => `<label class="checkbox"><input type="checkbox" name="locationIds" value="${escape(l.id)}">${escape(l.name)}</label>`).join('')}</fieldset>
      <button class="primary">Create invitation link <span>↗</span></button></form>
      <div id="invite-link"></div></section>
      <section><h3>Recent invitations</h3>${workspace.invitations.length ? `<ul class="invitations">${workspace.invitations.map(i => `<li><div><strong>${escape(i.email)}</strong><small>${escape(i.role)} · ${escape(i.status)}</small></div>${i.status === 'pending' ? `<div><button class="text-button" data-copy="${escape(i.id)}">Copy link</button><button class="text-button" data-revoke="${escape(i.id)}">Revoke</button></div>` : ''}</li>`).join('')}</ul>` : '<p class="field-note">No invitations yet.</p>'}</section>` : ''}
    <section id="screens-section"><h3>Screens</h3><ul class="locations">${(workspace.screens ?? []).map(s => `<li><div><strong>${escape(s.name)}</strong><small>${escape(workspace.locations.find(l => l.id === s.locationId)?.name)} · ${s.active ? 'Paired' : 'Revoked'}</small></div>${s.active && workspace.role === 'owner' ? `<button class="text-button" data-revoke-screen="${escape(s.deviceId)}">Revoke access</button>` : ''}</li>`).join('')}</ul>
    <button class="text-button" id="refresh-screens">Refresh screen status</button>
    ${screenHelpView()}
    ${(workspace.screens ?? []).filter(s => s.active).map(screenSettingsView).join('')}
    ${workspace.role === 'owner' ? `<details id="pair-display"><summary>Pair a display</summary><p class="field-note">Open the Discrete Signage Display Android app or <a href="/display.html" target="_blank" rel="noopener">the browser display page</a> on your screen, then enter its code here. Codes expire after ten minutes.</p>
    <form id="pair-form">${field('Display code', 'code', 'text', 'pattern="[A-Fa-f0-9]{10}" minlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. A1B2C3D4E5" title="Enter the 10-character code shown on your display. Spaces and dashes are removed automatically."')}
    ${field('Screen name', 'name', 'text', 'minlength="2" maxlength="100" placeholder="e.g. Front counter"')}
    <label>Location<select name="locationId">${workspace.locations.map(l => `<option value="${escape(l.id)}">${escape(l.name)}</option>`).join('')}</select></label>
    <button class="primary">Pair display</button></form></details>` : ''}</section>
    ${workspace.role === 'owner' ? advertisersView(advertisers?.businessId === selected ? advertisers : null, escape, advertiserInvitation?.businessId === selected ? advertiserInvitation : null) : ''}
    ${workspace.role === 'owner' ? `<section><h3>Client submissions</h3><p>Validate each file, preview the safe copy, then approve or decline it. Approved files enter your library; you choose their playlists and schedule.</p><p>Expired uploads, failed files and declined submissions can be cleaned eight days after upload expiry. This frees submission allowance. Approved and withdrawn library files are retained.</p><button id="load-advertiser-submissions" class="secondary">Refresh client submissions</button>${submissionList(advertiserSubmissions?.businessId === selected ? advertiserSubmissions.items : undefined, escape, advertisers?.businessId === selected ? advertisers.items : [])}</section>` : ''}
    ${workspace.role === 'owner' ? `<section id="media-section"><h3>Media library</h3>
    <p class="field-note">1. Upload your file. 2. Choose “Check for playback”. 3. Add it to a screen’s playlist. Match the reference shown below when filenames are identical.</p>
    <details><summary>Supported files and limits</summary><p class="field-note">Validate images or short videos before assigning them to a screen. Images: JPEG/PNG/WebP up to 20 MiB. Video playback: MP4/WebM up to 20 MiB, 60 seconds, 1080p and 30 fps; muted. Larger videos (up to 100 MiB) can be stored but cannot play yet.</p></details>
    <button class="text-button" id="load-media">Refresh library</button>
    <button class="text-button" id="cleanup-media">Clean expired uploads</button>
    <p class="field-note">Abandoned or rejected uploads can be removed eight days after expiry to free your allowance. Successfully uploaded media is kept.</p>
    <form id="media-form"><label>Choose an image or video<input name="file" type="file" required aria-describedby="file-help" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"></label>
    <p class="field-note" id="file-help" aria-live="polite">Choose one file to upload. Your original is kept private.</p>
    <button class="primary">Upload file</button><p id="upload-progress" role="status"></p></form>
    <ul class="locations">${mediaItems.map(m => `<li><div><strong>${escape(m.name)}</strong><small>${escape(m.source)} · Reference ${escape(m.reference)}</small><small>${escape((m.size / 1024 / 1024).toFixed(2))} MiB · ${escape(m.status === 'ready' ? 'Ready for screens' : m.status)}</small>${m.validationError ? `<small>${escape(m.validationError)}</small>` : ''}</div>${m.status === 'uploading' ? `<button class="text-button" data-complete-media="${escape(m.id)}">Confirm uploaded file</button>` : ''}${m.canValidate ? `<button class="text-button" data-validate-media="${escape(m.id)}">Check for playback</button>` : ''}</li>`).join('')}</ul></section>` : ''}
    ${workspace.role === 'owner' ? mediaReportView(workspace.locations, mediaItems.filter(m => m.status === 'ready'), mediaReport?.businessId === selected ? mediaReport : null, escape) : ''}
    <div class="notice">Refresh the library to choose validated media in each screen’s settings. For connection and restart help, open “Screen setup, offline playback and restarting” under Screens. Ordering and AI are coming in upcoming milestones.</div>`;
}
function screenSettingsView(s) {
  const choices = mediaItems.filter(m => m.status === 'ready');
  const items = s.playlist ?? (s.mediaId ? [{ mediaId: s.mediaId, duration: 10 }] : []);
  for (const item of [...items, ...(s.secondaryPlaylist ?? []), ...(s.logo ? [s.logo] : [])]) if (!choices.some(m => m.id === item.mediaId)) choices.push({ id: item.mediaId, name: 'Assigned media · refresh library for name' });
  const state = screenHealth(s, workspaceCheckedAt).label;
  const options = (items, selected) => items.map(([value, label]) =>
    `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
  return `<details id="${escape(screenAnchor(s))}"><summary>${escape(s.name)} · ${state}</summary>
    <p class="field-note">Saved changes: ${s.appliedVersion === s.version ? 'applied on screen' : 'waiting for the screen'}${s.reportedAt ? ` · Last report ${escape(new Date(s.reportedAt).toLocaleString('en-AU'))}` : ''}</p>
    ${workspace.role === 'owner' ? `<form data-settings="${escape(s.id)}">
    <label>Orientation<select name="orientation">${options([['landscape', 'Landscape (0°)'], ['portrait', 'Portrait (90° clockwise)'], ['landscape-flipped', 'Landscape reversed (180°)'], ['portrait-flipped', 'Portrait reversed (270° clockwise)']], s.orientation)}</select></label>
    <label>Scale<select name="scaleType">${options([['fit', 'Fit · show the whole image'], ['fill', 'Fill · crop to cover'], ['stretch', 'Stretch / Fit XY · may distort']], s.scaleType)}</select></label>
    <label>Interactive product overlay<select name="interactiveEnabled">${options([['false', 'Off (default)'], ['true', 'On · approved featured product']], String(s.interactiveEnabled === true))}</select></label>
    <label>Avatar<select name="interactiveAvatar">${options([['robot', 'Friendly robot (default)'], ['cat', 'Playful cat']], s.interactiveAvatar ?? 'robot')}</select></label>
    <p class="field-note">Requires Interactive AI access and a saved available product for this location. Supported Android displays show a touch/remote product invitation while adverts continue. This does not turn on the camera. Test the layout before enabling it for customers.</p>
    ${layoutEditor(s, choices, escape)}
    <p class="field-note">Advert schedules use ${escape(workspace.locations.find(l => l.id === s.locationId)?.timezone ?? 'the location timezone')}. Scheduled adverts stop at their end time, even during a video. A region with no eligible items has no advert to show. Offline Android playback stops the whole screen at the next schedule change and needs internet to load the next eligible playlist.</p>
    <div data-primary>${playlistEditor(items, choices, escape, "Playlist 1 · full screen / left / top")}</div>
    <div data-secondary>${playlistEditor(s.secondaryPlaylist ?? [], choices, escape, "Playlist 2 · right / bottom")}</div>
    <label>Transition<select name="transition">${options([["fade", "Fade (default)"], ["none", "None · instant cut"], ["slide", "Slide"], ["zoom", "Zoom"]], s.transition ?? "fade")}</select></label>
    <p class="field-note">The screen needs internet to receive these changes. After saving, refresh its status and look for Applied, then check the display itself. An offline screen may keep playing its previous downloaded playlist until its authorization ends.</p>
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
    action(() => handler(values, event.currentTarget), event.currentTarget);
  });
}
function render() {
  clearImagePreview(); clearImagePreview = () => {};
  clearMenuPreview(); clearMenuPreview = () => {};
  closeSubmissionPreview();
  root.innerHTML = shell(!user ? authView() : !user.emailVerified ? verifyView()
    : !workspaceLoaded ? '<h2>Open your workspace.</h2><p class="subtitle">Load your business memberships to continue.</p><button id="retry-workspace" class="primary">Load workspace ↗</button>'
    : invite || !workspace ? setupView() : workspaceView());
  bindFormHelp(root);
  bind('retry-workspace', () => action(refresh));
  bind('refresh-screens', () => action(refresh));
  bind('refresh-overview', () => action(refresh));
  bindDashboard(root);
  if (workspace?.role === 'owner') bindAssistantForm(root, workspace, selected, call, mediaItems);
  if (workspace?.role === 'owner') {
    const imageBusiness = selected, imageViewer = user?.uid;
    clearImagePreview = bindImageCreation(root, selected, call, async mediaId => {
      const result = await call('listMedia', { businessId: imageBusiness });
      if (selected !== imageBusiness || user?.uid !== imageViewer) return;
      mediaItems = labelMedia(result.items);
      render();
      selectAdvertForPlanning(root, mediaId);
    });
  }
  if (workspace?.role === 'owner') bindFeaturedProduct(root, selected, call, escape);
  if (workspace?.role === 'owner') clearMenuPreview = bindFoodMenu(root, selected, call, escape) ?? (() => {});
  const loadAdvertisers = async () => { advertisers = { ...(await call('listAdvertisers', { businessId: selected })), businessId: selected }; };
  bind('load-advertisers', () => action(loadAdvertisers));
  bind('load-advertiser-submissions', () => action(async () => {
    advertiserSubmissions = { ...(await call('listAdvertiserSubmissions', { businessId: selected })), businessId: selected };
  }));
  const reloadSubmissions = async () => {
    advertiserSubmissions = { ...(await call('listAdvertiserSubmissions', { businessId: selected })), businessId: selected };
  };
  const afterSubmissionChange = async text => {
    advertiserSubmissions = undefined;
    message = text;
    try { await reloadSubmissions(); } catch { message += ' Refresh submissions to see the latest status.'; }
    mediaItems = [];
  };
  root.querySelectorAll('[data-cleanup-submission]').forEach(form => {
    form.onsubmit = event => {
      event.preventDefault();
      action(async () => {
        const result = await call('cleanupSubmission', { businessId: selected,
          submissionId: form.dataset.cleanupSubmission, expectedVersion: Number(form.dataset.version) });
        await afterSubmissionChange(result.removed ? 'Files deleted. One client submission slot and its reserved storage allowance have been recovered.'
          : 'This submission was already cleaned. Its allowance was recovered only once.');
      }, form);
    };
  });
  root.querySelectorAll('[data-validate-submission]').forEach(button => {
    button.onclick = () => action(async () => {
      button.textContent = 'Checking file…';
      const result = await call('validateSubmission', { businessId: selected, submissionId: button.dataset.validateSubmission });
      await afterSubmissionChange(result.validated ? 'Validation passed. Preview the file before deciding.' : 'Validation failed. This file cannot be approved.');
    });
  });
  root.querySelectorAll('[data-preview-submission]').forEach(button => {
    button.onclick = async () => {
      if (busy) return;
      busy = true; button.disabled = true;
      const businessId = selected, viewer = user?.uid;
      try {
        const result = await call('previewSubmission', { businessId, submissionId: button.dataset.previewSubmission });
        if (selected === businessId && user?.uid === viewer && button.isConnected) showSubmissionPreview(result);
      } catch (error) { message = safeError(error); render(); }
      finally { busy = false; button.disabled = false; }
    };
  });
  root.querySelectorAll('[data-review-submission]').forEach(form => {
    const reason = form.elements.reason;
    form.elements.decision.onchange = () => { reason.required = form.elements.decision.value !== 'approve'; };
    form.onsubmit = event => {
      event.preventDefault();
      const values = new FormData(form);
      action(async () => {
        await call('reviewSubmission', { businessId: selected, submissionId: form.dataset.reviewSubmission,
          expectedVersion: Number(form.dataset.version), decision: values.get('decision'), reason: values.get('reason').trim() });
        await afterSubmissionChange('Decision saved. Refresh the media library to see approved files.');
      }, form);
    };
  });
  form('advertiser-invite-form', async values => {
    const advertiserId = values.get('advertiserId'), email = values.get('email').trim();
    const result = await requestWithRetryId('inviteAdvertiser', { businessId: selected, advertiserId, email });
    advertiserInvitation = { businessId: selected, advertiserId, email, expiresAt: result.expiresAt,
      url: clientLink(location.origin, { businessId: selected, advertiserId, invitationId: result.invitationId }) };
    message = 'Client invitation ready. Copy the link below and share it with your client.';
  });
  bind('copy-advertiser-link', async () => {
    const status = document.querySelector('#advertiser-copy-status');
    try { await navigator.clipboard.writeText(advertiserInvitation.url); status.textContent = 'Link copied.'; }
    catch { status.textContent = 'Select the link above and copy it manually.'; }
  });
  form('advertiser-form', async values => {
    await requestWithRetryId('createAdvertiser', { businessId: selected, name: values.get('name') });
    await loadAdvertisers(); message = 'Client record created. No account access has been granted.';
  });
  root.querySelectorAll('[data-advertiser]').forEach(button => {
    button.onclick = () => action(async () => {
      const result = await call('setAdvertiserActive', { businessId: selected, advertiserId: button.dataset.advertiser,
        expectedVersion: Number(button.dataset.version), active: button.dataset.active === 'true' });
      const record = advertisers.items.find(c => c.id === button.dataset.advertiser);
      Object.assign(record, { active: button.dataset.active === 'true', version: result.version });
      advertiserInvitation = null;
      message = record.active ? 'Client restored. Create a new invitation to give them access.' : 'Client archived. Access stopped; existing playlists are unchanged.';
    });
  });
  bind('load-media', () => action(async () => {
    mediaItems = labelMedia((await call('listMedia', { businessId: selected })).items);
  }));
  bind('cleanup-media', () => action(async () => {
    const result = await call('cleanupMedia', { businessId: selected });
    mediaItems = labelMedia((await call('listMedia', { businessId: selected })).items);
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
    mediaItems = labelMedia((await call('listMedia', { businessId: selected })).items);
    message = result.status === 'uploaded' ? 'Upload complete. Choose “Check for playback” beside your file before adding it to a playlist.' : 'File rejected: its contents did not match the declared format.';
  });
  document.querySelectorAll('[data-complete-media]').forEach(button => button.addEventListener('click', () => action(async () => {
    await call('completeMediaUpload', { businessId: selected, mediaId: button.dataset.completeMedia });
    mediaItems = labelMedia((await call('listMedia', { businessId: selected })).items);
  })));
  document.querySelectorAll('[data-validate-media]').forEach(button => button.addEventListener('click', () => action(async () => {
    const result = await call('validateMedia', { businessId: selected, mediaId: button.dataset.validateMedia });
    mediaItems = labelMedia((await call('listMedia', { businessId: selected })).items);
    message = result.status === 'ready' ? 'Media validated. Choose it in your screen settings.' : 'Media validation failed. Check the library for details.';
  })));
  document.querySelectorAll('[data-playlist-editor]').forEach(bindPlaylist);
  document.querySelectorAll('[data-settings]').forEach(bindLayout);
  document.querySelectorAll('[data-settings]').forEach(element => element.addEventListener('submit', event => {
    event.preventDefault();
    const screen = workspace.screens.find(s => s.id === element.dataset.settings);
    const values = Object.fromEntries(new FormData(element));
    action(async () => {
      await call('updateScreenSettings', { businessId: selected, locationId: screen.locationId,
        screenId: screen.id, expectedVersion: screen.version, ...values, interactiveEnabled: values.interactiveEnabled === 'true', playlist: readPlaylist(element.querySelector('[data-primary]')),
        secondaryPlaylist: values.layout === 'single' ? [] : readPlaylist(element.querySelector('[data-secondary]')), logo: readLogo(element) });
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
    } else await signInWithMfa(auth, values.get('email'), values.get('password'));
  });
  bind('reset', () => {
    if (!auth) return;
    const input = document.querySelector('[name="email"]');
    if (!input.reportValidity()) return;
    const email = input.value;
    action(async () => {
      await sendPasswordResetEmail(auth, email);
      message = 'If this account can receive a reset email, instructions are on their way.';
    });
  });
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
  form('market-form', async values => {
    await call('updateBusinessMarket', { businessId: selected, market: values.get('market') });
    await refresh(); message = 'Business type saved. Your setup guidance has been updated.';
  });
  form('pair-form', async values => {
    await call('claimScreen', { ...Object.fromEntries(values), code: values.get('code').toUpperCase(), businessId: selected });
    await refresh(); message = 'Display claimed. It will connect automatically.';
  });
  form('media-report-form', async values => {
    const input = { businessId: selected, ...Object.fromEntries(values) };
    mediaReport = { ...await call('getMediaReport', input), ...input };
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
  user = current; workspace = null; businesses = []; mediaItems = []; mediaReport = null; advertisers = null; advertiserInvitation = null; advertiserSubmissions = null; workspaceLoaded = false;
  if (user?.emailVerified) {
    try { await refresh(); }
    catch (error) { selected = ''; message = safeError(error); }
  }
  render();
});
