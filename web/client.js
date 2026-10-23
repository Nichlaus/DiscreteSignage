import './style.css';
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { initializeAuth, browserSessionPersistence, onAuthStateChanged, createUserWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, signOut, reload, getIdToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInWithMfa, mfaError } from './mfa.js';
import { bindFormHelp, formFeedback } from './form-help.js';
import { parseClientLink, clientLink } from './client-link.js';
import { uploadMedia } from './media-upload.js';
import { submissionList } from './submission-view.js';

const root = document.querySelector('#client');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let link = parseClientLink(location.hash || sessionStorage.getItem('advertiser-entry') || '');
if (location.hash) {
  sessionStorage.removeItem('advertiser-entry');
  history.replaceState(null, '', location.pathname);
}
if (link) sessionStorage.setItem('advertiser-entry', new URLSearchParams(link).toString());
let auth, functions, user, workspace, busy = false, signup = false, message = '', ready = false;
let submissions;
const errorMessage = error => ({
  'functions/permission-denied': 'This link or client access is unavailable for your account. Check the invited email, or ask the business for a new invitation.',
  'functions/failed-precondition': 'This workspace is not available right now. Ask the business to check its trial and client access.',
  'functions/unauthenticated': 'Please sign out and sign in again.',
  'functions/resource-exhausted': 'Your submission allowance is full. Contact the business.',
  'functions/invalid-argument': 'Choose a supported image or video up to 20 MiB.',
  'auth/email-already-in-use': 'This email already has an account. Choose Sign in instead.',
  'auth/weak-password': 'Use a password with at least 12 characters.',
  'auth/invalid-email': 'Enter a valid email address.',
})[error.code] ?? mfaError(error);
const call = async (name, data) => (await httpsCallable(functions, name)(data)).data;
async function run(task, form) {
  if (busy) return;
  const startingUser = user?.uid;
  busy = true;
  const controls = [...root.querySelectorAll('input, button')];
  controls.forEach(c => { c.disabled = true; });
  if (form) formFeedback(form, 'Please wait…');
  let failed = false;
  try { message = ''; await task(); }
  catch (error) {
    failed = true; message = errorMessage(error);
    if (form?.isConnected && startingUser === user?.uid) formFeedback(form, message, true);
    else { render(); root.querySelector('[role="status"]')?.focus(); }
  } finally {
    busy = false; controls.forEach(c => { c.disabled = false; });
    if (!failed) { render(); root.querySelector('[role="status"]')?.focus(); }
  }
}
function render() {
  const content = !ready ? '<p>Checking your session…</p>' : !link
    ? '<h2>Open your client invitation.</h2><p>Ask the business advertising your content for a client invitation link. Open the complete link in this browser.</p>'
    : !user ? `<h2>${signup ? 'Create your client account' : 'Welcome to your client workspace'}</h2>
      <p>Use the email address the business invited. This does not create a business or start a new trial.</p>
      <div class="tabs"><button id="login" class="${!signup ? 'active' : ''}">Sign in</button><button id="signup" class="${signup ? 'active' : ''}">Create account</button></div>
      <form id="client-auth"><label>Invited email<input name="email" type="email" autocomplete="email" required></label>
      <label>Password<input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" ${signup ? 'minlength="12"' : ''} required></label>
      <button type="button" class="text-button" data-password-toggle aria-pressed="false">Show password</button>
      <p class="field-note">${signup ? 'Use at least 12 characters. Verify your email before accepting the invitation.' : 'Already have a Discrete Signage account? Use the same sign-in details.'}</p>
      <button class="primary">${signup ? 'Create account' : 'Sign in'}</button>
      ${!signup ? '<button type="button" id="reset" class="text-button">Forgot password?</button>' : ''}</form>`
    : !user.emailVerified ? `<h2>Verify your email</h2><p>Open the verification email sent to <strong>${escape(user.email)}</strong>, then return here.</p><button id="verify" class="primary">I’ve verified my email</button><button id="resend" class="secondary">Send verification email</button>`
    : link.invitationId ? `<h2>Accept your client invitation</h2><p>Signed in as <strong>${escape(user.email)}</strong>. This must match the email the business invited.</p><p>You’ll access only your assigned client workspace. You can submit files for the business to validate and approve. You won’t receive business management, screen controls or publishing access.</p><button id="accept" class="primary">Accept invitation</button><button id="open" class="secondary">Already accepted? Open workspace</button>`
    : workspace ? `<h2>${escape(workspace.name)}</h2><p class="notice">Your client workspace is connected.</p>
      <p>Submit an image or video for the business to review. Nothing is published automatically. The business validates the file, previews a safe copy and decides whether to approve it.</p>
      <form id="submission-form"><label>Choose your advert<input name="file" type="file" required accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"></label>
      <p class="field-note">JPG, PNG, WebP, MP4 or WebM · up to 20 MiB. For future video playback, use a clip up to 60 seconds, 1080p and 30 fps. Up to 20 submissions, including unfinished uploads.</p>
      <button class="primary">Upload for review</button><p id="submission-progress" role="status"></p></form>
      <h3>Your submissions</h3><button id="load-submissions" class="secondary">Refresh submissions</button>${submissionList(submissions, escape)}
      <p><a href="${escape(clientLink(location.origin, link))}">Your workspace link</a> — save this link for your next visit.</p><button id="open" class="secondary">Refresh access</button>`
    : '<h2>Open your client workspace</h2><p>Your access is checked each time you open it.</p><button id="open" class="primary">Open workspace</button>';
  root.innerHTML = `<main class="admin-page client-page"><a href="/">Discrete Signage</a><p class="product-tag">ADVERTISING CLIENT PORTAL</p>
    ${user ? `<p>${escape(user.email)} <button id="signout" class="text-button">Sign out / switch account</button></p>` : ''}
    ${message ? `<p class="notice" role="status" tabindex="-1">${escape(message)}</p>` : ''}${content}</main>`;
  bindFormHelp(root);
  const bind = (id, task) => root.querySelector(`#${id}`)?.addEventListener('click', () => run(task));
  bind('login', async () => { signup = false; }); bind('signup', async () => { signup = true; });
  bind('signout', () => signOut(auth));
  bind('load-submissions', async () => { submissions = (await call('listClientSubmissions', link)).items; });
  root.querySelectorAll('[data-confirm-submission]').forEach(button => button.onclick = () => run(async () => {
    const result = await call('completeClientSubmission', { ...link, submissionId: button.dataset.confirmSubmission });
    submissions = undefined;
    message = result.status === 'submitted' ? 'Upload confirmed. Awaiting validation and owner review.' : 'File rejected. Choose a supported file and try again.';
  }));
  const uploadForm = root.querySelector('#submission-form');
  uploadForm?.addEventListener('submit', event => {
    event.preventDefault();
    const file = uploadForm.elements.file.files[0];
    if (!file || file.size < 12 || file.size > 20 * 1024 ** 2 || !['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type)) {
      formFeedback(uploadForm, 'Choose a JPG, PNG, WebP, MP4 or WebM file up to 20 MiB.', true); return;
    }
    run(async () => {
      const data = { ...link, name: file.name, contentType: file.type, size: file.size };
      const key = `submission:${user.uid}:${JSON.stringify(data)}:${file.lastModified}`;
      let pending; try { pending = JSON.parse(sessionStorage.getItem(key)); } catch { /* Start a fresh request. */ }
      pending ??= { requestId: crypto.randomUUID() };
      sessionStorage.setItem(key, JSON.stringify(pending));
      if (!pending.submissionId) {
        Object.assign(pending, await call('beginClientSubmission', { ...data, requestId: pending.requestId }));
        sessionStorage.setItem(key, JSON.stringify(pending));
      }
      const scope = { ...link, submissionId: pending.submissionId };
      let grant;
      try { grant = await call('authorizeClientSubmission', scope); }
      catch (error) {
        if (error.code === 'functions/failed-precondition') sessionStorage.removeItem(key);
        throw error;
      }
      await uploadMedia(file, grant, percent => { uploadForm.querySelector('#submission-progress').textContent = `Uploading ${percent}%`; });
      const result = await call('completeClientSubmission', scope);
      sessionStorage.removeItem(key); submissions = undefined;
      message = result.status === 'submitted' ? 'Submitted for review. It cannot play until validation and owner approval are complete.' : 'The file was rejected. Choose a supported file and try again.';
    }, uploadForm);
  });
  bind('resend', async () => { await sendEmailVerification(user); message = 'Verification email sent. Check your inbox and spam folder.'; });
  bind('verify', async () => { await reload(user); await getIdToken(user, true); message = user.emailVerified ? 'Email verified. You can continue.' : 'Email is not verified yet. Open the email link, then try again.'; });
  bind('reset', async () => {
    const email = root.querySelector('[name="email"]');
    if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      message = 'Enter your email above, then choose Forgot password again.'; return;
    }
    await sendPasswordResetEmail(auth, email.value.trim()); message = 'If an account matches, a reset email will arrive shortly. Check your inbox and spam folder.';
  });
  bind('accept', async () => {
    await call('acceptAdvertiserInvitation', link);
    link = { businessId: link.businessId, advertiserId: link.advertiserId };
    sessionStorage.setItem('advertiser-entry', new URLSearchParams(link).toString());
    message = 'Invitation accepted. Open your workspace to continue.';
  });
  bind('open', async () => {
    workspace = null; submissions = undefined;
    const scope = { businessId: link.businessId, advertiserId: link.advertiserId };
    const uid = user.uid, result = await call('getAdvertiserWorkspace', scope);
    if (user?.uid === uid) {
      workspace = result; link = scope;
      sessionStorage.setItem('advertiser-entry', new URLSearchParams(link).toString());
    }
  });
  const form = root.querySelector('#client-auth');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const values = new FormData(form);
    run(async () => {
      if (signup) {
        const result = await createUserWithEmailAndPassword(auth, values.get('email').trim(), values.get('password'));
        await sendEmailVerification(result.user); message = 'Account created. Check your email to verify it.';
      } else await signInWithMfa(auth, values.get('email').trim(), values.get('password'));
    }, form);
  });
}
render();
try {
  const config = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || '{}');
  if (config.projectId !== 'discretesignage' || !import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) throw Error('Setup');
  const app = initializeApp(config, 'advertiser-client');
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY), isTokenAutoRefreshEnabled: true });
  auth = initializeAuth(app, { persistence: browserSessionPersistence }); functions = getFunctions(app, 'australia-southeast1');
  onAuthStateChanged(auth, current => { user = current; workspace = null; submissions = undefined; ready = true; if (!busy) render(); });
} catch { root.innerHTML = '<main class="admin-page"><h1>Client portal unavailable</h1><p>Configuration is missing. Please try again later.</p></main>'; }
