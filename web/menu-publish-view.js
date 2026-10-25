import { menuDimensions, renderMenuPages, publishMenuPages } from './menu-publish.js';

export function bindMenuPublishing(container, { businessId, locationId, menu, call, escape, upload }) {
  let prepared, busy = false;
  const urls = [];
  container.innerHTML = `<details><summary>Publish saved menu to a screen</summary>
    <p>Publish a snapshot of saved menu version ${menu.version}. Future edits need republishing. Pages show categories, item names, AUD prices and sold-out labels; descriptions stay in the portal.</p>
    <button type="button" data-find-screens class="secondary">Find screens at this location</button>
    <div data-publish-options></div><p data-publish-status role="status"></p><div data-page-preview></div></details>`;
  const status = container.querySelector('[data-publish-status]'), choices = container.querySelector('[data-publish-options]');
  const preview = container.querySelector('[data-page-preview]');
  const clear = () => { urls.splice(0).forEach(URL.revokeObjectURL); prepared = null; preview.innerHTML = ''; };
  async function task(fn) {
    if (busy) return; busy = true;
    const controls = [...container.closest('#food-menu-section').querySelectorAll('button, input, select')];
    const states = controls.map(c => c.disabled); controls.forEach(c => { c.disabled = true; });
    try { await fn(); } catch (error) { status.textContent = error.message || 'Could not publish. Try again.'; }
    finally { controls.forEach((c, i) => { c.disabled = states[i]; }); busy = false; }
  }
  container.querySelector('[data-find-screens]').onclick = () => task(async () => {
    clear(); status.textContent = 'Loading screens…';
    const result = await call('getWorkspace', { businessId });
    const screens = result.workspace.screens.filter(s => s.active && s.locationId === locationId);
    choices.innerHTML = screens.length ? `<label>Screen<select data-target>${screens.map(s => `<option value="${escape(s.id)}">${escape(s.name)}</option>`).join('')}</select></label>
      <label>Menu position<select data-placement><option value="right">Right · keep adverts on the left</option><option value="left">Left · keep adverts on the right</option><option value="bottom">Bottom · keep adverts above</option><option value="top">Top · keep adverts below</option><option value="full">Full screen · replace both playlists</option></select></label>
      <p class="field-note">Publishing replaces the selected region with menu pages, each shown for 15 seconds. When splitting a full-screen playlist, its adverts move to the other region. Existing split screens keep the other region's playlist. Fit scaling applies to both regions; orientation, transitions and logo are kept. An empty other playlist stays blank.</p>
      <button type="button" data-prepare class="secondary">Preview menu pages</button>` : '<p>No active screens at this location. Pair a screen first, then find screens again.</p>';
    status.textContent = '';
    choices.querySelectorAll('select').forEach(select => { select.onchange = clear; });
    const prepare = choices.querySelector('[data-prepare]');
    if (prepare) prepare.onclick = () => task(async () => {
      clear();
      const screen = screens.find(s => s.id === choices.querySelector('[data-target]').value);
      const placement = choices.querySelector('[data-placement]').value;
      const current = await call('getFoodMenu', { businessId, locationId });
      if (current.version !== menu.version) throw Error('The saved menu changed. Open the menu again before publishing.');
      const blobs = await renderMenuPages(current, result.workspace.name, menuDimensions(screen, placement));
      prepared = { screen, placement, menu: current, pages: blobs.map(blob => ({ blob })) };
      preview.innerHTML = blobs.map((blob, i) => {
        const url = URL.createObjectURL(blob); urls.push(url);
        return `<figure><img src="${url}" alt="Menu page ${i + 1}" style="max-width:100%;max-height:540px"><figcaption>Page ${i + 1} of ${blobs.length}</figcaption></figure>`;
      }).join('') + '<button type="button" class="primary" data-publish>Publish these pages to the selected screen</button>';
      status.textContent = `Review ${blobs.length} page(s) for ${screen.name}. These create private library images and use your media allowance. Nothing has been published yet.`;
      preview.querySelector('[data-publish]').onclick = () => task(async () => {
        const currentMenu = await call('getFoodMenu', { businessId, locationId });
        if (currentMenu.version !== prepared.menu.version) throw Error('Menu changed. Open it again before publishing.');
        await publishMenuPages({ ...prepared, businessId, call, upload, progress: text => { status.textContent = text; } });
        clear(); status.textContent = 'Menu assigned. Refresh screen status and check the actual display. Menu edits require republishing. Refresh the library to see the generated pages.';
      });
    });
  });
  return clear;
}
