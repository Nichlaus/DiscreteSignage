export function mediaReportView(locations, media, report, escape) {
  const options = (items, selected) => items.map(item => `<option value="${escape(item.id)}" ${item.id === selected ? 'selected' : ''}>${escape(item.name)}</option>`).join('');
  return `<section class="media-report" id="reports-section"><h3>Media playback reports</h3>
    <p class="field-note">Reported play starts, not customer views or completed plays. Continuous single-item playback counts once until restarted. Logos and calibration are excluded. Reports may be incomplete when a screen disconnects.</p>
    <form id="media-report-form"><label>Location<select name="locationId">${options(locations, report?.locationId)}</select></label>
    <label>Media<select name="mediaId" required><option value="">Choose media · refresh library if empty</option>${options(media, report?.mediaId)}</select></label>
    <button class="primary" ${media.length ? '' : 'disabled'}>Show report</button></form>
    ${report ? `<p>Calendar days use ${escape(report.timezone)}. Last seven days includes today.</p>
    <dl><dt>Today</dt><dd>${report.today}</dd><dt>Last seven days</dt><dd>${report.last7Days}</dd><dt>All recorded starts</dt><dd>${report.total}</dd></dl>
    ${report.total ? '' : '<p>No play starts have been received for this media at this location yet.</p>'}
    ${report.lastReportedAt ? `<p>Last report received: ${escape(new Intl.DateTimeFormat('en-AU', { timeZone: report.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(report.lastReportedAt))}</p>` : ''}
    <table><caption>Daily play starts</caption><thead><tr><th scope="col">Date</th><th scope="col">Starts</th></tr></thead><tbody>${report.days.map(d => `<tr><th scope="row">${escape(d.date)}</th><td>${d.starts}</td></tr>`).join('')}</tbody></table>` : ''}</section>`;
}
