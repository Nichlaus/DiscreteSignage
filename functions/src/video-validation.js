import { GoogleAuth } from 'google-auth-library';
import { HttpsError } from 'firebase-functions/v2/https';
import { InvalidMedia } from './image-validation.js';

const auth = new GoogleAuth();
export const videoWorkerConfigured = () => /^https:\/\/[a-z0-9-]+\.australia-southeast1\.run\.app$/.test(process.env.VIDEO_WORKER_URL ?? '');
export async function decodeVideo(bytes, contentType, {
  endpoint = process.env.VIDEO_WORKER_URL, fetcher = fetch,
  getHeaders = async url => (await auth.getIdTokenClient(url)).getRequestHeaders(),
} = {}) {
  if (!endpoint || !/^https:\/\/[a-z0-9-]+\.australia-southeast1\.run\.app$/.test(endpoint)) {
    throw new HttpsError('failed-precondition', 'Video processing is not configured yet.');
  }
  const headers = await getHeaders(endpoint);
  headers.set('Content-Type', contentType);
  const response = await fetcher(`${endpoint}/validate`, { method: 'POST', headers, body: bytes,
    signal: AbortSignal.timeout(130000), redirect: 'error' });
  if (response.status === 422) {
    await response.body?.cancel();
    throw new InvalidMedia('Video could not be fully decoded within the supported limits.');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpsError('unavailable', 'Video processing interrupted. Retry or contact support.');
  }
  const size = Number(response.headers.get('content-length'));
  const width = Number(response.headers.get('x-video-width'));
  const height = Number(response.headers.get('x-video-height'));
  const duration = Number(response.headers.get('x-video-duration'));
  if (response.headers.get('content-type') !== 'video/mp4' || !Number.isSafeInteger(size) || size < 12
    || size > 20 * 1024 * 1024 || !Number.isInteger(width) || !Number.isInteger(height)
    || width < 2 || height < 2 || Math.max(width, height) > 1920 || Math.min(width, height) > 1080
    || !(duration > 0 && duration <= 60)) {
    await response.body?.cancel(); throw Error('Invalid video worker response');
  }
  const chunks = []; let received = 0;
  for await (const chunk of response.body) {
    received += chunk.length;
    if (received > size) throw Error('Oversized video worker response');
    chunks.push(chunk);
  }
  const output = Buffer.concat(chunks);
  if (received !== size || output.toString('ascii', 4, 8) !== 'ftyp') throw Error('Incomplete video worker response');
  return { bytes: output, width, height, duration, contentType: 'video/mp4' };
}
