// Best-effort telemetry never blocks playback; no credentials or media URLs are queued.
export function createPlaybackReporter(send, { now = Date.now, uuid = () => crypto.randomUUID(),
  every = setInterval, cancel = clearInterval } = {}) {
  let pending = [], sending = false, stopped = false;
  async function flush() {
    if (sending || stopped) return;
    pending = pending.filter(e => e.startedAt >= now() - 110000);
    const batch = pending.slice(0, 20);
    if (!batch.length) return;
    sending = true;
    try {
      await send({ events: batch });
      pending = pending.filter(e => !batch.some(sent => sent.id === e.id));
    } catch (error) {
      if (['functions/permission-denied', 'functions/invalid-argument', 'functions/failed-precondition'].includes(error.code)) {
        pending = pending.filter(e => !batch.some(sent => sent.id === e.id));
      }
    } finally { sending = false; }
  }
  const timer = every(() => { void flush(); }, 15000);
  return {
    started(event) { if (!stopped && pending.length < 120) pending.push({ ...event, id: uuid(), startedAt: now() }); },
    flush,
    stop() { stopped = true; cancel(timer); pending = []; },
  };
}
