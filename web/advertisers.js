export function advertisersView(data, escape, invitation) {
  return `<section id="advertisers-section"><h3>Advertising clients</h3>
    <p>Organise your advertising clients, then invite each client to submit media privately. Submissions cannot play until validation and owner approval are complete.</p>
    <form id="advertiser-form"><label>Client name<input name="name" required minlength="2" maxlength="100" placeholder="For example, Green Street Bakery"></label><button class="primary">Add client</button></form>
    <button id="load-advertisers" class="text-button">Refresh clients</button>
    <p class="field-note">Up to 100 records, including archived clients. Archiving stops client access and invalidates their invitations. Existing playlists keep playing. Restored clients need a new invitation.</p>
    ${data?.items.some(c => c.active) ? `<details><summary>Invite a client</summary>
    <p>One login per client. This grants access only to that client’s workspace, without screen controls or publishing permission.</p>
    <form id="advertiser-invite-form"><label>Client<select name="advertiserId">${data.items.filter(c => c.active).map(c => `<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('')}</select></label>
    <label>Client’s email<input name="email" type="email" required maxlength="254" autocomplete="email" placeholder="client@example.com"></label>
    <p class="field-note">The link lasts 7 days and works only with this verified email. A new link replaces the previous invitation. When accepted, it replaces the client’s previous login. Share the link yourself; we won’t send an email.</p>
    <button class="primary">Create client invitation</button></form></details>` : ''}
    ${invitation ? `<div class="notice" role="status"><strong>Invitation ready for ${escape(invitation.email)}</strong><p>Expires ${escape(new Date(invitation.expiresAt).toLocaleString('en-AU'))}. Share privately with this client.</p><label>Client invitation link<input id="advertiser-link" readonly value="${escape(invitation.url)}"></label><button id="copy-advertiser-link" class="secondary">Copy invitation link</button><p id="advertiser-copy-status" aria-live="polite"></p></div>` : ''}
    ${!data ? '<p>Refresh clients to load your list.</p>' : `${data.truncated ? '<p class="notice">More records exist than this view supports. Contact support.</p>' : ''}
    ${data.items.length ? `<ul class="locations">${data.items.map(c => `<li><div><strong>${escape(c.name)}</strong><small>${c.active ? 'Active' : 'Archived'}</small></div><button class="text-button" data-advertiser="${escape(c.id)}" data-version="${c.version}" data-active="${!c.active}">${c.active ? 'Archive' : 'Restore'}</button></li>`).join('')}</ul>` : '<p>No clients yet. Add your first client above.</p>'}`}</section>`;
}
