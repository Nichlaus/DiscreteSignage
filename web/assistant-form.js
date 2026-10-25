import { bindAssistantReview } from './assistant-review.js';
import { allDayPrompt } from '../functions/src/assistant-presets.js';
import { existingPlaylistPlan } from './assistant-existing.js';

export function assistantForm(workspace, media, escape) {
  const screens = (workspace.screens ?? []).filter(s => s.active), ready = media.filter(m => m.status === 'ready');
  return `<section id="assistant-section"><h3>Playlist assistant</h3>
    <p>Choose a screen and media, then describe your playlist or choose exact days and times. You’ll review the proposed playlist before saving.</p>
    ${!screens.length || !ready.length ? '<p class="notice">Pair a screen and refresh your library with at least one file ready for screens to get started.</p>' : `
    <form data-assistant-form><label>1. Choose your screen<select name="screenId">${screens.map((s, i) => `<option value="${i}">${escape(s.name)} · ${escape(workspace.locations.find(l => l.id === s.locationId)?.name)}</option>`).join('')}</select></label>
    <fieldset><legend>2. Choose up to 20 media files</legend>${ready.map(m => `<label class="checkbox"><input type="checkbox" name="mediaIds" value="${escape(m.id)}">${escape(m.name)} · Reference ${escape(m.reference ?? m.id)}</label>`).join('')}</fieldset>
    <button type="button" class="secondary" data-use-playlist>Use this screen’s current playlist</button>
    <p class="field-note">Loads the last refreshed Playlist 1 into this form, replacing your selections. Shared timings and media order are kept. Refresh screen status first if it has changed. Nothing is saved until you review and approve.</p>
    <label>3. How would you like to plan?<select name="planningMode"><option value="custom">Describe it to AI</option><option value="guided">Choose exact days and times</option></select></label>
    <p data-assistant-timezone class="field-note"></p>
    <fieldset data-guided hidden disabled><legend>Exact timing for all selected media</legend>
      <label>Image duration (seconds)<input name="guidedDuration" type="number" min="3" max="300" step="1" value="15" required></label>
      <label>When should these adverts play?<select name="guidedAvailability"><option value="any">Any time · every day</option><option value="scheduled">Selected days and hours</option></select></label>
      <fieldset data-guided-hours hidden disabled><legend>Days the advert starts</legend>
        ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => `<label class="checkbox"><input type="checkbox" name="guidedDays" value="${i}" ${i > 0 && i < 6 ? 'checked' : ''}>${day}</label>`).join('')}
        <label>Start time<input name="guidedStart" type="time" value="09:00" required></label>
        <label>End time<input name="guidedEnd" type="time" value="17:00" required></label>
        <p class="field-note">An end time earlier than the start continues into the next day. For example, Friday 10 pm–2 am includes early Saturday. Outside these hours this playlist has no adverts to show. Offline Android screens need internet at schedule changes.</p>
      </fieldset>
      <p class="field-note">Videos play in full unless the schedule ends. All selected media use the same timing, in the order listed. Guided drafts do not call AI, but preparing one counts toward your request allowance.</p>
    </fieldset>
    <div data-custom>
    <label>What should play?<textarea name="prompt" required maxlength="2000" rows="4" placeholder="Show these adverts on weekdays from 9 am to 5 pm. Show each image for 15 seconds." aria-describedby="assistant-help"></textarea></label>
    <button type="button" class="secondary" data-playlist-starter>Start with an all-day playlist</button>
    <p class="field-note">The unchanged all-day starter uses a fixed template, without an AI call. Preparing it still counts toward your request allowance.</p>
    <p id="assistant-help" class="field-note">Include days, start/end times and any campaign dates. Times use your screen location’s timezone. This replaces Playlist 1; the other region and logo stay as they are.</p>
    <p class="field-note">Your request and selected media names, references and scheduling details are sent to OpenAI. File contents and playback links are not sent. Do not include private customer information. AI can make mistakes: check every proposed change.</p>
    </div>
    <p class="field-note">Review before saving: this replaces Playlist 1. The other region, logo and screen layout stay as they are.</p>
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
  function updatePlanning() {
    const guided = form.elements.planningMode.value === 'guided';
    form.querySelector('[data-guided]').hidden = !guided;
    form.querySelector('[data-guided]').disabled = !guided;
    const scheduled = guided && form.elements.guidedAvailability.value === 'scheduled';
    form.querySelector('[data-guided-hours]').hidden = !scheduled;
    form.querySelector('[data-guided-hours]').disabled = !scheduled;
    form.querySelector('[data-custom]').hidden = guided;
    form.elements.prompt.disabled = guided; form.elements.prompt.required = !guided;
    const screen = screens[Number(form.elements.screenId.value)];
    const zone = workspace.locations.find(l => l.id === screen?.locationId)?.timezone;
    form.querySelector('[data-assistant-timezone]').textContent = `Schedule time zone: ${zone || 'set a time zone for this location before planning'}.`;
    review.replaceChildren();
  }
  form.elements.planningMode.onchange = updatePlanning;
  form.elements.guidedAvailability.onchange = updatePlanning;
  form.elements.screenId.onchange = updatePlanning;
  updatePlanning();
  form.querySelector('[data-use-playlist]').onclick = () => {
    if (busy) return;
    const choices = [...form.querySelectorAll('[name="mediaIds"]')];
    const plan = existingPlaylistPlan(screens[Number(form.elements.screenId.value)], choices.map(c => c.value));
    if (plan.error) { status.textContent = plan.error; return; }
    choices.forEach(c => { c.checked = plan.ids.includes(c.value); });
    // FormData follows DOM order, so the prepared draft retains the screen's order.
    const list = choices[0].closest('fieldset');
    for (const id of [...plan.ids, ...choices.map(c => c.value).filter(id => !plan.ids.includes(id))])
      list.append(choices.find(c => c.value === id).closest('label'));
    form.elements.planningMode.value = 'guided';
    form.elements.guidedDuration.value = plan.duration;
    form.elements.guidedAvailability.value = plan.schedule ? 'scheduled' : 'any';
    if (plan.schedule) {
      form.querySelectorAll('[name="guidedDays"]').forEach(c => { c.checked = plan.schedule.days.includes(Number(c.value)); });
      form.elements.guidedStart.value = plan.schedule.start;
      form.elements.guidedEnd.value = plan.schedule.end;
    }
    updatePlanning();
    status.textContent = 'Current playlist loaded in its existing order. Adjust the timing or media, then prepare and review your draft. No screen changes have been made.';
    form.elements.guidedDuration.focus();
  };
  form.querySelector('[data-playlist-starter]').onclick = () => {
    if (busy) return;
    if (form.elements.prompt.value.trim()) {
      status.textContent = 'Your request has been kept. Clear it first to use the all-day starting point.';
      return;
    }
    form.elements.prompt.value = allDayPrompt;
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
    let plan;
    if (data.get('planningMode') === 'guided') {
      const scheduled = data.get('guidedAvailability') === 'scheduled';
      const days = data.getAll('guidedDays').map(Number);
      if (scheduled && (!days.length || data.get('guidedStart') === data.get('guidedEnd'))) {
        status.textContent = 'Choose at least one day and different start and end times. Use Any time for all-day playback.'; return;
      }
      plan = { guided: { duration: Number(data.get('guidedDuration')), schedule: scheduled
        ? { days, start: data.get('guidedStart'), end: data.get('guidedEnd') } : null } };
    } else plan = { prompt: data.get('prompt').trim() };
    busy = true; review.replaceChildren(); status.textContent = 'Preparing your draft. Nothing is changing on your screen…';
    const controls = [...form.querySelectorAll('input, select, textarea, button')];
    const disabled = controls.map(c => c.disabled);
    controls.forEach(c => { c.disabled = true; });
    try {
      const draft = await call('preparePlaylistDraft', { businessId, screenId: screen.id,
        locationId: screen.locationId, mediaIds, ...plan });
      if (!section.isConnected) return;
      status.textContent = draft.usage ? `${draft.usage.remainingToday} requests left today (UTC); ${draft.usage.remainingTrial} left in this trial.` : 'Review your draft below.';
      bindAssistantReview(review, draft, call);
    } catch (error) {
      if (!section.isConnected) return;
      const code = error.code?.replace('functions/', '');
      status.textContent = ['failed-precondition', 'resource-exhausted', 'invalid-argument', 'permission-denied'].includes(code)
        ? error.message : 'We couldn’t prepare a draft. No screen changes were made. Try again later.';
    } finally { busy = false; controls.forEach((c, i) => { c.disabled = disabled[i]; }); }
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
