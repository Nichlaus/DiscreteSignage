// Keep input guidance next to the field, and leave server authorization authoritative.
export function bindFormHelp(root) {
  const password = root.querySelector('[name="password"]');
  root.querySelector('[data-password-toggle]')?.addEventListener('click', event => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    event.currentTarget.textContent = visible ? 'Hide password' : 'Show password';
    event.currentTarget.setAttribute('aria-pressed', String(visible));
  });
  const code = root.querySelector('#pair-form [name="code"]');
  code?.addEventListener('input', () => { code.value = code.value.replace(/[\s-]/g, '').toUpperCase(); });
  const locations = [...root.querySelectorAll('#invite-form [name="locationIds"]')];
  const checkLocations = () => locations[0]?.setCustomValidity(
    locations.some(input => input.checked) ? '' : 'Choose at least one location for this teammate.');
  locations.forEach(input => input.addEventListener('change', checkLocations));
  checkLocations();
  const file = root.querySelector('#media-form [name="file"]');
  file?.addEventListener('change', () => {
    const chosen = file.files[0];
    const hint = root.querySelector('#file-help');
    let error = '';
    if (chosen) {
      const video = ['video/mp4', 'video/webm'].includes(chosen.type);
      if (!video && !['image/jpeg', 'image/png', 'image/webp'].includes(chosen.type)) error = 'Choose a JPG, PNG, WebP, MP4 or WebM file.';
      else if (!chosen.size || chosen.size > (video ? 100 : 20) * 1024 * 1024) error = video ? 'Choose a video under 100 MiB.' : 'Choose an image under 20 MiB.';
      hint.textContent = error || `${chosen.name} · ${(chosen.size / 1024 / 1024).toFixed(2)} MiB. ${video && chosen.size > 20 * 1024 * 1024 ? 'This can be stored, but is too large for screen playback. Choose a clip under 20 MiB to play it.' : 'Ready to upload. We’ll check it before it can play on a screen.'}`;
    } else hint.textContent = 'Choose one file to upload. Your original is kept private.';
    file.setCustomValidity(error);
  });
}

export function formFeedback(form, text, error = false) {
  let feedback = form.querySelector('[data-feedback]');
  if (!feedback) {
    feedback = document.createElement('p'); feedback.dataset.feedback = '';
    feedback.className = 'notice'; feedback.tabIndex = -1; form.prepend(feedback);
  }
  feedback.setAttribute('role', error ? 'alert' : 'status');
  feedback.classList.toggle('form-error', error);
  feedback.textContent = text;
  if (error) feedback.focus();
}
