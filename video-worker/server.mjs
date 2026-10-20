import { createServer } from 'node:http';
import { decodeVideo, InvalidVideo, MAX_BYTES } from './decode.mjs';

// Cloud Run IAM authenticates the caller before this handler. Never deploy publicly.
export function createWorker(decode = decodeVideo) {
  let busy = false;
  const server = createServer(async (request, response) => {
    const type = request.headers['content-type'];
    const size = Number(request.headers['content-length']);
    if (request.method !== 'POST' || request.url !== '/validate') {
      response.writeHead(404).end(); return;
    }
    if (busy) { response.writeHead(429).end(); return; }
    if (!['video/mp4', 'video/webm'].includes(type) || !Number.isSafeInteger(size) || size < 12 || size > MAX_BYTES) {
      response.writeHead(400).end(); return;
    }
    busy = true;
    try {
      const chunks = []; let received = 0;
      for await (const chunk of request) {
        received += chunk.length;
        if (received > size) throw new InvalidVideo('Invalid upload size.');
        chunks.push(chunk);
      }
      if (received !== size) throw new InvalidVideo('Incomplete upload.');
      const result = await decode(Buffer.concat(chunks), type);
      response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': result.bytes.length,
        'Cache-Control': 'no-store', 'X-Video-Width': result.width,
        'X-Video-Height': result.height, 'X-Video-Duration': result.duration }).end(result.bytes);
    } catch (error) {
      response.writeHead(error instanceof InvalidVideo ? 422 : 503,
        { 'Content-Type': 'text/plain' }).end(error instanceof InvalidVideo ? error.message : 'Video worker unavailable.');
    } finally { busy = false; }
  });
  server.requestTimeout = 150000;
  server.headersTimeout = 10000;
  return server;
}
if (process.env.PORT) createWorker().listen(Number(process.env.PORT), '0.0.0.0');
