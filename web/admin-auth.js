import { onAuthStateChanged, getIdTokenResult, signOut, multiFactor, reauthenticateWithCredential,
  EmailAuthProvider, TotpMultiFactorGenerator } from 'firebase/auth';
import { signInWithMfa, mfaError } from './mfa.js';

export function mountAdminAuth(auth, host, changed) {
  let generation = 0, secret;
  const clear = () => { secret = undefined; host.replaceChildren(); };
  onAuthStateChanged(auth, async user => {
    const current = ++generation; clear(); changed(false);
    let verifiedMfa = false;
    try { verifiedMfa = !!user?.emailVerified && !!(await getIdTokenResult(user)).claims.firebase?.sign_in_second_factor; }
    catch { /* Keep diagnostics closed when session inspection fails. */ }
    if (current !== generation) return;
    changed(verifiedMfa);
    if (!user) {
      host.innerHTML = `<h2>Administrator sign-in</h2><form id="admin-login"><label>Email address<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Sign in</button><p role="status"></p></form>`;
      bind(host.querySelector('form'), async form => {
        const email = form.elements.email.value.trim(), password = form.elements.password.value;
        form.elements.password.value = '';
        await signInWithMfa(auth, email, password);
      });
      return;
    }
    const who = document.createElement('p'); who.textContent = `Signed in as ${user.email}`; host.append(who);
    const out = document.createElement('button'); out.textContent = 'Sign out'; host.append(out);
    out.onclick = async () => { clear(); changed(false); await signOut(auth); };
    if (!user.emailVerified) { host.append(document.createTextNode(' Verify your email through the business portal first.')); return; }
    if (verifiedMfa) { host.append(document.createTextNode(' Multi-factor sign-in verified.')); return; }
    if (multiFactor(user).enrolledFactors.length) {
      host.append(document.createTextNode(' Sign out, then sign in here with your password and authenticator code.')); return;
    }
    const panel = document.createElement('section'); host.append(panel);
    panel.innerHTML = `<h2>Protect your administrator account</h2><p>Add an authenticator app. Keep a secure backup in your authenticator; losing it requires identity-verified support recovery. Setting it up does not grant administrator permission.</p>
      <form><label>Confirm your password<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Set up authenticator</button><p role="status"></p></form>`;
    bind(panel.querySelector('form'), async form => {
      const password = form.elements.password.value; form.elements.password.value = '';
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      const next = await TotpMultiFactorGenerator.generateSecret(await multiFactor(user).getSession());
      if (current !== generation || auth.currentUser?.uid !== user.uid) return;
      secret = next;
      panel.hidden = true;
      const setup = document.createElement('section'); host.append(setup);
      setup.innerHTML = `<h2>Add to your authenticator</h2><p>Choose “Enter a setup key” in your authenticator app. Use Discrete Signage as the account name and Time based as the key type.</p><label>Setup key<input readonly autocomplete="off" aria-label="Setup key"></label><p>Keep this key private. It is shown only during this setup.</p><form><label>Six-digit code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button class="primary">Enable authenticator</button><button type="button">Cancel setup</button><p role="status"></p></form>`;
      setup.querySelector('[readonly]').value = secret.secretKey;
      setup.querySelector('[type="button"]').onclick = () => { secret = undefined; setup.remove(); panel.hidden = false; };
      bind(setup.querySelector('form'), async codeForm => {
        const code = codeForm.elements.code.value; codeForm.elements.code.value = '';
        await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(next, code), 'Authenticator');
        secret = undefined; setup.remove();
        await signOut(auth); // Require a fresh MFA sign-in before diagnostics access.
      });
    });
  });
}

function bind(form, action) {
  form.onsubmit = async event => {
    event.preventDefault();
    const controls = [...form.querySelectorAll('input, button')];
    if (controls.some(c => c.disabled)) return;
    controls.forEach(c => { c.disabled = true; });
    const status = form.querySelector('[role="status"]'); status.textContent = 'Please wait…';
    try { await action(form); status.textContent = ''; }
    catch (error) { status.textContent = mfaError(error); }
    finally { controls.forEach(c => { c.disabled = false; }); }
  };
}
