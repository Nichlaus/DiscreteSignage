let current;
export function closeSubmissionPreview() { current?.(); }

export function showSubmissionPreview({ url, contentType, expiresAt }) {
  closeSubmissionPreview();
  if (!['image/webp', 'video/mp4'].includes(contentType) || expiresAt <= Date.now()) throw Error('Preview expired');
  const dialog = document.createElement('dialog');
  dialog.className = 'submission-preview';
  dialog.setAttribute('aria-label', 'Validated submission preview');
  const caption = document.createElement('p');
  caption.textContent = 'Validated copy · this preview closes within one minute. Previewing does not approve the file.';
  const media = document.createElement(contentType === 'video/mp4' ? 'video' : 'img');
  if (media.tagName === 'VIDEO') { media.controls = true; media.muted = true; media.playsInline = true; }
  else media.alt = 'Validated client submission';
  media.src = url;
  const close = document.createElement('button');
  close.textContent = 'Close preview';
  const cleanup = () => {
    clearTimeout(timer);
    if (media.tagName === 'VIDEO') media.pause();
    media.removeAttribute('src');
    if (media.tagName === 'VIDEO') media.load();
    dialog.remove(); current = undefined;
  };
  const timer = setTimeout(cleanup, Math.min(60000, expiresAt - Date.now()));
  current = cleanup;
  close.onclick = cleanup;
  dialog.addEventListener('cancel', event => { event.preventDefault(); cleanup(); });
  dialog.append(caption, media, close);
  document.body.append(dialog);
  dialog.showModal();
}
