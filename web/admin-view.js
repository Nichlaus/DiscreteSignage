export function adminBusinessView(b, escape) {
  const date = value => value ? new Date(value).toLocaleString('en-AU') : 'Not available';
  return `<h2>${escape(b.name)}</h2><p>Business ID: ${escape(b.id)}</p>
    <p>${escape(b.country)} · ${escape(b.currency)} · Entitlement: ${escape(b.entitlementSource)}</p>
    <p>Trial ends: ${escape(date(b.trialEndsAt))}. Snapshot: ${escape(date(b.checkedAt))} (your browser timezone).</p>
    <h3>Locations and screens</h3><p>Showing up to 10 locations and 20 screens per location. Missing reports do not prove a screen is offline.</p>
    ${b.locationsTruncated ? '<p class="notice">More locations exist. This snapshot is incomplete.</p>' : ''}
    ${b.locations.length ? b.locations.map(l => `<section><h4>${escape(l.name)}</h4><p>${escape(l.timezone)} · ${escape(l.id)}</p>
      ${l.screensTruncated ? '<p class="notice">More screens exist at this location.</p>' : ''}
      ${l.screens.length ? `<ul class="locations">${l.screens.map(s => `<li><div><strong>${escape(s.name)}</strong><small>${escape(s.id)}</small><p>${s.active ? 'Active' : 'Revoked'} · Reported state: ${escape(s.state ?? 'No report')}<br>Settings version ${escape(s.version)} · Applied version ${escape(s.appliedVersion)}<br>Last report: ${escape(date(s.reportedAt))}</p></div></li>`).join('')}</ul>` : '<p>No screens in this location.</p>'}</section>`).join('') : '<p>No locations found.</p>'}
    <h3>Media status</h3><p>Up to 50 entries. Private media contents and access links are not exposed.</p>
    ${b.mediaTruncated ? '<p class="notice">More media exists. This is not a complete inventory.</p>' : ''}
    ${b.media.length ? `<ul class="locations">${b.media.map(m => `<li><div><strong>${escape(m.name)}</strong><small>${escape(m.id)}</small><p>${escape(m.status)} · ${escape(m.contentType)} · ${escape(m.size)} bytes</p></div></li>`).join('')}</ul>` : '<p>No media found.</p>'}`;
}
