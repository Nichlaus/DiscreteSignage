export function submissionList(items, escape, clients) {
  if (!items) return '<p>Refresh submissions to load the list.</p>';
  if (!items.length) return '<p>No submissions yet.</p>';
  const labels = { uploading: 'Upload not confirmed', submitted: 'Awaiting validation and review',
    rejected: 'File rejected — upload a supported file', expired: 'Upload expired',
    validating: 'Checking the file', 'validation-failed': 'File did not pass validation',
    review: 'Ready for owner review', approved: 'Approved for the media library',
    declined: 'Declined by the business', withdrawn: 'Approval withdrawn' };
  return `<ul class="locations submission-list">${items.map(s => `<li><div><strong>${escape(s.name)}</strong>
    ${clients ? `<small>${escape(clients.find(c => c.id === s.advertiserId)?.name ?? 'Client record')}</small>` : ''}
    <small>${escape(labels[s.status] ?? 'Unavailable')} · ${(s.size / 1024 / 1024).toFixed(2)} MiB</small>
    ${s.reason ? `<small>${escape(s.reason)}</small>` : ''}</div>
    ${clients && s.canValidate ? `<button class="secondary" data-validate-submission="${escape(s.id)}">Validate file</button>` : ''}
    ${clients && ['review', 'approved'].includes(s.status) ? `<div class="submission-review">
      <button class="secondary" data-preview-submission="${escape(s.id)}">Preview validated file</button>
      <form data-review-submission="${escape(s.id)}" data-version="${s.version}">
        <label>Decision<select name="decision" required><option value="">Choose a decision</option>${s.status === 'review'
          ? '<option value="approve">Approve for library</option><option value="reject">Decline submission</option>'
          : '<option value="withdraw">Withdraw approval</option>'}</select></label>
        <label>Reason <small>Required for declining or withdrawing; shared with the client.</small><input name="reason" maxlength="300"></label>
        <p>${s.status === 'review' ? 'Approval adds this file to your library. Assign it to a playlist separately.'
          : 'Withdrawal stops new playback access. Screens may finish their current short playback lease. Replace this file in affected playlists to avoid a blank screen.'}</p>
        <button type="submit">Save decision</button>
      </form></div>` : ''}
    ${!clients && s.status === 'uploading' ? `<button class="secondary" data-confirm-submission="${escape(s.id)}">Confirm finished upload</button>` : ''}</li>`).join('')}</ul>`;
}
