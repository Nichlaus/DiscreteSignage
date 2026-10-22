const days = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];

export function scheduleEditor(value, escape) {
  return `<fieldset data-schedule><legend>When should this advert play?</legend>
    <label>Availability<select data-schedule-mode><option value="always">Any time</option><option value="weekly" ${value ? 'selected' : ''}>Selected days and hours</option></select></label>
    <div data-schedule-hours ${value ? '' : 'hidden'}>
      <div class="schedule-days">${days.map(([day, name]) => `<label><input type="checkbox" data-day value="${day}" ${(value?.days ?? [1, 2, 3, 4, 5]).includes(day) ? 'checked' : ''}>${name}</label>`).join('')}</div>
      <label>Start time<input type="time" data-start value="${escape(value?.start ?? '09:00')}"></label>
      <label>End time<input type="time" data-end value="${escape(value?.end ?? '17:00')}"></label>
      <label class="checkbox"><input type="checkbox" data-date-limited ${value?.startDate ? 'checked' : ''}>Limit this advert to a date range</label>
      <div data-campaign-dates ${value?.startDate ? '' : 'hidden'}>
        <label>First date<input type="date" data-first-date min="2000-01-01" max="2199-12-31" value="${escape(value?.startDate ?? '')}"></label>
        <label>Last date<input type="date" data-last-date min="2000-01-01" max="2199-12-31" value="${escape(value?.endDate ?? '')}"></label>
        <p class="field-note">Both dates are included, in this location’s timezone. Playback stops at midnight after the last date, even for an overnight slot. Your selected days and hours still apply.</p>
      </div>
      <p class="field-note">Repeats weekly. The end time is excluded. If it is earlier than the start, playback ends the following day. Other eligible items keep playing in playlist order.</p>
    </div></fieldset>`;
}

export function updateSchedule(row) {
  const weekly = row.querySelector('[data-schedule-mode]').value === 'weekly';
  row.querySelector('[data-schedule-hours]').hidden = !weekly;
  const start = row.querySelector('[data-start]'), end = row.querySelector('[data-end]');
  start.required = end.required = weekly;
  row.querySelector('[data-day]').setCustomValidity(weekly && !row.querySelector('[data-day]:checked')
    ? 'Choose at least one day.' : '');
  end.setCustomValidity(weekly && start.value === end.value ? 'Choose an end time different from the start.' : '');
  const limited = weekly && row.querySelector('[data-date-limited]').checked;
  row.querySelector('[data-campaign-dates]').hidden = !limited;
  const first = row.querySelector('[data-first-date]'), last = row.querySelector('[data-last-date]');
  first.required = last.required = limited;
  first.disabled = last.disabled = !limited;
  last.setCustomValidity(limited && first.value && last.value && last.value < first.value
    ? 'The last date must be on or after the first date.' : '');
}

export function readSchedule(row) {
  return row.querySelector('[data-schedule-mode]').value === 'weekly' ? { schedule: {
    days: [...row.querySelectorAll('[data-day]:checked')].map(input => Number(input.value)),
    start: row.querySelector('[data-start]').value, end: row.querySelector('[data-end]').value,
    ...(row.querySelector('[data-date-limited]').checked ? {
      startDate: row.querySelector('[data-first-date]').value, endDate: row.querySelector('[data-last-date]').value,
    } : {}),
  } } : {};
}
