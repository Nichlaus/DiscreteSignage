import { HttpsError } from 'firebase-functions/v2/https';

export function schedule(value) {
  const time = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  const keys = value && Object.keys(value).sort().join(',');
  if (!value || !['days,end,start', 'days,end,endDate,start,startDate'].includes(keys)
    || !Array.isArray(value.days) || !value.days.length || value.days.length > 7
    || value.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)
    || new Set(value.days).size !== value.days.length
    || !time(value.start) || !time(value.end) || value.start === value.end) {
    throw new HttpsError('invalid-argument', 'Choose at least one day and different start and end times.');
  }
  const result = { days: [...value.days].sort(), start: value.start, end: value.end };
  if (Object.hasOwn(value, 'startDate')) {
    const date = v => typeof v === 'string' && /^(20\d{2}|21\d{2})-\d{2}-\d{2}$/.test(v)
      && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
    if (!date(value.startDate) || !date(value.endDate) || value.endDate < value.startDate) {
      throw new HttpsError('invalid-argument', 'Choose valid first and last dates, with the last date on or after the first.');
    }
    Object.assign(result, { startDate: value.startDate, endDate: value.endDate });
  }
  return result;
}

// Days identify the start day. An overnight Monday slot includes early Tuesday.
export function scheduledRegions(regions, timezone, now, horizon = 60000) {
  if (!Number.isFinite(horizon) || horizon < 1 || horizon > 86400000) throw new Error('Invalid playback horizon');
  if (!regions.flat().some(item => item.schedule)) return { regions, expiresAt: now + horizon };
  if (!timezone) throw new HttpsError('failed-precondition', 'The location needs a timezone.');
  const format = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const activeAt = instant => {
    const p = Object.fromEntries(format.formatToParts(instant).map(p => [p.type, p.value]));
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
    const time = `${p.hour}:${p.minute}`;
    const date = `${p.year}-${p.month}-${p.day}`;
    return regions.map(items => items.filter(item => {
      if (!item.schedule) return true;
      const { days, start, end, startDate, endDate } = item.schedule;
      // Campaign dates bound actual playback, including the tail of overnight slots.
      if (startDate && (date < startDate || date > endDate)) return false;
      return start < end ? days.includes(day) && time >= start && time < end
        : (days.includes(day) && time >= start) || (days.includes((day + 6) % 7) && time < end);
    }));
  };
  const current = activeAt(now);
  const boundary = Math.floor(now / 60000) * 60000 + 60000;
  // Never grant playback across a change, including a daylight-saving jump.
  const identity = JSON.stringify(current);
  for (let instant = boundary; instant < now + horizon; instant += 60000) {
    if (identity !== JSON.stringify(activeAt(instant))) return { regions: current, expiresAt: instant };
  }
  return { regions: current, expiresAt: now + horizon };
}
