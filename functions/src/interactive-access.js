// An interactive grant never extends the underlying signage authorization.
export function interactiveUntil(trial, grant, now) {
  const end = trial?.trialEndsAt?.toMillis();
  if (trial?.source !== 'trial' || !trial.trialModules?.includes('screens')
      || !(trial.trialStartedAt?.toMillis() <= now) || !(end > now)) return 0;
  if (grant?.state === 'disabled') return 0;
  if (grant?.state === 'enabled') {
    const expires = grant.expiresAt?.toMillis();
    return expires > now ? Math.min(end, expires) : 0;
  }
  if (grant && grant.state !== 'inherit') return 0;
  return trial.trialModules.includes('customerAi') ? end : 0;
}
