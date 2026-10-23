export function advertisersView(data, escape) {
  return `<section id="advertisers-section"><h3>Advertising clients</h3>
    <p>Organise the clients who advertise on your screens. Client sign-in, uploads and approval are coming next; creating a record does not grant access.</p>
    <form id="advertiser-form"><label>Client name<input name="name" required minlength="2" maxlength="100" placeholder="For example, Green Street Bakery"></label><button class="primary">Add client</button></form>
    <button id="load-advertisers" class="text-button">Refresh clients</button>
    <p class="field-note">Up to 100 records, including archived clients. Archiving keeps the record; it does not change existing screen playlists.</p>
    ${!data ? '<p>Refresh clients to load your list.</p>' : `${data.truncated ? '<p class="notice">More records exist than this view supports. Contact support.</p>' : ''}
    ${data.items.length ? `<ul class="locations">${data.items.map(c => `<li><div><strong>${escape(c.name)}</strong><small>${c.active ? 'Active' : 'Archived'}</small></div><button class="text-button" data-advertiser="${escape(c.id)}" data-version="${c.version}" data-active="${!c.active}">${c.active ? 'Archive' : 'Restore'}</button></li>`).join('')}</ul>` : '<p>No clients yet. Add your first client above.</p>'}`}</section>`;
}
