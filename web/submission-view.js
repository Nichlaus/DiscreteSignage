export function submissionList(items, escape, clients) {
  if (!items) return '<p>Refresh submissions to load the list.</p>';
  if (!items.length) return '<p>No submissions yet.</p>';
  const labels = { uploading: 'Upload not confirmed', submitted: 'Awaiting validation and review',
    rejected: 'File rejected — upload a supported file', expired: 'Upload expired' };
  return `<ul class="locations submission-list">${items.map(s => `<li><div><strong>${escape(s.name)}</strong>
    ${clients ? `<small>${escape(clients.find(c => c.id === s.advertiserId)?.name ?? 'Client record')}</small>` : ''}
    <small>${escape(labels[s.status] ?? 'Unavailable')} · ${(s.size / 1024 / 1024).toFixed(2)} MiB</small></div>
    ${!clients && s.status === 'uploading' ? `<button class="secondary" data-confirm-submission="${escape(s.id)}">Confirm finished upload</button>` : ''}</li>`).join('')}</ul>`;
}
