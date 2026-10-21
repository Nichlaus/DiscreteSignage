export function playlistEditor(items, choices, escape) {
  const row = item => `<li class="playlist-row">
    <label>Media<select data-media>${choices.map(m => `<option value="${escape(m.id)}" ${m.id === item.mediaId ? 'selected' : ''}>${escape(m.name)}</option>`).join('')}</select></label>
    <label>Image seconds<input data-duration type="number" min="3" max="300" step="1" value="${item.duration}" required></label>
    <div><button type="button" data-move="-1" aria-label="Move item up">↑</button>
    <button type="button" data-move="1" aria-label="Move item down">↓</button>
    <button type="button" data-remove>Remove</button></div></li>`;
  return `<fieldset><legend>Playlist</legend><p class="field-note">Play in order, then repeat. Up to 20 items. Videos play in full, muted; image seconds only affect images. An empty playlist shows the calibration card.</p>
    <ol data-playlist>${items.map(row).join('')}</ol>
    <button type="button" data-add ${choices.length ? '' : 'disabled'}>Add media</button>
    <template>${choices.length ? row({ mediaId: choices[0].id, duration: 10 }) : ''}</template></fieldset>`;
}

export function bindPlaylist(form) {
  const list = form.querySelector('[data-playlist]');
  const update = () => {
    form.querySelector('[data-add]').disabled = list.children.length >= 20 || !form.querySelector('template').innerHTML.trim();
    [...list.children].forEach((row, index) => {
      row.querySelector('[data-move="-1"]').disabled = index === 0;
      row.querySelector('[data-move="1"]').disabled = index === list.children.length - 1;
    });
  };
  form.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const row = button.closest('.playlist-row');
    if (button.hasAttribute('data-add') && list.children.length < 20) {
      list.append(form.querySelector('template').content.cloneNode(true));
    } else if (row && button.hasAttribute('data-remove')) row.remove();
    else if (row && button.dataset.move === '-1' && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling);
    else if (row && button.dataset.move === '1' && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row);
    update();
  });
  update();
}

export function readPlaylist(form) {
  return [...form.querySelectorAll('.playlist-row')].map(row => ({
    mediaId: row.querySelector('[data-media]').value, duration: Number(row.querySelector('[data-duration]').value),
  }));
}
