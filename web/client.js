import './style.css';
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, signOut, reload, getIdToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInWithMfa, mfaError } from './mfa.js';
import { bindFormHelp, formFeedback } from './form-help.js';
import { parseClientLink, clientLink } from './client-link.js';

const root = document.querySelector('#client');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let link = parseClientLink(location.hash || sessionStorage.getItem('advertiser-entry') || '');
if (location.hash) {
  sessionStorage.removeItem('advertiser-entry');
  history.replaceState(null, '', location.pathname);
}
if (link) sessionStorage.setItem('advertiser-entry', new URLSearchParams(link).toString());
let auth, functions, user, workspace, busy = false, signup = false, message = '', ready = false;
const errorMessage = error => ({
  'functions/permission-denied': 'This link or client access is unavailable for your account. Check the invited email, or ask the business for a new invitation.',
  'functions/failed-precondition': 'This workspace is not available right now. Ask the business to check its trial and client access.',
  'functions/unauthenticated': 'Please sign out and sign in again.',
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
    : link.invitationId ? `<h2>Accept your client invitation</h2><p>Signed in as <strong>${escape(user.email)}</strong>. This must match the email the business invited.</p><p>You’ll access only your assigned client workspace. Uploads and approval are coming next. You won’t receive business management, screen controls or publishing access.</p><button id="accept" class="primary">Accept invitation</button><button id="open" class="secondary">Already accepted? Open workspace</button>`
    : workspace ? `<h2>${escape(workspace.name)}</h2><p class="notice">Your client workspace is connected.</p><p>Media submissions and the business’s approval workflow are coming next. Nothing is published from this page.</p><p><a href="${escape(clientLink(location.origin, link))}">Your workspace link</a> — save this link for your next visit.</p><button id="open" class="secondary">Refresh access</button>`
    : '<h2>Open your client workspace</h2><p>Your access is checked each time you open it.</p><button id="open" class="primary">Open workspace</button>';
  root.innerHTML = `<main class="admin-page client-page"><a href="/">Discrete Signage</a><p class="product-tag">ADVERTISING CLIENT PORTAL</p>
    ${user ? `<p>${escape(user.email)} <button id="signout" class="text-button">Sign out / switch account</button></p>` : ''}
    ${message ? `<p class="notice" role="status" tabindex="-1">${escape(message)}</p>` : ''}${content}</main>`;
  bindFormHelp(root);
  const bind = (id, task) => root.querySelector(`#${id}`)?.addEventListener('click', () => run(task));
  bind('login', async () => { signup = false; }); bind('signup', async () => { signup = true; });
  bind('signout', () => signOut(auth));
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
    workspace = null;
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
  const app = initializeApp(config);
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY), isTokenAutoRefreshEnabled: true });
  auth = getAuth(app); functions = getFunctions(app, 'australia-southeast1');
  onAuthStateChanged(auth, current => { user = current; workspace = null; ready = true; if (!busy) render(); });
} catch { root.innerHTML = '<main class="admin-page"><h1>Client portal unavailable</h1><p>Configuration is missing. Please try again later.</p></main>'; }
