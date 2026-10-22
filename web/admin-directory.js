export function mountDirectory(host, load, select) {
  let revision = 0, active = false, busy = false, cursor = null, next = null, previous = [];
  host.innerHTML = `<h2>Choose a business</h2><p>Browse 20 businesses at a time, ordered by name. Select one to view its diagnostics.</p>
    <button data-page="first">Load businesses</button><button data-page="previous" hidden>Previous</button><button data-page="next" hidden>Next</button>
    <p role="status"></p><ul class="locations"></ul>`;
  const status = host.querySelector('[role="status"]'), list = host.querySelector('ul');
  const first = host.querySelector('[data-page="first"]'), back = host.querySelector('[data-page="previous"]'), forward = host.querySelector('[data-page="next"]');
  const controls = () => {
    host.querySelectorAll('button').forEach(b => { b.disabled = busy; });
    back.hidden = !previous.length; forward.hidden = !next;
  };
  async function show(target, history) {
    if (!active || busy) return;
    const current = revision; busy = true; controls(); status.textContent = 'Loading businesses…';
    try {
      const page = await load({ after: target });
      if (current !== revision) return;
      cursor = target; previous = history; next = page.next;
      list.replaceChildren();
      for (const business of page.businesses) {
        const row = document.createElement('li'), content = document.createElement('div'), name = document.createElement('strong'), detail = document.createElement('small'), button = document.createElement('button');
        name.textContent = business.name; detail.textContent = `${business.country ?? ''} · ${business.currency ?? ''} · ${business.id}`;
        button.textContent = 'View diagnostics'; button.setAttribute('aria-label', `View diagnostics for ${business.name}`);
        button.onclick = () => select(business.id);
        content.append(name, detail); row.append(content, button); list.append(row);
      }
      first.textContent = 'Refresh from start';
      status.textContent = page.businesses.length ? `Showing ${page.businesses.length} ${page.businesses.length === 1 ? 'business' : 'businesses'}. This access was audited.` : 'No businesses on this page.';
    } catch (error) {
      if (current !== revision) return;
      status.textContent = error.code === 'functions/permission-denied' ? 'Platform permission and multi-factor sign-in are required.'
        : error.code === 'functions/failed-precondition' ? 'The business list changed. Choose Refresh from start.'
        : 'Businesses could not load. Check your connection and try again.';
    } finally { if (current === revision) { busy = false; controls(); } }
  }
  first.onclick = () => show(null, []);
  back.onclick = () => show(previous.at(-1), previous.slice(0, -1));
  forward.onclick = () => show(next, [...previous, cursor]);
  return enabled => {
    revision++; active = enabled; busy = false; cursor = next = null; previous = [];
    host.hidden = !enabled; list.replaceChildren(); status.textContent = ''; first.textContent = 'Load businesses'; controls();
  };
}
