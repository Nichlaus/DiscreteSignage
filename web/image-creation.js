import { uploadMedia } from './media-upload.js';
import { brandColoursView, bindBrandColours } from './brand-colours.js';

export function imageCreationView(media = []) {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const choices = media.filter(m => m.status === 'ready' && m.contentType?.startsWith('image/'))
    .map(m => `<option value="${escape(m.id)}">${escape(m.name)} · ${escape(m.reference ?? m.id)}</option>`).join('');
  return `<section id="image-creation-section"><h3>Create an advert with AI</h3>
    <p>Describe your advert, preview the image, then choose whether to add it to your private media library. Nothing is sent to a screen automatically.</p>
    <form data-image-create>
      <label>What would you like to create?<select name="mode"><option value="new">New advert</option><option value="edit">Edit an existing advert</option><option value="variation">Create a variation</option></select></label>
      <label data-source hidden>Existing advert<select name="sourceId" disabled><option value="">Choose a ready image</option>${choices}</select></label>
      <fieldset><legend>Business branding (optional)</legend>
      <label>Business logo<select name="logoId"><option value="">No logo</option>${choices}</select></label>
      <label data-logo-placement hidden>Logo treatment<select name="logoPlacement"><option value="top-right">Keep original · top right</option><option value="top-left">Keep original · top left</option><option value="bottom-right">Keep original · bottom right</option><option value="bottom-left">Keep original · bottom left</option><option value="creative">Let AI interpret the logo</option></select></label>
      <p class="field-note">Keep original places your validated logo after generation, preserving its proportions and colours when resized. It occupies up to 20% of the width and 15% of the height. Review contrast, overlap and any old logos still in the artwork.</p>
      ${brandColoursView()}
      <p class="field-note">Refresh the media library to load ready images. Upload and validate your logo there first. Each variation becomes a new asset; the original and screen playlists stay unchanged.</p></fieldset>
      <label>Need an idea?<select name="starter"><option value="">Choose a starting point (optional)</option><option value="promotion">Product promotion</option><option value="welcome">Welcome message</option><option value="event">Event announcement</option></select></label>
      <p class="field-note">Starting points fill an empty design brief only. Add your own wording and verified offer details below.</p>
      <label>Advert name<input name="name" required maxlength="100" placeholder="e.g. Weekend special"></label>
      <label>Screen shape<select name="orientation"><option value="landscape">Landscape · 16:9 (1536 × 864)</option><option value="portrait">Portrait · 9:16 (864 × 1536)</option><option value="square">Square · 1:1 (1024 × 1024)</option></select></label>
      <label>Describe the look<textarea name="prompt" required maxlength="2000" rows="4" placeholder="A welcoming coffee advert with a warm cream background, a large cup on the right and clear space for the headline."></textarea></label>
      <label>Words to include (optional)<textarea name="copy" maxlength="500" rows="3" placeholder="Fresh coffee\nMade for your morning"></textarea></label>
      <p class="field-note">Include exact prices and offer conditions if needed. For new adverts, empty wording means artwork without text. For edits and variations, empty wording keeps the source wording unless your brief requests its removal. Your brief, wording, colours and selected advert go to OpenAI. The selected logo is sent only when you choose “Let AI interpret the logo”; otherwise it is placed privately by our server. A logo already inside the selected advert goes to OpenAI as part of that image. Other library files and account details are not sent. A pseudonymous safety identifier accompanies the request. Do not include private customer information. AI may alter artwork colours and logos within it. Keep original protects the separately placed logo from AI changes.</p>
      <label class="checkbox" data-reference-consent hidden><input type="checkbox" name="consent">I agree to use these selected images as described above for this preview.</label>
      <p class="field-note">3 image requests per UTC day, 10 per trial per business, separate from playlist requests. Failed or discarded attempts count. Generation may take up to 3 minutes. Keep this page open: unsaved previews are lost when you leave or refresh.</p>
      <button class="primary">Generate advert preview</button>
    </form><p data-image-status role="status" aria-live="polite"></p><div data-image-preview></div></section>`;
}

