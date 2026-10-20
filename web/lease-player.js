// Authorization expires even if refreshes fail or an old image finishes loading late.
export function createLeasePlayer({ getManifest, loadAsset, show, clear, state,
  now = () => Date.now(), setTimer = setTimeout, cancelTimer = clearTimeout }) {
  let epoch = 0, renewal, expiry, currentKey, stopped = false;
  const revoke = () => { currentKey = undefined; clear(); state('error', 0); };
  function stop() {
    stopped = true; epoch++; cancelTimer(renewal); cancelTimer(expiry); revoke();
  }
  function configure(config) {
    stopped = false; const revision = ++epoch;
    cancelTimer(renewal); cancelTimer(expiry); currentKey = undefined; clear();
    state('downloading', 0);
    async function refresh() {
      let retry = 30000;
      try {
        const manifest = await getManifest();
        if (stopped || revision !== epoch) return;
        if (manifest.version !== config.version) { retry = 2000; return; }
        const remaining = manifest.expiresAt - now();
        if (!(remaining > 0 && remaining <= 60000)) throw Error('Expired playback authorization');
        cancelTimer(expiry);
        expiry = setTimer(revoke, remaining);
        const key = manifest.asset ? `${manifest.asset.id}:${manifest.asset.generation}` : 'calibration';
        if (key !== currentKey) {
          const content = await loadAsset(manifest.asset);
          if (stopped || revision !== epoch || now() >= manifest.expiresAt) return;
          show(content, config); currentKey = key;
        }
        state('ready', config.version);
        retry = Math.min(30000, Math.max(1000, remaining / 2));
      } catch (error) {
        if (stopped || revision !== epoch) return;
        if (['functions/permission-denied', 'functions/unauthenticated', 'functions/failed-precondition'].includes(error.code)) {
          cancelTimer(expiry); revoke(); retry = 60000;
        } else {
          retry = 15000;
        }
        // A connection error keeps content only until the existing lease expires.
        state('error', 0);
      } finally {
        if (!stopped && revision === epoch) renewal = setTimer(refresh, retry);
      }
    }
    void refresh();
  }
  return { configure, stop };
}
