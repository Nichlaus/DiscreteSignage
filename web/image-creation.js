import { uploadMedia } from './media-upload.js';

export function imageCreationView() {
  return `<section id="image-creation-section"><h3>Create an advert with AI</h3>
    <p>Describe your advert, preview the image, then choose whether to add it to your private media library. Nothing is sent to a screen automatically.</p>
    <form data-image-create>
      <label>Advert name<input name="name" required maxlength="100" placeholder="e.g. Weekend special"></label>
      <label>Screen shape<select name="orientation"><option value="landscape">Landscape · 16:9 (1536 × 864)</option><option value="portrait">Portrait · 9:16 (864 × 1536)</option><option value="square">Square · 1:1 (1024 × 1024)</option></select></label>
      <label>Describe the look<textarea name="prompt" required maxlength="2000" rows="4" placeholder="A welcoming coffee advert with a warm cream background, a large cup on the right and clear space for the headline."></textarea></label>
      <label>Words to include (optional)<textarea name="copy" maxlength="500" rows="3" placeholder="Fresh coffee\nMade for your morning"></textarea></label>
      <p class="field-note">Include exact prices and offer conditions if needed. Leave wording empty for artwork without text. Your description and wording go to OpenAI; your library files and account details are not sent. A pseudonymous safety identifier accompanies the request. Do not include private customer information.</p>
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

export function bindImageCreation(root, businessId, call) {
  const section = root.querySelector('#image-creation-section');
  if (!section) return () => {};
  const form = section.querySelector('form'), status = section.querySelector('[data-image-status]');
  const preview = section.querySelector('[data-image-preview]');
  let url, draft, busy = false, disposed = false;
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
    void task(async () => {
      clear(); status.textContent = 'Creating your image. Keep this page open; nothing has been added to the library yet…';
      const result = await call('generateAdvertImage', { businessId, prompt: data.get('prompt').trim(), copy: data.get('copy').trim(), orientation: data.get('orientation') });
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
          await saveGeneratedAdvert(draft, businessId, call);
          if (disposed) return;
          clear(); status.textContent = 'Advert added and ready for screens. Refresh your media library, then choose it in a playlist. No screen settings were changed.';
        });
      };
    });
  };
  return () => { disposed = true; clear(); };
}
