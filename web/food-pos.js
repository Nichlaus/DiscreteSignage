const amount = cents => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
const nextStatus = { new: ['preparing', 'Start preparing'], preparing: ['ready', 'Mark ready'], ready: ['completed', 'Complete order'] };

export function posView(locations, escape) {
  return `<section id="food-pos"><h3>Staff orders · preview</h3>
    <p class="field-note">For testing only. This does not take payments, print receipts or provide a customer order screen. All orders remain unpaid.</p>
    <form data-pos-open><label>Location<select name="locationId" required>${locations.map(l => `<option value="${escape(l.id)}">${escape(l.name)}</option>`).join('')}</select></label>
      <button class="secondary" ${locations.length ? '' : 'disabled'}>Open staff orders</button></form>
    <p data-pos-message role="status" aria-live="polite"></p><div data-pos-body></div></section>`;
}

export function bindPos(root, businessId, userId, call, escape) {
  const section = root.querySelector('#food-pos');
  if (!section) return;
  const message = section.querySelector('[data-pos-message]'), body = section.querySelector('[data-pos-body]');
  let locationId = '', menu = null, cart = {}, orders = [], cursor = '', busy = false;
  const key = () => `food-order-pending:${userId}:${businessId}:${locationId}`;
  const pending = () => { try { return JSON.parse(localStorage.getItem(key()) || 'null'); } catch { return { invalid: true }; } };
  const notify = text => { message.textContent = text; };
  const disable = value => { busy = value; section.querySelectorAll('button, input, select').forEach(control => { control.disabled = value || control.dataset.fixedDisabled === 'true'; }); };
  const problem = error => error.code?.startsWith('functions/') ? error.message : 'Connection problem. Please try again.';
  async function run(action) {
    if (busy) return;
    disable(true); notify('Please wait…');
    try { await action(); } catch (error) { notify(problem(error)); }
    finally { disable(false); }
  }
  async function loadOrders(more = false) {
    const page = await call('listFoodOrders', { businessId, locationId, cursor: more ? cursor : '' });
    orders = more ? [...orders, ...page.orders.filter(o => !orders.some(existing => existing.orderId === o.orderId))] : page.orders;
    cursor = page.nextCursor;
  }
  function draw() {
    const saved = pending();
    const selected = menu?.items.filter(item => Number(cart[item.id]) > 0) ?? [];
    const total = selected.reduce((sum, item) => sum + item.priceCents * Number(cart[item.id]), 0);
    body.innerHTML = `<h4>New order</h4>${saved ? '<div class="notice">An earlier order may have been saved. Retry it, or check and close the request before creating another.</div><button type="button" data-pos-retry>Retry earlier order</button> <button type="button" class="secondary" data-pos-resolve>Check and close request</button>'
      : menu ? `<p class="field-note">Select quantities. Prices are checked again when the order is created. No payment is taken.</p>
        ${menu.categories.map(category => {
          const items = menu.items.filter(item => item.categoryId === category.id && item.available);
          return items.length ? `<fieldset><legend>${escape(category.name)}</legend>${items.map(item => `<label>${escape(item.name)} · ${amount(item.priceCents)}<input type="number" min="0" max="99" step="1" value="${cart[item.id] ?? 0}" data-pos-quantity="${escape(item.id)}" inputmode="numeric"></label>`).join('')}</fieldset>` : '';
        }).join('') || '<p>No available items. Ask the owner to update this location’s menu.</p>'}
        <p data-pos-total>Estimated total: ${amount(total)}</p><button type="button" data-pos-create>Create unpaid order</button>`
      : '<p>Menu unavailable. Existing orders can still be managed below.</p>'}
      <h4>Recent orders</h4><p class="field-note">Refresh to see updates from other staff. All payment statuses shown here are unpaid; this preview does not process payments.</p>
      <button type="button" class="secondary" data-pos-refresh>Refresh orders</button>
      ${orders.length ? orders.map(order => `<article class="notice"><strong>Order ${escape(order.orderId.slice(0, 8))}</strong> · ${escape(order.status)} · ${escape(order.paymentStatus)}
        <p>${escape(new Date(order.createdAt).toLocaleString('en-AU'))} · ${amount(order.totalCents)}</p>
        <ul>${order.items.map(item => `<li>${item.quantity} × ${escape(item.name)} · ${amount(item.unitPriceCents)}</li>`).join('')}</ul>
        ${nextStatus[order.status] ? `<button type="button" data-order-id="${escape(order.orderId)}" data-order-version="${order.version}" data-order-status="${nextStatus[order.status][0]}">${nextStatus[order.status][1]}</button> <button type="button" class="text-button" data-order-id="${escape(order.orderId)}" data-order-version="${order.version}" data-order-status="cancelled">Cancel order</button>` : ''}</article>`).join('') : '<p>No orders on this page.</p>'}
      ${cursor ? '<button type="button" class="secondary" data-pos-more>Load older orders</button>' : ''}`;
    body.querySelectorAll('[data-pos-quantity]').forEach(input => input.addEventListener('input', () => {
      cart[input.dataset.posQuantity] = input.value;
      const chosen = menu.items.filter(item => Number(cart[item.id]) > 0);
      const valid = chosen.every(item => Number.isSafeInteger(Number(cart[item.id])) && Number(cart[item.id]) <= 99);
      body.querySelector('[data-pos-total]').textContent = valid ? `Estimated total: ${amount(chosen.reduce((sum, item) => sum + item.priceCents * Number(cart[item.id]), 0))}` : 'Check item quantities (0–99).';
    }));
    async function submitPending() {
      const saved = pending();
      if (!saved) return;
      if (saved.invalid) { notify('The saved retry record is unreadable. Ask support to check recent orders before creating another.'); return; }
      let result;
      try { result = await call('createFoodOrder', saved); }
      catch (error) {
        notify(`The order is not confirmed. ${problem(error)} Retry the same order or ask support to check it.`);
        return;
      }
      localStorage.removeItem(key()); cart = {}; draw();
      notify(`Order ${result.orderId.slice(0, 8)} saved · unpaid. Refresh orders to see it.`);
      try { await loadOrders(); draw(); } catch { /* The order was saved; an operator can refresh the list. */ }
    }
    body.querySelector('[data-pos-create]')?.addEventListener('click', () => run(async () => {
      if (pending()) { draw(); notify('Confirm the earlier order before creating another.'); return; }
      const inputs = [...body.querySelectorAll('[data-pos-quantity]')];
      if (inputs.some(input => input.value === '' || !Number.isSafeInteger(Number(input.value)) || Number(input.value) < 0 || Number(input.value) > 99)) { notify('Check each quantity is a whole number from 0 to 99.'); return; }
      const items = inputs.filter(input => Number(input.value) > 0).map(input => ({ itemId: input.dataset.posQuantity, quantity: Number(input.value) }));
      if (!items.length || items.length > 30) { notify('Choose between 1 and 30 different items.'); return; }
      localStorage.setItem(key(), JSON.stringify({ businessId, locationId, requestId: crypto.randomUUID(), menuVersion: menu.version, items }));
      draw(); await submitPending();
    }));
    body.querySelector('[data-pos-retry]')?.addEventListener('click', () => run(submitPending));
    body.querySelector('[data-pos-resolve]')?.addEventListener('click', () => {
      if (!window.confirm('Check whether the earlier order was saved? If it was not, its request will be closed so it cannot appear later.')) return;
      run(async () => {
        const saved = pending();
        if (!saved || saved.invalid) { notify('The saved retry record is unreadable. Ask support to check recent orders.'); return; }
        const result = await call('resolveFoodOrderRequest', saved);
        if (!['created', 'not-created'].includes(result.state)) throw Error('Unexpected result');
        localStorage.removeItem(key()); cart = {}; draw();
        notify(result.state === 'created' ? `Earlier order ${result.orderId.slice(0, 8)} was saved · unpaid.` : 'Earlier order was not created; its request is now closed.');
        try { await loadOrders(); draw(); } catch { /* Refresh can be retried separately. */ }
      });
    });
    body.querySelector('[data-pos-refresh]')?.addEventListener('click', () => run(async () => { await loadOrders(); draw(); notify('Orders refreshed.'); }));
    body.querySelector('[data-pos-more]')?.addEventListener('click', () => run(async () => { await loadOrders(true); draw(); notify('Older orders loaded.'); }));
    body.querySelectorAll('[data-order-status]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.orderStatus === 'cancelled' && !window.confirm('Cancel this order? This does not refund a payment.')) return;
      run(async () => { await call('setFoodOrderStatus', { businessId, locationId, orderId: button.dataset.orderId,
        expectedVersion: Number(button.dataset.orderVersion), status: button.dataset.orderStatus });
        await loadOrders(); draw(); notify('Order status updated.'); });
    }));
    if (busy) disable(true);
  }
  section.querySelector('[data-pos-open]').addEventListener('submit', event => {
    event.preventDefault(); const chosen = new FormData(event.currentTarget).get('locationId');
    if (locationId && locationId !== chosen && Object.values(cart).some(value => Number(value) > 0)
      && !window.confirm('Discard the unfinished order for this location?')) return;
    run(async () => {
      locationId = chosen; menu = null; cart = {}; orders = []; cursor = '';
      draw();
      await loadOrders();
      try { menu = await call('getPosMenu', { businessId, locationId }); }
      catch (error) { draw(); notify(`Orders loaded. ${problem(error)}`); return; }
      draw(); notify('Orders and menu loaded.');
    });
  });
}
