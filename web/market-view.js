import { markets, marketFor } from '../functions/src/markets.js';

export function marketView(workspace, escape) {
  const market = marketFor(workspace.market);
  return `<section aria-label="Business type"><h3>${escape(market.name)}</h3>
    <p>${escape(market.guide)}</p>
    ${workspace.role === 'owner' ? `<details><summary>Choose your business type</summary>
      <form id="market-form"><label>Business type<select name="market">${markets.map(item => `<option value="${item.id}" ${item.id === market.id ? 'selected' : ''}>${escape(item.name)}</option>`).join('')}</select></label>
      <p class="field-note">This changes your setup guidance only. It does not change playlists, screen access, trial dates or pricing. You can change it later.</p>
      <button class="primary">Save business type</button></form></details>` : ''}</section>`;
}
