import './style.css';
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { adminBusinessView } from './admin-view.js';

const root = document.querySelector('#admin');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
root.innerHTML = `<main class="admin-page"><a href="/">Business portal</a><h1>Developer diagnostics</h1>
  <p>Read-only business diagnostics. Platform permission and multi-factor sign-in are required. Successful lookups are audited.</p>
  <p id="admin-session" role="status">Checking your session…</p>
  <form id="admin-search" hidden><label>Business ID<input name="businessId" required pattern="[a-zA-Z0-9_-]{1,128}" maxlength="128" autocomplete="off" placeholder="Paste the exact business ID"></label>
  <button class="primary">View diagnostics</button></form><p id="admin-feedback" role="status"></p><div id="admin-result"></div></main>`;
const form = document.querySelector('#admin-search'), result = document.querySelector('#admin-result');
const feedback = document.querySelector('#admin-feedback'), session = document.querySelector('#admin-session');
try {
  const config = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || '{}');
  if (config.projectId !== 'discretesignage' || !import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) throw Error('Setup');
  const app = initializeApp(config);
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY), isTokenAutoRefreshEnabled: true });
  const auth = getAuth(app), functions = getFunctions(app, 'australia-southeast1');
  let revision = 0;
  onAuthStateChanged(auth, user => {
    revision++; result.replaceChildren(); feedback.textContent = '';
    form.hidden = !user?.emailVerified;
    session.textContent = user?.emailVerified ? 'Signed in. Access is checked on every lookup.' : 'Sign in with your verified administrator account through the business portal, then return here.';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const current = revision, button = form.querySelector('button');
    button.disabled = true; result.replaceChildren(); feedback.textContent = 'Loading diagnostics…';
    try {
      const response = await httpsCallable(functions, 'getPlatformBusiness')({ businessId: form.elements.businessId.value.trim() });
      if (current !== revision) return;
      result.innerHTML = adminBusinessView(response.data, escape); feedback.textContent = 'Snapshot loaded. This lookup was audited.';
    } catch (error) {
      if (current !== revision) return;
      feedback.textContent = ({ 'functions/permission-denied': 'Platform permission and multi-factor sign-in are required to view diagnostics.',
        'functions/not-found': 'No business matches that ID.', 'functions/invalid-argument': 'Enter a valid business ID.' })[error.code]
        ?? 'Diagnostics could not load. Check your session and connection, then retry.';
    } finally { button.disabled = false; }
  });
} catch { session.textContent = 'Administrator configuration is unavailable.'; }
