export const HOLD_MS = 900;
export const IDLE_MS = 30000;
export const answers = ['Kilimanjaro', 'K2', 'Everest', 'Mont Blanc', 'Fuji'];

export function createInteraction() {
  let target = null, since = 0, lastSeen = 0, result = null;
  return {
    reset() { target = null; since = 0; lastSeen = 0; result = null; },
    update(zone, now) {
      if (!Number.isFinite(now)) throw Error('A monotonic timestamp is required');
      if (lastSeen && now - lastSeen >= IDLE_MS) this.reset();
      lastSeen = now;
      if (result !== null) return { result, progress: 0, target: null };
      if (!Number.isInteger(zone) || zone < 0 || zone >= answers.length) {
        target = null; since = now;
        return { result: null, progress: 0, target: null };
      }
      if (target !== zone) { target = zone; since = now; }
      const progress = Math.max(0, Math.min(1, (now - since) / HOLD_MS));
      if (progress === 1) result = zone === 2 ? 'correct' : 'try-again';
      return { target, progress, result };
    },
  };
}
