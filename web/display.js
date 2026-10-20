import './display.css';
import calibrationUrl from './calibration.svg';
import { applyScreenSettings } from './screen-settings.js';
import { createLeasePlayer } from './lease-player.js';
import { loadVideo } from './video-content.js';
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

const title = document.querySelector('#title');
const status = document.querySelector('#status');
const code = document.querySelector('#code');
const start = document.querySelector('#start');
const stage = document.createElement('div');
stage.id = 'stage';
stage.hidden = true;
const calibration = document.createElement('img');
calibration.src = calibrationUrl;
calibration.alt = 'Display calibration: top arrow, border and circle to check orientation and scaling.';
stage.append(calibration);
document.body.append(stage);
let auth, db, functions, timer, unsubscribe, heartbeat, player, running = false;
const say = text => { status.textContent = text; };
const call = async (name, data) => (await httpsCallable(functions, name)(data)).data;
function stop() {
  clearTimeout(timer); clearInterval(heartbeat); unsubscribe?.(); unsubscribe = undefined;
  player?.stop(); player = undefined;
}
async function disconnected(text) {
  stop();
  stage.hidden = true;
  document.querySelector('#display').hidden = false;
  await signOut(auth);
  code.textContent = '';
  title.textContent = 'Connect your display';
  say(text); start.hidden = false;
}
async function connected(user) {
  const { claims } = await user.getIdTokenResult();
  if (claims.device !== true || typeof claims.businessId !== 'string') throw Error('Invalid device identity');
  const base = `businesses/${claims.businessId}`;
  const device = (await getDoc(doc(db, `${base}/devices/${user.uid}`))).data();
  if (!device?.active) throw Error('Display revoked');
  sessionStorage.removeItem('display-pairing');
  code.textContent = ''; start.hidden = true;
  title.textContent = 'Display connected';
  let appliedVersion = 0, deviceState = 'ready';
  const report = () => setDoc(doc(db, `${base}/deviceStatus/${user.uid}`), {
    state: deviceState, reportedAt: serverTimestamp(), appliedVersion,
  }).catch(error => {
    if (error.code === 'permission-denied') void disconnected('Access ended. Ask your owner to pair this display again.');
    else say('Connection interrupted. Reconnecting…');
  });
  player = createLeasePlayer({
    getManifest: () => call('getScreenPlayback', {}),
    loadAsset: async asset => {
      if (!asset) return calibration;
      if (asset.contentType === 'video/mp4') return loadVideo(asset);
      const image = new Image();
      image.alt = 'Assigned business display image';
      image.referrerPolicy = 'no-referrer';
      image.src = asset.url;
      let timeout;
      try {
        await Promise.race([image.decode(), new Promise((_, reject) => {
          timeout = setTimeout(() => { image.src = ''; reject(Error('Image load timed out')); }, 20000);
        })]);
      } finally { clearTimeout(timeout); }
      return image;
    },
    dispose: content => content.dispose?.(),
    show: async (content, config) => {
      applyScreenSettings(stage, config); stage.replaceChildren(content);
      stage.hidden = false; document.querySelector('#display').hidden = true;
      if (content.tagName === 'VIDEO') {
        content.onerror = () => { player?.stop(); };
        await content.play();
      }
    },
    clear: () => {
      for (const content of stage.children) content.dispose?.();
      stage.replaceChildren(); stage.hidden = true;
      document.querySelector('#display').hidden = false;
      say('Waiting for authorized screen content. Check the connection if this continues.');
    },
    state: (state, version) => { deviceState = state; appliedVersion = version; void report(); },
  });
  let requestedVersion;
  unsubscribe = onSnapshot(doc(db, `${base}/locations/${device.locationId}/screens/${device.screenId}`), snapshot => {
    if (!snapshot.exists() || snapshot.data().active !== true) {
      void disconnected('Access ended. Ask your owner to pair this display again.'); return;
    }
    title.textContent = snapshot.data().name;
    if (requestedVersion !== snapshot.data().version) {
      requestedVersion = snapshot.data().version;
      player.configure(snapshot.data());
    }
  }, () => { void disconnected('Display access unavailable. Check your connection or pair again.'); });
  heartbeat = setInterval(report, 60000);
}
async function poll(session) {
  if (Date.now() >= session.expiresAt) {
    sessionStorage.removeItem('display-pairing');
    say('This code expired. Get a new code to continue.'); code.textContent = ''; start.hidden = false; return;
  }
  try {
    const result = await call('completePairing', { code: session.code, secret: session.secret });
    if (result.status === 'ready') {
      const credential = await signInWithCustomToken(auth, result.token);
      await connected(credential.user); return;
    }
  } catch (error) {
    if (['functions/failed-precondition', 'functions/permission-denied'].includes(error.code)) {
      sessionStorage.removeItem('display-pairing');
      code.textContent = ''; say('Pairing ended. Get a new code to continue.'); start.hidden = false; return;
    }
    say('Waiting for a connection. Your code will retry automatically.');
  }
  timer = setTimeout(() => poll(session), 5000);
}
async function begin() {
  if (running) return;
  running = true; start.hidden = true; stop();
  try {
    const session = await call('beginPairing', {});
    sessionStorage.setItem('display-pairing', JSON.stringify(session));
    show(session);
  } catch {
    say('Could not create a code. Check your connection and try again shortly.'); start.hidden = false;
  } finally { running = false; }
}
function show(session) {
  code.textContent = session.code;
  say('In your business portal, choose Pair a display and enter this code. It expires in ten minutes.');
  void poll(session);
}
start.addEventListener('click', begin);
try {
  const config = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || '{}');
  if (config.projectId !== 'discretesignage' || !import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) throw Error('Setup');
  // Separate Auth persistence keeps this device identity apart from the portal account.
  const app = initializeApp(config, 'display');
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY),
    isTokenAutoRefreshEnabled: true });
  auth = getAuth(app); db = getFirestore(app); functions = getFunctions(app, 'australia-southeast1');
  await auth.authStateReady();
  if (auth.currentUser) {
    try { await connected(auth.currentUser); }
    catch { await disconnected('Could not restore display access. Check your connection or pair again.'); }
  } else {
    let session;
    try { session = JSON.parse(sessionStorage.getItem('display-pairing')); } catch { /* Start fresh. */ }
    if (session?.expiresAt > Date.now()) show(session); else await begin();
  }
} catch {
  say('Display setup is not available. Contact your business administrator.');
}
window.addEventListener('pagehide', stop);
