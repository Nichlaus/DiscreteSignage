export function parseClientLink(value) {
  const params = new URLSearchParams(value.replace(/^#/, ''));
  const keys = ['businessId', 'advertiserId', 'invitationId'];
  if ([...params.keys()].some(key => !keys.includes(key)) || keys.some(key => params.getAll(key).length > 1)) return null;
  const data = Object.fromEntries(params);
  if (!data.businessId || !data.advertiserId || Object.values(data).some(v => !/^[a-zA-Z0-9_-]{1,128}$/.test(v))) return null;
  return data;
}
export function clientLink(origin, data) {
  return `${origin}/client.html#${new URLSearchParams(data)}`;
}
