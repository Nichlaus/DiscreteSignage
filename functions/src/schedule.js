import { HttpsError } from 'firebase-functions/v2/https';

export function schedule(value) {
  const time = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  if (!value || Object.keys(value).sort().join(',') !== 'days,end,start'
    || !Array.isArray(value.days) || !value.days.length || value.days.length > 7
    || value.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)
    || new Set(value.days).size !== value.days.length
    || !time(value.start) || !time(value.end) || value.start === value.end) {
    throw new HttpsError('invalid-argument', 'Choose at least one day and different start and end times.');
  }
  return { days: [...value.days].sort(), start: value.start, end: value.end };
}

// Days identify the start day. An overnight Monday slot includes early Tuesday.
export function scheduledRegions(regions, timezone, now) {
  if (!regions.flat().some(item => item.schedule)) return { regions, expiresAt: now + 60000 };
  if (!timezone) throw new HttpsError('failed-precondition', 'The location needs a timezone.');
  const format = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const activeAt = instant => {
    const p = Object.fromEntries(format.formatToParts(instant).map(p => [p.type, p.value]));
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
    const time = `${p.hour}:${p.minute}`;
    return regions.map(items => items.filter(item => {
      if (!item.schedule) return true;
      const { days, start, end } = item.schedule;
      return start < end ? days.includes(day) && time >= start && time < end
        : (days.includes(day) && time >= start) || (days.includes((day + 6) % 7) && time < end);
    }));
  };
  const current = activeAt(now);
  const boundary = Math.floor(now / 60000) * 60000 + 60000;
  // Never grant playback across a change, including a daylight-saving jump.
  const changes = JSON.stringify(current) !== JSON.stringify(activeAt(boundary));
  return { regions: current, expiresAt: changes ? boundary : now + 60000 };
}
