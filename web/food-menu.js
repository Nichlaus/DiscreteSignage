import { bindMenuPublishing } from './menu-publish-view.js';

export function priceCents(value) {
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(value)) throw Error('Enter an AUD price from 0 to 9,999.99, with up to two decimal places.');
  const [dollars, cents = ''] = value.split('.');
  return Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
}
const money = cents => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

// Item moves stay inside their category, even if items from different categories are interleaved.
export function moveMenuEntry(entries, id, direction, group = () => '') {
  const index = entries.findIndex(entry => entry.id === id);
  if (index < 0 || ![-1, 1].includes(direction)) return entries;
  let other = index + direction;
  while (other >= 0 && other < entries.length && group(entries[other]) !== group(entries[index])) other += direction;
  if (other < 0 || other >= entries.length) return entries;
  const next = [...entries];
  [next[index], next[other]] = [next[other], next[index]];
  return next;
}

export function menuPreview(menu, escape) {
  return `<h4>Menu preview · AUD</h4><p class="field-note">Portal preview only. Saving does not publish to a screen. Sold-out items remain visible with a label.</p>
    ${menu.categories.length ? menu.categories.map(c => `<section><h4>${escape(c.name)}</h4>
      ${menu.items.filter(i => i.categoryId === c.id).map(i => `<div class="menu-preview-item"><div><strong>${escape(i.name)}</strong>${i.available ? '' : ' <span class="pill">Sold out</span>'}<p>${escape(i.description)}</p></div><strong>${money(i.priceCents)}</strong></div>`).join('') || '<p>No items in this category yet.</p>'}</section>`).join('') : '<p>Add a category to start your menu.</p>'}`;
}

export function foodMenuView(locations, escape) {
  return `<section id="food-menu-section"><h3>Food menu</h3><p>Create categories, add items and mark what is available at each location. Prices are in AUD. Up to 20 categories and 100 items per location.</p>
    <form data-menu-load><label>Menu location<select name="locationId">${locations.map(l => `<option value="${escape(l.id)}">${escape(l.name)}</option>`).join('')}</select></label><button class="secondary">Open menu</button></form>
    <p data-menu-status role="status" aria-live="polite"></p><div data-menu-editor></div></section>`;
}

