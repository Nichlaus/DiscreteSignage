import { createLeasePlayer } from './lease-player.js';
import { applyScreenSettings } from './screen-settings.js';
import { loadVideo } from './video-content.js';
import { swapContent } from './transitions.js';

export function createScreenPlayer({ stage, calibrationUrl, getManifest, state, visibility }) {
  let players = [], revision = 0;
  function stop() {
    revision++;
    players.forEach(player => player.stop()); players = [];
    stage.replaceChildren(); visibility(false);
  }
  async function loadAsset(asset) {
    if (asset?.contentType === 'video/mp4') return loadVideo(asset);
    const image = new Image();
    image.alt = asset ? 'Assigned business display image' : 'Display calibration';
    image.referrerPolicy = 'no-referrer'; image.src = asset?.url ?? calibrationUrl;
    let timeout;
    try {
      await Promise.race([image.decode(), new Promise((_, reject) => {
        timeout = setTimeout(() => { image.src = ''; reject(Error('Image load timed out')); }, 20000);
      })]);
    } finally { clearTimeout(timeout); }
    return image;
  }
  function configure(config) {
    stop(); const current = revision;
    applyScreenSettings(stage, config);
    stage.dataset.layout = config.layout ?? 'single';
    const count = stage.dataset.layout === 'single' ? 1 : 2;
    const slots = Array.from({ length: count }, () => ({ logo: false }));
    if (config.logo) slots.push({ logo: true });
    const states = slots.map(() => 'downloading');
    let pending, cached;
    // Region renewals share one authorized manifest rather than multiplying calls.
    const manifest = () => {
      if (cached?.expiresAt > Date.now() + 30000) return Promise.resolve(cached);
      if (!pending) pending = getManifest().then(result => { cached = result; return result; })
        .finally(() => { pending = undefined; });
      return pending;
    };
    players = slots.map((slot, index) => {
      const container = document.createElement('div');
      container.className = slot.logo ? 'screen-logo' : 'screen-region';
      if (slot.logo) {
        container.dataset.position = config.logo.position;
        container.dataset.size = config.logo.size;
      }
      stage.append(container);
      return createLeasePlayer({
        getManifest: async () => {
          const result = await manifest();
          const items = slot.logo ? (result.logo ? [{ duration: 10, asset: result.logo }] : null)
            : (result.regions?.[index] ?? (index === 0 ? result.items ?? (result.asset ? [{ asset: result.asset, duration: 10 }] : []) : null));
          if (!items) throw Object.assign(Error('Incomplete screen authorization'), { code: 'functions/failed-precondition' });
          return { version: result.version, expiresAt: result.expiresAt, items, asset: items[0]?.asset ?? null };
        },
        loadAsset,
        dispose: content => { content.dispose?.(); content.remove(); },
        show: async (content, settings) => {
          if (current !== revision) { content.dispose?.(); return; }
          const swapped = swapContent(container, content, slot.logo ? 'none' : settings.transition);
          visibility(true);
          if (content.tagName === 'VIDEO') {
            content.onerror = () => { stop(); state('error', 0); };
            content.loop = settings.looping;
            await content.play();
          }
          await swapped;
        },
        clear: () => {
          for (const content of container.children) content.dispose?.();
          container.replaceChildren();
          if (current === revision) visibility(Boolean(stage.querySelector('img, video')));
        },
        state: next => {
          if (current !== revision) return;
          states[index] = next;
          const ready = states.every(value => value === 'ready');
          state(ready ? 'ready' : states.includes('error') ? 'error' : 'downloading', ready ? config.version : 0);
        },
      });
    });
    players.forEach(player => player.configure(config));
  }
  return { configure, stop };
}
