import { campaignDates } from './assistant-campaign.js';

export const dayPresets = { daily: [0, 1, 2, 3, 4, 5, 6], weekdays: [1, 2, 3, 4, 5], weekends: [0, 6] };
const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function timingSummary({ scheduled, days, start, end, startDate, endDate, timezone }) {
  if (!timezone) return 'Set a location time zone before planning.';
  if (!scheduled) return `Every day, all day · ${timezone}. No campaign date limits.`;
  if (!days.length) return 'Choose at least one start day.';
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!validTime(start) || !validTime(end) || start === end)
    return 'Choose different start and end times. For all-day playback, choose Any time.';
  try { campaignDates(startDate, endDate); } catch (error) { return error.message; }
  const key = [...days].sort().join(',');
  const label = key === dayPresets.daily.join(',') ? 'Every day'
    : key === dayPresets.weekdays.join(',') ? 'Monday–Friday'
      : key === dayPresets.weekends.join(',') ? 'Saturday and Sunday' : days.map(day => names[day]).join(', ');
  return `${label}, ${start}–${end}${end < start ? ' the next day (selected days are start days)' : ''} · ${timezone}. `
    + (startDate ? `${startDate} through ${endDate}, inclusive. Playback stops at midnight after the last date.` : 'Repeats weekly, with no campaign date limits.');
}
