import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Official model linked by Google's Pose Landmarker guide; pin bytes, not "latest".
const url = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const expected = '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a';
const file = new URL('../android-display/app/src/debug/assets/pose_landmarker_lite.task', import.meta.url);
let bytes;
try { bytes = await readFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!bytes) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw Error(`Model download failed: HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
if (bytes.length !== 5777746 || createHash('sha256').update(bytes).digest('hex') !== expected) {
  throw Error('Model checksum mismatch. Review an upstream model update before replacing it.');
}
await mkdir(new URL('.', file), { recursive: true });
await writeFile(file, bytes);
console.log('Verified official pose model for the debug Android build; release assets unchanged.');
