export function priceCents(value) {
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(value)) throw Error('Enter an AUD price from 0 to 9,999.99, with up to two decimal places.');
  const [dollars, cents = ''] = value.split('.');
  return Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
}
const money = cents => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

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
    const item = menu.items.find(i => i.id === editingItem);
    const category = menu.categories.find(c => c.id === editingCategory);
    editor.innerHTML = `<p><strong>Editing ${escape(section.querySelector('[name="locationId"]').selectedOptions[0].textContent)}</strong> · saved version ${menu.version}</p>
      <form data-category><h4>${category ? 'Rename category' : '1. Add a category'}</h4><label>Category name<input name="name" required maxlength="80" value="${escape(category?.name ?? '')}" placeholder="For example, Burgers or Drinks"></label><button class="secondary">${category ? 'Save category name' : 'Add category'}</button></form>
      <div class="menu-actions">${menu.categories.map(c => `<button type="button" class="text-button" data-edit-category="${escape(c.id)}">Rename ${escape(c.name)}</button>`).join('')}</div>
      ${menu.categories.length ? `<form data-item><h4>${item ? 'Edit item' : '2. Add an item'}</h4><label>Category<select name="categoryId">${options(menu.categories, item?.categoryId)}</select></label>
        <label>Item name<input name="name" required maxlength="100" value="${escape(item?.name ?? '')}" placeholder="For example, Grilled chicken burger"></label>
        <label>Description (optional)<input name="description" maxlength="300" value="${escape(item?.description ?? '')}" placeholder="A short description for your menu"></label>
        <label>Price (AUD)<input name="price" type="text" inputmode="decimal" required pattern="[0-9]{1,4}([.][0-9]{1,2})?" value="${item ? (item.priceCents / 100).toFixed(2) : ''}" placeholder="12.50" aria-describedby="menu-price-help"></label>
        <p id="menu-price-help" class="field-note">Enter the price you want shown, from 0 to 9,999.99. Tax and checkout calculations are not included.</p>
        <label>Availability<select name="available"><option value="true" ${item?.available !== false ? 'selected' : ''}>Available</option><option value="false" ${item?.available === false ? 'selected' : ''}>Sold out</option></select></label>
        <button class="primary">${item ? 'Save item changes' : 'Add item'}</button>${item ? '<button type="button" class="text-button" data-cancel-item>Cancel editing</button>' : ''}</form>` : ''}
      <div class="menu-actions">${menu.items.map(i => `<button type="button" class="secondary" data-edit-item="${escape(i.id)}">Edit ${escape(i.name)}${i.available ? '' : ' · Sold out'}</button>`).join('')}</div>
      <div class="menu-preview">${menuPreview(menu, escape)}</div>`;
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
    editor.querySelectorAll('[data-edit-category]').forEach(button => button.onclick = () => { editingCategory = button.dataset.editCategory; draw(); editor.querySelector('[data-category] input').focus(); });
    editor.querySelectorAll('[data-edit-item]').forEach(button => button.onclick = () => { editingItem = button.dataset.editItem; draw(); editor.querySelector('[data-item] input').focus(); });
    const cancel = editor.querySelector('[data-cancel-item]');
    if (cancel) cancel.onclick = () => { editingItem = ''; draw(); };
  }
  section.querySelector('[data-menu-load]').onsubmit = event => {
    event.preventDefault(); const target = new FormData(event.target).get('locationId');
    task(async () => {
      const result = await call('getFoodMenu', { businessId, locationId: target });
      locationId = target; menu = result; editingItem = ''; editingCategory = '';
      draw(); status.textContent = 'Menu loaded. Each Add or Save button saves that change; unfinished form fields are not saved.';
    });
  };
  section.querySelector('[name="locationId"]').onchange = () => { editor.innerHTML = ''; menu = null; status.textContent = 'Choose Open menu to load this location. Unfinished form fields are not saved.'; };
}