export function bindFoodMenu(root, businessId, call, escape) {
  const section = root.querySelector('#food-menu-section');
  if (!section) return;
  const editor = section.querySelector('[data-menu-editor]'), status = section.querySelector('[data-menu-status]');
  let menu, locationId, editingItem = '', editingCategory = '', busy = false;
  let clearPublishing = () => {};
  const options = (values, selected) => values.map(v => `<option value="${escape(v.id)}" ${v.id === selected ? 'selected' : ''}>${escape(v.name)}</option>`).join('');
  async function task(fn) {
    if (busy) return;
    busy = true; status.textContent = 'Please wait…';
    const controls = [...section.querySelectorAll('button, input, select')];
    const states = controls.map(c => c.disabled); controls.forEach(c => { c.disabled = true; });
    try { await fn(); } catch (error) { status.textContent = error.code?.startsWith('functions/') ? error.message : 'Could not complete this step. Check your connection and try again.'; }
    finally { controls.forEach((c, i) => { c.disabled = states[i]; }); busy = false; }
  }
  async function save(next) {
    const result = await call('saveFoodMenu', { businessId, locationId, expectedVersion: menu.version, menu: next });
    menu = { ...next, version: result.version }; editingItem = ''; editingCategory = '';
    draw(); status.textContent = 'Menu saved for this location. Screens have not changed.';
  }
  function draw() {
    clearPublishing();
    const item = menu.items.find(i => i.id === editingItem);
    const category = menu.categories.find(c => c.id === editingCategory);
    editor.innerHTML = `<p><strong>Editing ${escape(section.querySelector('[name="locationId"]').selectedOptions[0].textContent)}</strong> · saved version ${menu.version}</p>
      <form data-category><h4>${category ? 'Rename category' : '1. Add a category'}</h4><label>Category name<input name="name" required maxlength="80" value="${escape(category?.name ?? '')}" placeholder="For example, Burgers or Drinks"></label><button class="secondary">${category ? 'Save category name' : 'Add category'}</button>${category ? '<button type="button" class="text-button" data-cancel-category>Cancel editing</button>' : ''}</form>
      <div class="menu-actions">${menu.categories.map((c, index) => `<div><strong>${escape(c.name)}</strong> <button type="button" class="text-button" data-edit-category="${escape(c.id)}">Rename</button> <button type="button" class="text-button" data-move-category="${escape(c.id)}" data-direction="-1" aria-label="Move ${escape(c.name)} up" ${index === 0 ? 'disabled' : ''}>↑</button> <button type="button" class="text-button" data-move-category="${escape(c.id)}" data-direction="1" aria-label="Move ${escape(c.name)} down" ${index === menu.categories.length - 1 ? 'disabled' : ''}>↓</button> <button type="button" class="text-button" data-remove-category="${escape(c.id)}">Remove</button></div>`).join('')}</div>
      ${menu.categories.length ? `<form data-item><h4>${item ? 'Edit item' : '2. Add an item'}</h4><label>Category<select name="categoryId">${options(menu.categories, item?.categoryId)}</select></label>
        <label>Item name<input name="name" required maxlength="100" value="${escape(item?.name ?? '')}" placeholder="For example, Grilled chicken burger"></label>
        <label>Description (optional)<input name="description" maxlength="300" value="${escape(item?.description ?? '')}" placeholder="A short description for your menu"></label>
        <label>Price (AUD)<input name="price" type="text" inputmode="decimal" required pattern="[0-9]{1,4}([.][0-9]{1,2})?" value="${item ? (item.priceCents / 100).toFixed(2) : ''}" placeholder="12.50" aria-describedby="menu-price-help"></label>
        <p id="menu-price-help" class="field-note">Enter the price you want shown, from 0 to 9,999.99. Tax and checkout calculations are not included.</p>
        <label>Availability<select name="available"><option value="true" ${item?.available !== false ? 'selected' : ''}>Available</option><option value="false" ${item?.available === false ? 'selected' : ''}>Sold out</option></select></label>
        <button class="primary">${item ? 'Save item changes' : 'Add item'}</button>${item ? '<button type="button" class="text-button" data-cancel-item>Cancel editing</button>' : ''}</form>` : ''}
      <div class="menu-actions">${menu.categories.map(c => {
        const items = menu.items.filter(i => i.categoryId === c.id);
        return items.length ? `<h4>${escape(c.name)} items</h4>${items.map((i, index) => `<div><strong>${escape(i.name)}</strong>${i.available ? '' : ' · Sold out'} <button type="button" class="text-button" data-edit-item="${escape(i.id)}">Edit</button> <button type="button" class="text-button" data-move-item="${escape(i.id)}" data-direction="-1" aria-label="Move ${escape(i.name)} up" ${index === 0 ? 'disabled' : ''}>↑</button> <button type="button" class="text-button" data-move-item="${escape(i.id)}" data-direction="1" aria-label="Move ${escape(i.name)} down" ${index === items.length - 1 ? 'disabled' : ''}>↓</button> <button type="button" class="text-button" data-remove-item="${escape(i.id)}">Remove</button></div>`).join('')}` : '';
      }).join('')}</div>
      <div class="menu-preview">${menuPreview(menu, escape)}</div><div data-menu-publishing></div>`;
    clearPublishing = bindMenuPublishing(editor.querySelector('[data-menu-publishing]'), { businessId, locationId, menu, call, escape });
    editor.querySelector('[data-category]').onsubmit = event => {
      event.preventDefault(); const name = new FormData(event.target).get('name').trim();
      if (!name) return;
      const categories = category ? menu.categories.map(c => c.id === category.id ? { ...c, name } : c)
        : [...menu.categories, { id: crypto.randomUUID(), name }];
      task(() => save({ categories, items: menu.items }));
    };
    const itemForm = editor.querySelector('[data-item]');
    if (itemForm) itemForm.onsubmit = event => {
      event.preventDefault(); const values = Object.fromEntries(new FormData(event.target));
      let cents;
      try { cents = priceCents(values.price); } catch (error) { status.textContent = error.message; return; }
      const next = { id: item?.id ?? crypto.randomUUID(), categoryId: values.categoryId,
        name: values.name, description: values.description, priceCents: cents, available: values.available === 'true' };
      task(() => save({ categories: menu.categories, items: item ? menu.items.map(i => i.id === item.id ? next : i) : [...menu.items, next] }));
    };
    const formState = () => JSON.stringify([...editor.querySelectorAll('[data-category], [data-item]')]
      .map(form => [...new FormData(form).entries()]));
    const initialState = formState();
    const discardUnfinished = () => formState() === initialState || window.confirm('Discard unfinished menu form changes?');
    editor.querySelectorAll('[data-edit-category]').forEach(button => button.onclick = () => { if (!discardUnfinished()) return; editingCategory = button.dataset.editCategory; draw(); editor.querySelector('[data-category] input').focus(); });
    editor.querySelectorAll('[data-edit-item]').forEach(button => button.onclick = () => { if (!discardUnfinished()) return; editingItem = button.dataset.editItem; draw(); editor.querySelector('[data-item] input').focus(); });
    editor.querySelectorAll('[data-move-category], [data-move-item]').forEach(button => button.onclick = () => {
      if (!discardUnfinished()) return;
      const categories = button.dataset.moveCategory ? moveMenuEntry(menu.categories, button.dataset.moveCategory, Number(button.dataset.direction)) : menu.categories;
      const items = button.dataset.moveItem ? moveMenuEntry(menu.items, button.dataset.moveItem, Number(button.dataset.direction), i => i.categoryId) : menu.items;
      task(() => save({ categories, items }));
    });
    editor.querySelectorAll('[data-remove-item]').forEach(button => button.onclick = () => {
      const target = menu.items.find(i => i.id === button.dataset.removeItem);
      if (!target || !window.confirm(`Remove ${target.name} from this menu? Existing screen snapshots will not change until republished.`) || !discardUnfinished()) return;
      task(() => save({ categories: menu.categories, items: menu.items.filter(i => i.id !== target.id) }));
    });
    editor.querySelectorAll('[data-remove-category]').forEach(button => button.onclick = () => {
      const target = menu.categories.find(c => c.id === button.dataset.removeCategory);
      if (!target) return;
      if (menu.items.some(i => i.categoryId === target.id)) { status.textContent = 'Move or remove all items in this category before removing it.'; return; }
      if (!window.confirm(`Remove the empty category ${target.name}? Existing screen snapshots will not change until republished.`) || !discardUnfinished()) return;
      task(() => save({ categories: menu.categories.filter(c => c.id !== target.id), items: menu.items }));
    });
    const cancel = editor.querySelector('[data-cancel-item]');
    if (cancel) cancel.onclick = () => { if (discardUnfinished()) { editingItem = ''; draw(); } };
    const cancelCategory = editor.querySelector('[data-cancel-category]');
    if (cancelCategory) cancelCategory.onclick = () => { if (discardUnfinished()) { editingCategory = ''; draw(); } };
  }
  section.querySelector('[data-menu-load]').onsubmit = event => {
    event.preventDefault(); const target = new FormData(event.target).get('locationId');
    task(async () => {
      const result = await call('getFoodMenu', { businessId, locationId: target });
      locationId = target; menu = result; editingItem = ''; editingCategory = '';
      draw(); status.textContent = 'Menu loaded. Each Add or Save button saves that change; unfinished form fields are not saved.';
    });
  };
  section.querySelector('[name="locationId"]').onchange = () => { clearPublishing(); editor.innerHTML = ''; menu = null; status.textContent = 'Choose Open menu to load this location. Unfinished form fields are not saved.'; };
  return () => clearPublishing();
}