// The same reservation survives retries; a lost completion response must not create another file.
export async function saveGeneratedAdvert(draft, businessId, call, upload = uploadMedia) {
  if (!draft.mediaId) {
    const reservation = await call('beginMediaUpload', { businessId, requestId: draft.requestId,
      name: draft.name, contentType: draft.blob.type, size: draft.blob.size });
    draft.mediaId = reservation.mediaId;
  }
  const data = { businessId, mediaId: draft.mediaId };
  const entry = (await call('listMedia', { businessId })).items.find(m => m.id === draft.mediaId);
  if (entry?.status === 'ready') return data;
  if (entry?.status === 'uploading') {
    const grant = await call('authorizeMediaUpload', data);
    await upload(draft.blob, grant, () => {});
    const result = await call('completeMediaUpload', data);
    if (!['uploaded', 'ready', 'validating'].includes(result.status)) throw Error('This image could not be accepted. Refresh the library to check its status.');
  } else if (!['uploaded', 'validating'].includes(entry?.status)) {
    throw Error('This image reservation is unavailable. Refresh the library to check its status.');
  }
  const validation = await call('validateMedia', data);
  if (validation.status !== 'ready') throw Error('The image is in your library but did not pass playback validation. Refresh the library for details.');
  return data;
}

export function bindImageCreation(root, businessId, call, onPlanAdvert) {
  const section = root.querySelector('#image-creation-section');
  if (!section) return () => {};
  const form = section.querySelector('form'), status = section.querySelector('[data-image-status]');
  const preview = section.querySelector('[data-image-preview]');
  bindBrandColours(form);
  let url, draft, busy = false, disposed = false;
  function referencesChanged() {
    const source = form.elements.mode.value !== 'new';
    form.querySelector('[data-source]').hidden = !source;
    form.elements.sourceId.disabled = !source; form.elements.sourceId.required = source;
    form.querySelector('[data-logo-placement]').hidden = !form.elements.logoId.value;
    const sendsImages = source || Boolean(form.elements.logoId.value);
    form.querySelector('[data-reference-consent]').hidden = !sendsImages;
    form.elements.consent.required = sendsImages; form.elements.consent.checked = false;
  }
  form.elements.mode.onchange = referencesChanged;
  form.elements.sourceId.onchange = referencesChanged;
  form.elements.logoId.onchange = referencesChanged;
  form.elements.logoPlacement.onchange = referencesChanged;
  referencesChanged();
  const starters = {
    promotion: 'A polished product promotion with a clear focal point, generous space for a large headline, and a clean high-contrast background. Keep all text easy to read from across a room. Use only the wording provided; do not invent prices or offer conditions.',
    welcome: 'A welcoming business advert with a warm, uncluttered background and large friendly typography. Leave generous margins. Use only the wording provided; do not invent business details.',
    event: 'An eye-catching event announcement with a bold headline area and a clear visual hierarchy for the supplied event details. Keep the design readable from a distance. Do not invent dates, locations or ticket prices.',
  };
  form.elements.starter.onchange = () => {
    const brief = starters[form.elements.starter.value];
    if (!brief) return;
    if (form.elements.prompt.value.trim()) {
      status.textContent = 'Your design brief has been kept. Clear it first if you want to use a starting point.';
      return;
    }
    form.elements.prompt.value = brief;
    form.elements.prompt.focus();
    status.textContent = 'Starting point added. Personalise the design brief and enter your exact wording before generating.';
  };
  const clear = () => { if (url) URL.revokeObjectURL(url); url = null; draft = null; preview.replaceChildren(); };
  const errorText = error => ['failed-precondition', 'resource-exhausted', 'permission-denied', 'invalid-argument'].includes(error.code?.replace('functions/', ''))
    ? error.message : 'Could not finish this step. Your attempt may count. If saving, refresh the library or retry this preview before generating another image.';
  async function task(work) {
    if (busy || disposed) return;
    busy = true;
    const controls = [...section.querySelectorAll('button, input, select, textarea')].map(c => [c, c.disabled]);
    controls.forEach(([c]) => { c.disabled = true; });
    try { await work(); } catch (error) { if (!disposed) status.textContent = errorText(error); }
    finally { busy = false; controls.forEach(([c, disabled]) => { c.disabled = disabled; }); }
  }
  form.onsubmit = event => {
    event.preventDefault();
    const data = new FormData(form);
    const colours = data.getAll('colourHex').map(c => c.trim()).filter(Boolean);
    if (colours.length > 3 || colours.some(c => !/^#[0-9a-f]{6}$/i.test(c))) {
      status.textContent = 'Choose up to three colours or enter six-digit hex codes such as #174F43.'; return;
    }
    void task(async () => {
      clear(); status.textContent = 'Creating your image. Keep this page open; nothing has been added to the library yet…';
      const result = await call('generateAdvertImage', { businessId, prompt: data.get('prompt').trim(), copy: data.get('copy').trim(), orientation: data.get('orientation'),
        brand: { mode: data.get('mode'), sourceId: data.get('mode') === 'new' ? null : data.get('sourceId'), logoId: data.get('logoId') || null,
          logoPlacement: data.get('logoPlacement'), colours, consent: data.get('consent') === 'on' } });
      if (disposed || !section.isConnected) return;
      if (result.contentType !== 'image/webp' || typeof result.base64 !== 'string' || result.base64.length > 8 * 1024 * 1024) throw Error('Invalid preview');
      const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
      draft = { blob: new Blob([bytes], { type: result.contentType }), name: `${data.get('name').trim()}.webp`, requestId: crypto.randomUUID() };
      url = URL.createObjectURL(draft.blob);
      preview.innerHTML = `<figure><img alt="Generated advert preview" style="max-width:100%;max-height:600px"><figcaption>AI-generated preview · review all wording, prices and details before saving.</figcaption></figure>
        <label class="checkbox"><input type="checkbox" data-reviewed>I’ve checked the wording, prices and layout.</label>
        <button class="primary" type="button" data-image-save disabled>Add to media library</button><button class="secondary" type="button" data-image-discard>Discard preview</button>`;
      preview.querySelector('img').src = url;
      status.textContent = `${result.usage.remainingToday} image requests left today (UTC); ${result.usage.remainingTrial} left in this trial. This preview has not been saved.`;
      const save = preview.querySelector('[data-image-save]'), review = preview.querySelector('[data-reviewed]');
      review.onchange = () => { save.disabled = !review.checked; };
      preview.querySelector('[data-image-discard]').onclick = () => {
        if (busy) return;
        const saveStarted = Boolean(draft?.saveStarted);
        clear(); status.textContent = saveStarted
          ? 'Preview discarded. A save was already started; refresh the library to check the retained entry.'
          : 'Preview discarded. No library file was added.';
      };
      save.onclick = () => {
        if (!review.checked || !draft || busy) return;
        void task(async () => {
          status.textContent = 'Adding to your private library and checking playback…';
          draft.saveStarted = true;
          const saved = await saveGeneratedAdvert(draft, businessId, call);
          if (disposed) return;
          clear(); status.textContent = 'Advert added and ready for screens. Refresh your media library, then choose it in a playlist. No screen settings were changed.';
          if (onPlanAdvert) {
            const next = document.createElement('button');
            next.type = 'button'; next.className = 'primary'; next.textContent = 'Plan this advert on a screen';
            next.onclick = () => {
              void task(async () => {
                status.textContent = 'Opening your playlist assistant…';
                try { await onPlanAdvert(saved.mediaId); }
                catch { if (!disposed) status.textContent = 'Your advert is saved. Could not refresh the library; try this button again. No screen settings were changed.'; }
              });
            };
            preview.append(next);
            status.textContent = 'Advert saved and ready for screens. Next, choose a screen and review a playlist draft. No screen settings were changed.';
          }
        });
      };
    });
  };
  return () => { disposed = true; clear(); };
}
