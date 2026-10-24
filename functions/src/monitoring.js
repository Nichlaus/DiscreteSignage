import { GoogleAuth } from 'google-auth-library';
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/monitoring.write'] });

export async function publishMetrics(timeSeries) {
  const client = await auth.getClient();
  await client.request({
    url: 'https://monitoring.googleapis.com/v3/projects/discretesignage/timeSeries',
    method: 'POST', data: { timeSeries }, timeout: 20000,
  });
}
