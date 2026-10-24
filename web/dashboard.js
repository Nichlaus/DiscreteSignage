export function screenHealth(screen, now = Date.now()) {
  if (!screen.active) return { label: 'Revoked', kind: 'inactive' };
  if (!screen.reportedAt) return { label: 'Waiting for display', kind: 'attention' };
  if (screen.reportedAt > now + 5000 || now - screen.reportedAt >= 120000) {
    return { label: 'No recent report', kind: 'attention' };
  }
  if (screen.deviceState === 'error') return { label: 'Playback error', kind: 'attention' };
  if (screen.deviceState === 'downloading') return { label: 'Loading media', kind: 'attention' };
  if (screen.appliedVersion !== screen.version || screen.deviceState !== 'ready') {
    return { label: 'Changes pending', kind: 'attention' };
  }
  return { label: 'Applied', kind: 'ready' };
}

export const screenAnchor = screen => `screen-${screen.locationId}-${screen.id}`;

export function trialNotice(workspace, checkedAt, escape) {
  const end = workspace.trialEndsAt;
  if (!Number.isFinite(end) || end <= 0) return '';
  const remaining = end - checkedAt;
  const days = Math.ceil(remaining / 86400000);
  const status = remaining <= 0 ? 'Your trial has ended.' : remaining < 86400000
    ? 'Less than a day remains in your trial.' : `${days} day${days === 1 ? '' : 's'} remaining in your trial.`;
  const ends = new Date(end).toLocaleString('en-AU', {
    dateStyle: 'medium', timeStyle: 'long',
  });
  return `<div class="notice"><strong>${status}</strong>
    <p>Trial ${remaining <= 0 ? 'ended' : 'ends'} ${escape(ends)} (your browser’s time zone). No payment method is required and the trial does not automatically become a paid subscription.</p>
    <details><summary>What happens when the trial ends?</summary>
      <p>Screen playback stops when its current authorization expires. Downloaded Android playlists cannot extend playback beyond the trial. New screen pairing, uploads, media validation and screen-setting changes require an active trial.</p>
      <p>${workspace.role === 'owner' ? 'You can still sign in to review your workspace and revoke screen access. Contact Discrete Signage support to discuss continued access before relying on screens for business use. Paid plans and self-service renewal are not available yet.' : 'Ask your business owner about continued access. Paid plans and self-service renewal are not available yet.'}</p>
      <p>This is a snapshot. Refresh overview to update the countdown; the server checks access independently.</p>
    </details></div>`;
}

export function dashboardView(workspace, checkedAt, escape) {
  const active = (workspace.screens ?? []).filter(s => s.active);
  const attention = active.filter(s => screenHealth(s, checkedAt).kind === 'attention');
  const owner = workspace.role === 'owner';
  const card = (label, count) => `<div><dt>${label}</dt><dd>${count}</dd></div>`;
  return `<section class="dashboard" aria-label="Workspace overview"><h3>Your screens at a glance</h3>
    <dl class="dashboard-cards">${card('Active screens', active.length)}${card('Applied', active.length - attention.length)}${card('Need attention', attention.length)}${card('Locations', workspace.locations.length)}</dl>
    <p class="field-note">${owner ? 'Your business' : 'Your assigned locations'} · Status snapshot at ${escape(new Date(checkedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))}. Applied means the latest settings were acknowledged recently, not a guarantee the screen is visible to customers.</p>
    <button type="button" class="text-button" id="refresh-overview">Refresh overview</button>
    <nav class="dashboard-links" aria-label="Workspace shortcuts"><a href="#screens-section">Manage screens</a>${owner ? '<a href="#media-section">Media library</a><a href="#reports-section">Playback reports</a>' : ''}</nav>
    ${trialNotice(workspace, checkedAt, escape)}
    ${!active.length ? `<p>No active displays ${owner ? 'yet. Open Manage screens to pair your first display' : 'in your assigned locations. Ask the owner to pair a display'}.</p>` : attention.length ? `<h4>Needs attention</h4><ul class="dashboard-attention">${attention.map(s => `<li><a data-screen-jump href="#${escape(screenAnchor(s))}">${escape(s.name)}</a><span>${escape(workspace.locations.find(l => l.id === s.locationId)?.name ?? '')} · ${screenHealth(s, checkedAt).label}</span></li>`).join('')}</ul><p class="field-note">For missing reports, check the device connection. For pending changes or loading, refresh after a moment. Open a screen to inspect its settings.</p>` : '<p>All active screens recently acknowledged their current settings.</p>'}
  </section>`;
}

export function bindDashboard(root) {
  root.querySelectorAll('[data-screen-jump]').forEach(link => link.addEventListener('click', () => {
    const target = document.getElementById(link.hash.slice(1));
    if (target) { target.open = true; target.querySelector('summary')?.focus(); }
  }));
}
