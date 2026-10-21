// Only the current and incoming assets are loaded; authorization bounds every swap.
export function createLeasePlayer({ getManifest, loadAsset, show, clear, state, dispose = () => {},
  now = () => Date.now(), setTimer = setTimeout, cancelTimer = clearTimeout }) {
  let epoch = 0, renewal, expiry, advance, manifest, currentKey, index = 0, loadId = 0, stopped = false;
  function revoke() {
    loadId++; cancelTimer(advance); currentKey = undefined; manifest = undefined;
    clear(); state('error', 0);
  }
  function stop() {
    stopped = true; epoch++; cancelTimer(renewal); cancelTimer(expiry); revoke();
  }
  function configure(config) {
    stopped = false; const revision = ++epoch;
    cancelTimer(renewal); cancelTimer(expiry); revoke(); index = 0;
    state('downloading', 0);
    let loading = false;
    const active = () => !stopped && revision === epoch;
    async function display(next) {
      if (loading) return;
      const ticket = ++loadId;
      const source = manifest;
      if (!source || source.expiresAt <= now()) return;
      const items = source.items?.length ? source.items : [{ asset: source.asset ?? null, duration: 10 }];
      const item = items[next % items.length];
      loading = true;
      let content;
      try {
        content = await loadAsset(item.asset);
        if (!active() || ticket !== loadId || !manifest || now() >= manifest.expiresAt) { dispose(content); return; }
        await show(content, { ...config, looping: items.length === 1 });
        if (!active() || ticket !== loadId || !manifest || now() >= manifest.expiresAt) { dispose(content); return; }
        index = next % items.length;
        currentKey = JSON.stringify(items.map(i => [i.asset?.id, i.asset?.generation, i.duration]));
        state('ready', config.version);
        if (items.length > 1) advance = setTimer(() => { void display(index + 1); }, item.duration * 1000);
      } catch {
        if (content) dispose(content);
        if (!active() || ticket !== loadId) return;
        state('error', 0);
        // Retry the next slot without a tight loop. The existing lease still expires.
        advance = setTimer(() => { void display(next + 1); }, 5000);
      } finally { loading = false; }
    }
    async function refresh() {
      let retry = 30000;
      try {
        const result = await getManifest();
        if (!active()) return;
        if (result.version !== config.version) { retry = 2000; return; }
        const remaining = result.expiresAt - now();
        if (!(remaining > 0 && remaining <= 60000)) throw Error('Expired playback authorization');
        const items = result.items?.length ? result.items : [{ asset: result.asset ?? null, duration: 10 }];
        const key = JSON.stringify(items.map(i => [i.asset?.id, i.asset?.generation, i.duration]));
        manifest = result;
        cancelTimer(expiry); expiry = setTimer(revoke, remaining);
        if (currentKey !== key) {
          cancelTimer(advance);
          await display(0);
        }
        retry = Math.min(30000, Math.max(1000, remaining / 2));
      } catch (error) {
        if (!active()) return;
        if (['functions/permission-denied', 'functions/unauthenticated', 'functions/failed-precondition'].includes(error.code)) {
          cancelTimer(expiry); revoke(); retry = 60000;
        } else retry = 15000;
        state('error', 0);
      } finally {
        if (active()) renewal = setTimer(refresh, retry);
      }
    }
    void refresh();
  }
  return { configure, stop };
}
