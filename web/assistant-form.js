import { bindAssistantReview } from './assistant-review.js';

export function assistantForm(workspace, media, escape) {
  const screens = (workspace.screens ?? []).filter(s => s.active), ready = media.filter(m => m.status === 'ready');
  return `<section id="assistant-section"><h3>Playlist assistant</h3>
    <p>Choose a screen and media, then describe the order and times you want. You’ll review the proposed playlist before saving.</p>
    ${!screens.length || !ready.length ? '<p class="notice">Pair a screen and refresh your library with at least one file ready for screens to get started.</p>' : `
    <form data-assistant-form><label>1. Choose your screen<select name="screenId">${screens.map((s, i) => `<option value="${i}">${escape(s.name)} · ${escape(workspace.locations.find(l => l.id === s.locationId)?.name)}</option>`).join('')}</select></label>
    <fieldset><legend>2. Choose up to 20 media files</legend>${ready.map(m => `<label class="checkbox"><input type="checkbox" name="mediaIds" value="${escape(m.id)}">${escape(m.name)} · Reference ${escape(m.reference ?? m.id)}</label>`).join('')}</fieldset>
    <label>3. What should play?<textarea name="prompt" required maxlength="2000" rows="4" placeholder="Show these adverts on weekdays from 9 am to 5 pm. Show each image for 15 seconds." aria-describedby="assistant-help"></textarea></label>
    <button type="button" class="secondary" data-playlist-starter>Start with an all-day playlist</button>
    <p id="assistant-help" class="field-note">Include days, start/end times and any campaign dates. Times use your screen location’s timezone. This replaces Playlist 1; the other region and logo stay as they are.</p>
    <p class="field-note">Your request and selected media names, references and scheduling details are sent to OpenAI. File contents and playback links are not sent. Do not include private customer information. AI can make mistakes: check every proposed change.</p>
    <p class="field-note">Trial allowance: 20 requests per UTC day and 100 in total per business. Failed requests may count. Allow at least 15 seconds between requests.</p>
    <button class="primary">Prepare a draft</button></form>`}
    <p data-assistant-status role="status" aria-live="polite"></p><div data-assistant-review></div></section>`;
}

export function bindAssistantForm(root, workspace, businessId, call) {
  const section = root.querySelector('#assistant-section'), form = section?.querySelector('form');
  if (!form) return;
  const screens = workspace.screens.filter(s => s.active), status = section.querySelector('[data-assistant-status]');
  const review = section.querySelector('[data-assistant-review]');
  let busy = false;
  form.querySelector('[data-playlist-starter]').onclick = () => {
    if (busy) return;
    if (form.elements.prompt.value.trim()) {
      status.textContent = 'Your request has been kept. Clear it first to use the all-day starting point.';
      return;
    }
    form.elements.prompt.value = 'Play the selected media every day, all day, in the order listed. Show each image for 15 seconds and play each video to the end. Use a fade transition.';
    review.replaceChildren();
    form.elements.prompt.focus();
    status.textContent = 'Starting point added. Adjust it if needed, then prepare and review your draft.';
  };
  form.addEventListener('input', () => { if (!busy) review.replaceChildren(); });
  form.onsubmit = async event => {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(form), mediaIds = data.getAll('mediaIds'), screen = screens[Number(data.get('screenId'))];
    if (!screen || !mediaIds.length || mediaIds.length > 20) {
      status.textContent = 'Choose a screen and between 1 and 20 media files.'; return;
    }
    busy = true; review.replaceChildren(); status.textContent = 'Preparing your draft. Nothing is changing on your screen…';
    const controls = [...form.querySelectorAll('input, select, textarea, button')];
    controls.forEach(c => { c.disabled = true; });
    try {
      const draft = await call('preparePlaylistDraft', { businessId, screenId: screen.id,
        locationId: screen.locationId, mediaIds, prompt: data.get('prompt').trim() });
      if (!section.isConnected) return;
      status.textContent = draft.usage ? `${draft.usage.remainingToday} requests left today (UTC); ${draft.usage.remainingTrial} left in this trial.` : 'Review your draft below.';
      bindAssistantReview(review, draft, call);
    } catch (error) {
      if (!section.isConnected) return;
      const code = error.code?.replace('functions/', '');
      status.textContent = ['failed-precondition', 'resource-exhausted', 'invalid-argument', 'permission-denied'].includes(code)
        ? error.message : 'We couldn’t prepare a draft. No screen changes were made. Try again later.';
    } finally { busy = false; controls.forEach(c => { c.disabled = false; }); }
  };
}

export function selectAdvertForPlanning(root, mediaId) {
  const section = root.querySelector('#assistant-section');
  if (!section) return;
  const form = section.querySelector('form');
  const checkbox = form && [...form.querySelectorAll('[name="mediaIds"]')].find(c => c.value === mediaId);
  if (checkbox) {
    checkbox.checked = true;
    section.querySelector('[data-assistant-status]').textContent = 'Your new advert is selected. Choose a screen, add any other media, and describe the playlist you want. This replaces Playlist 1 only after you review and save.';
    form.elements.screenId.focus();
  } else {
    section.querySelector('[data-assistant-status]').textContent = 'Your advert is saved. Pair an active screen and refresh the library to plan its playlist.';
  }
  section.scrollIntoView({ block: 'start' });
}
