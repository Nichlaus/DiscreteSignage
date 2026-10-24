import { scheduleEditor, updateSchedule, readSchedule } from './schedule-editor.js';

export function playlistEditor(items, choices, escape, title = 'What should this screen play?') {
  const row = item => `<li class="playlist-row">
    <label>Choose media<select data-media>${choices.map(m => `<option value="${escape(m.id)}" data-video="${m.contentType?.startsWith('video/') === true}" ${m.id === item.mediaId ? 'selected' : ''}>${escape(m.label ?? m.name)}</option>`).join('')}</select></label>
    <label data-duration-label>Show image for (seconds)<input data-duration type="number" min="3" max="300" step="1" value="${item.duration}" required></label>
    <p class="field-note" data-video-note hidden>Video plays in full, without sound.</p>
    ${scheduleEditor(item.schedule, escape)}
    <div><button type="button" data-move="-1" aria-label="Move item up">↑</button>
    <button type="button" data-move="1" aria-label="Move item down">↓</button>
    <button type="button" data-remove>Remove</button></div></li>`;
  return `<fieldset data-playlist-editor><legend>${escape(title)}</legend><p class="field-note">Items play from top to bottom, then repeat. Choose up to 20 items. Images can stay on screen for 3–300 seconds.</p>
    <p class="field-note" data-playlist-empty ${items.length ? 'hidden' : ''}>Your playlist is empty. Add media below. If you leave it empty, this region has no adverts to play.</p>
    ${choices.length ? '' : '<p class="field-note">Upload and check a file in the media library first, then refresh the library to make it available here.</p>'}
    <ol data-playlist>${items.map(row).join('')}</ol>
    <p class="field-note" data-playlist-count aria-live="polite"></p>
    <button class="secondary" type="button" data-add ${choices.length ? '' : 'disabled'}>+ Add another item</button>
    <template>${choices.length ? row({ mediaId: choices[0].id, duration: 10 }) : ''}</template></fieldset>`;
}

export function bindPlaylist(form) {
  const list = form.querySelector('[data-playlist]');
  const update = () => {
    form.querySelector('[data-playlist-empty]').hidden = list.children.length > 0;
    form.querySelector('[data-playlist-count]').textContent = `${list.children.length} of 20 items${list.children.length === 20 ? ' · playlist full' : ''}`;
    form.querySelector('[data-add]').disabled = list.children.length >= 20 || !form.querySelector('template').innerHTML.trim();
    [...list.children].forEach((row, index) => {
      const name = row.querySelector('[data-media]').selectedOptions[0]?.textContent ?? 'media';
      row.querySelector('[data-remove]').setAttribute('aria-label', `Remove item ${index + 1}: ${name}`);
      row.querySelector('[data-move="-1"]').setAttribute('aria-label', `Move item ${index + 1} up: ${name}`);
      row.querySelector('[data-move="1"]').setAttribute('aria-label', `Move item ${index + 1} down: ${name}`);
      updateSchedule(row);
      const video = row.querySelector('[data-media]').selectedOptions[0]?.dataset.video === 'true';
      row.querySelector('[data-duration-label]').hidden = video;
      row.querySelector('[data-duration]').disabled = video;
      row.querySelector('[data-video-note]').hidden = !video;
      row.querySelector('[data-move="-1"]').disabled = index === 0;
      row.querySelector('[data-move="1"]').disabled = index === list.children.length - 1;
    });
  };
  form.addEventListener('change', update);
  form.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const row = button.closest('.playlist-row');
    let focus;
    let announcement;
    if (button.hasAttribute('data-add') && list.children.length < 20) {
      list.append(form.querySelector('template').content.cloneNode(true));
      focus = list.lastElementChild.querySelector('select');
    } else if (row && button.hasAttribute('data-remove')) {
      const next = row.nextElementSibling ?? row.previousElementSibling;
      row.remove(); focus = next?.querySelector('select') ?? form.querySelector('[data-add]');
    }
    else if (row && button.dataset.move === '-1' && row.previousElementSibling) {
      list.insertBefore(row, row.previousElementSibling); focus = row.querySelector('select');
    } else if (row && button.dataset.move === '1' && row.nextElementSibling) {
      list.insertBefore(row.nextElementSibling, row); focus = row.querySelector('select');
    }
    if (focus && button.hasAttribute('data-move')) announcement = `Item moved to position ${[...list.children].indexOf(row) + 1}.`;
    update();
    if (announcement) form.querySelector('[data-playlist-count]').textContent += ` · ${announcement}`;
    // Update disabled states before focusing, including Add after removing the only item.
    focus?.focus();
  });
  update();
}

export function readPlaylist(form) {
  return [...form.querySelectorAll('.playlist-row')].map(row => ({
    mediaId: row.querySelector('[data-media]').value,
    duration: row.querySelector('[data-media]').selectedOptions[0]?.dataset.video === 'true'
      ? 10 : Number(row.querySelector('[data-duration]').value),
    ...readSchedule(row),
  }));
}
