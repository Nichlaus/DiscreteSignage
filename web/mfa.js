import { signInWithEmailAndPassword, getMultiFactorResolver, TotpMultiFactorGenerator } from 'firebase/auth';

export const mfaError = error => ({
  'auth/invalid-credential': 'Email or password was not recognised.',
  'auth/wrong-password': 'Password was not recognised.',
  'auth/invalid-verification-code': 'That code was not accepted. Try the current code from your authenticator.',
  'auth/code-expired': 'That code expired. Try the current code.',
  'auth/invalid-multi-factor-session': 'This verification session expired. Cancel and sign in again.',
  'auth/requires-recent-login': 'Please sign out and sign in again before setting up your authenticator.',
  'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
  'auth/network-request-failed': 'Connection failed. Check your connection and try again.',
  'auth/cancelled': 'Sign-in cancelled.',
}[error.code] ?? 'We could not complete verification. Please try again.');

export async function signInWithMfa(auth, email, password) {
  try { return await signInWithEmailAndPassword(auth, email, password); }
  catch (error) {
    if (error.code !== 'auth/multi-factor-auth-required') throw error;
    return resolveMfa(getMultiFactorResolver(auth, error));
  }
}

export function resolveMfa(resolver) {
  const factors = resolver.hints.filter(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!factors.length) throw Error('No supported authenticator factor. Contact support.');
  const dialog = document.createElement('dialog');
  dialog.className = 'mfa-dialog';
  dialog.innerHTML = `<h2>Verify your sign-in</h2><p>Open your authenticator app and enter its current six-digit code.</p>
    <form><label>Authenticator<select name="factor"></select></label>
    <label>Verification code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
    <p role="status"></p><button class="primary">Verify and sign in</button><button type="button">Cancel</button></form>`;
  for (const factor of factors) dialog.querySelector('select').add(new Option(factor.displayName || 'Authenticator', factor.uid));
  document.body.append(dialog); dialog.showModal(); dialog.querySelector('input').focus();
  return new Promise((resolve, reject) => {
    let busy = false;
    const close = () => { dialog.querySelector('form').reset(); dialog.close(); dialog.remove(); };
    const cancel = () => { if (busy) return; close(); reject(Object.assign(Error('Cancelled'), { code: 'auth/cancelled' })); };
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
    dialog.querySelector('[type="button"]').onclick = cancel;
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault(); if (busy) return; busy = true;
      const form = event.currentTarget, code = form.elements.code.value;
      form.elements.code.value = '';
      const controls = [...form.querySelectorAll('input, select, button')]; controls.forEach(c => { c.disabled = true; });
      const status = form.querySelector('[role="status"]'); status.textContent = 'Verifying…';
      try {
        const credential = await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(form.elements.factor.value, code));
        close(); resolve(credential);
      } catch (error) { status.textContent = mfaError(error); }
      finally { busy = false; controls.forEach(c => { c.disabled = false; }); form.elements.code.focus(); }
    };
  });
}
