export function layoutEditor(screen, choices, escape) {
  const options = (items, selected) => items.map(([id, name]) => `<option value="${escape(id)}" ${id === selected ? 'selected' : ''}>${escape(name)}</option>`).join('');
  const images = choices.filter(m => m.contentType?.startsWith('image/') || m.id === screen.logo?.mediaId);
  return `<label>Screen layout<select name="layout">${options([['single', 'One full-screen playlist'], ['columns', 'Two regions · side by side'], ['rows', 'Two regions · top and bottom']], screen.layout ?? 'single')}</select></label>
    <div class="layout-preview" data-layout-preview aria-label="Layout preview"><span>Playlist 1</span><span>Playlist 2</span></div>
    <p class="field-note">Split layouts use equal halves, each playing independently. Switching to full screen and saving removes playlist 2.</p>
    <fieldset><legend>Logo overlay (optional)</legend><label>Logo image<select data-logo><option value="">No logo</option>${options(images.map(m => [m.id, m.label ?? m.name]), screen.logo?.mediaId)}</select></label>
    <p class="field-note selected-media" data-selected-logo aria-live="polite"></p>
    <p class="field-note">Use a validated image from your library. A transparent PNG or WebP works well. The logo floats above both playlists.</p>
    <div data-logo-options><label>Position<select data-logo-position>${options(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].map(p => [p, p.replace('-', ' · ')]), screen.logo?.position ?? 'top-right')}</select></label>
    <label>Logo size<select data-logo-size>${options([['small', 'Small · 12% of screen'], ['medium', 'Medium · 18% of screen']], screen.logo?.size ?? 'small')}</select></label></div></fieldset>`;
}

export function bindLayout(form) {
  const update = () => {
    const single = form.elements.layout.value === 'single';
    form.querySelector('[data-layout-preview]').dataset.layout = form.elements.layout.value;
    const secondary = form.querySelector('[data-secondary]');
    secondary.hidden = single;
    secondary.querySelectorAll('input, select').forEach(input => {
      const videoDuration = input.matches('[data-duration]') && input.closest('li').querySelector('[data-media]').selectedOptions[0]?.dataset.video === 'true';
      input.disabled = single || videoDuration;
    });
    const logo = form.querySelector('[data-logo]');
    form.querySelector('[data-selected-logo]').textContent = logo.value
      ? `Selected: ${logo.selectedOptions[0].textContent}` : 'No logo will appear on this screen.';
    form.querySelector('[data-logo-options]').hidden = !logo.value;
  };
  form.addEventListener('change', update); update();
}

export function readLogo(form) {
  const mediaId = form.querySelector('[data-logo]').value;
  return mediaId ? { mediaId, position: form.querySelector('[data-logo-position]').value,
    size: form.querySelector('[data-logo-size]').value } : null;
}
