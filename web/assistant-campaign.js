export function campaignDates(startDate, endDate) {
  if (!startDate && !endDate) return {};
  const valid = value => /^(20\d{2}|21\d{2})-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(startDate) || !valid(endDate) || endDate < startDate)
    throw Error('Choose both campaign dates, with the last date on or after the first. Clear both dates for a repeating schedule.');
  return { startDate, endDate };
}
