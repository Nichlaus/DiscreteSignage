// Limits are request counts, not a monetary budget or a subscription allowance.
export const conversationDefaults = Object.freeze({ enabled: false, version: 0, businessDaily: 100, businessTotal: 500, globalDaily: 1000 });
export function conversationConfig(value) {
  if (value === undefined) return { ...conversationDefaults };
  const { enabled, version, businessDaily, businessTotal, globalDaily } = value;
  if (typeof enabled !== 'boolean' || !Number.isSafeInteger(version) || version < 0
    || !Number.isInteger(businessDaily) || businessDaily < 1 || businessDaily > 500
    || !Number.isInteger(businessTotal) || businessTotal < 1 || businessTotal > 5000
    || !Number.isInteger(globalDaily) || globalDaily < 1 || globalDaily > 5000) return null;
  return { enabled, version, businessDaily, businessTotal, globalDaily };
}
