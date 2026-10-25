const escape = value => String(value ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function rows(items, media) {
  if (!items.length) return '<p>Empty playlist</p>';
  return `<ol>${items.map(item => {
    const asset = media.find(m => m.id === item.mediaId), s = item.schedule;
    const timing = s ? `${s.days.map(day => days[day]).join(', ')} · ${s.start}–${s.end}${s.start > s.end ? ' (overnight; days identify the start day)' : ''}${s.startDate ? ` · ${s.startDate} through ${s.endDate}, inclusive` : ''}` : 'Any time';
    return `<li><strong>${escape(asset?.name ?? item.mediaId)}</strong> <small>Reference ${escape(item.mediaId)}</small><p>${asset?.type === 'video' ? 'Video plays in full, without sound' : `${escape(item.duration)} seconds for images; videos play in full`} · ${escape(timing)}</p></li>`;
  }).join('')}</ol>`;
}

export function assistantReview(draft) {
  if (draft.kind === 'clarification') return `<p role="status">${escape(draft.message)}</p>`;
  return `<section aria-label="Review AI playlist draft"><h4>Review changes for ${escape(draft.screenName)}</h4>
    <p>Nothing has changed yet. This replaces Playlist 1 (full screen, left or top). Check every item and time before approving.</p>
    <p>Schedule time zone: <strong>${escape(draft.timezone)}</strong>. Outside these hours, a region with no eligible items is blank.</p>
    <h5>Current Playlist 1</h5>${rows(draft.before, draft.media)}
    <h5>Proposed Playlist 1</h5>${rows(draft.settings.playlist, draft.media)}
    <p>The other region, logo, layout, orientation, scaling and transitions are preserved. Menu snapshots in Playlist 1 will be replaced too. The display needs internet to receive changes.</p>
    <button type="button" data-approve-draft>Approve and save this playlist</button>
    <button type="button" class="secondary" data-discard-draft>Discard draft</button>
    <p data-draft-status role="status" aria-live="polite"></p></section>`;
}

// Called only by the future assistant form, after a server-validated proposal.
export function bindAssistantReview(container, draft, call) {
  container.innerHTML = assistantReview(draft);
  const approve = container.querySelector('[data-approve-draft]'), discard = container.querySelector('[data-discard-draft]');
  if (!approve) return;
  const settings = structuredClone(draft.settings);
  discard.onclick = () => { container.replaceChildren(); };
  approve.onclick = async () => {
    if (approve.disabled) return;
    approve.disabled = true; discard.disabled = true;
    const status = container.querySelector('[data-draft-status]');
    status.textContent = 'Checking access and saving your approved playlist…';
    try {
      await call('updateScreenSettings', settings);
      status.textContent = 'Playlist saved. Refresh screen status and check the display.';
    } catch {
      // Do not automatically retry a proposal against a new screen version.
      status.textContent = 'Could not confirm the save. Refresh screen status before preparing another draft; the screen may have changed or your access may have ended.';
    } finally { discard.disabled = false; }
  };
}
