import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Official model linked by Google's Hand Landmarker guide; pin bytes, not "latest".
const url = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';
const expected = 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';
const file = new URL('../android-display/app/src/debug/assets/hand_landmarker.task', import.meta.url);
let bytes;
try { bytes = await readFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!bytes) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw Error(`Model download failed: HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
if (bytes.length !== 7819105 || createHash('sha256').update(bytes).digest('hex') !== expected) {
  throw Error('Model checksum mismatch. Review an upstream model update before replacing it.');
}
await mkdir(new URL('.', file), { recursive: true });
await writeFile(file, bytes);
console.log('Verified official hand model for the debug Android build; release assets unchanged.');
