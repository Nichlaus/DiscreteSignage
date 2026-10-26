import { priceCents } from './food-menu.js';

export function featuredProductPreview(product, escape) {
  if (!product) return '<p>No featured product saved yet.</p>';
  const price = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(product.priceCents / 100);
  return `<h4>${escape(product.name)}</h4><p>${escape(product.description)}</p><strong>${price} AUD</strong>
    <p>${product.available ? 'Available to feature' : 'Unavailable — do not promote'}</p>`;
}
export function featuredProductView(locations, escape) {
  return `<section id="featured-product-section"><h3>Featured product for interactive AI</h3>
    <p>Prepare one product per location for your avatar to introduce. Saving approves these details but does not activate the avatar or change your screens.</p>
    <form data-feature-load><label>Location<select name="locationId">${locations.map(l => `<option value="${escape(l.id)}">${escape(l.name)}</option>`).join('')}</select></label><button>Open featured product</button></form>
    <p data-feature-status role="status"></p><div data-feature-editor></div></section>`;
}
export function bindFeaturedProduct(root, businessId, call, escape) {
  const section = root.querySelector('#featured-product-section');
  if (!section) return;
  const editor = section.querySelector('[data-feature-editor]'), status = section.querySelector('[data-feature-status]');
  const location = section.querySelector('[name="locationId"]');
  let version = 0, busy = false;
  async function task(fn) {
    if (busy) return;
    busy = true; status.textContent = 'Please wait…';
    const controls = [...section.querySelectorAll('input, textarea, select, button')];
    controls.forEach(c => { c.disabled = true; });
    try { await fn(); }
    catch (error) { status.textContent = error.code?.startsWith('functions/') ? error.message : 'Could not complete this step. Please try again.'; }
    finally { controls.forEach(c => { c.disabled = false; }); busy = false; }
  }
  function draw(product) {
    editor.innerHTML = `<form data-feature-save>
      <label>Product name<input name="name" required maxlength="100" value="${escape(product?.name ?? '')}" placeholder="For example, Iced coffee or Everyday tote"></label>
      <label>Short description<input name="description" maxlength="300" placeholder="Only include facts you want customers to see." value="${escape(product?.description ?? '')}"></label>
      <label>Price (AUD)<input name="price" required inputmode="decimal" pattern="[0-9]{1,4}([.][0-9]{1,2})?" placeholder="5.00" value="${product ? (product.priceCents / 100).toFixed(2) : ''}"></label>
      <label>Availability<select name="available"><option value="true">Available to feature</option><option value="false" ${product?.available === false ? 'selected' : ''}>Unavailable — do not promote</option></select></label>
      <label><input type="checkbox" name="approved" required> I have checked the product details and price.</label>
      <button>Approve and save product</button></form>
      <div class="menu-preview"><p>Saved product preview</p>${featuredProductPreview(product, escape)}</div>`;
    editor.querySelector('form').onsubmit = event => {
      event.preventDefault();
      if (!event.target.reportValidity() || busy) return;
      const values = Object.fromEntries(new FormData(event.target));
      let cents;
      try { cents = priceCents(values.price); } catch (error) { status.textContent = error.message; return; }
      const next = { name: values.name.trim(), description: values.description.trim(), priceCents: cents, available: values.available === 'true' };
      if (!next.name) { status.textContent = 'Enter a product name.'; return; }
      task(async () => {
        const result = await call('saveFeaturedProduct', { businessId, locationId: location.value, expectedVersion: version, product: next });
        version = result.version; draw(next);
        status.textContent = 'Product approved and saved. Screen playback has not changed.';
      });
    };
  }
  section.querySelector('[data-feature-load]').onsubmit = event => {
    event.preventDefault();
    task(async () => {
      const result = await call('getFeaturedProduct', { businessId, locationId: location.value });
      version = result.version; draw(result.product); status.textContent = 'Loaded. Review the details before approving changes.';
    });
  };
  location.onchange = () => { editor.innerHTML = ''; status.textContent = 'Open this location to load its product. Unfinished edits are not saved.'; };
}
