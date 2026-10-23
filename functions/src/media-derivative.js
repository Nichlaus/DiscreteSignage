import { createHash } from 'node:crypto';
import { decodeImage, InvalidMedia } from './image-validation.js';
import { decodeVideo } from './video-validation.js';

export const decodeMedia = (bytes, type) => type.startsWith('video/') ? decodeVideo(bytes, type) : decodeImage(bytes, type);

// Originals never become preview/playback URLs. Read one immutable generation and
// save only decoded output, with no metadata or public bearer download token.
export async function mediaDerivative(bucket, value, path, decode = decodeMedia) {
  const original = bucket.file(value.path, { generation: value.generation });
  const [metadata] = await original.getMetadata();
  if (Number(metadata.size) !== value.size || value.size > 20 * 1024 ** 2 || metadata.contentType !== value.contentType) {
    throw new InvalidMedia('Original metadata mismatch.');
  }
  const [bytes] = await original.download({ start: 0, end: value.size - 1 });
  if (bytes.length !== value.size) throw new InvalidMedia('Incomplete media.');
  const result = await decode(bytes, value.contentType);
  const video = value.contentType.startsWith('video/'), policy = video ? 'video-v1' : 'image-v1';
  const hash = createHash('sha256').update(result.bytes).digest('hex'), derived = bucket.file(path);
  try {
    await derived.save(result.bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: result.contentType, cacheControl: 'private, no-store', metadata: { sha256: hash, validationPolicy: policy } } });
  } catch (error) { if (Number(error.code) !== 412) throw error; }
  const [saved] = await derived.getMetadata();
  if (saved.metadata?.sha256 !== hash || saved.metadata?.validationPolicy !== policy
    || Number(saved.size) !== result.bytes.length || saved.contentType !== result.contentType
    || saved.cacheControl !== 'private, no-store' || saved.metadata?.firebaseStorageDownloadTokens) {
    throw Error('Playback object verification failed.');
  }
  return { path, generation: String(saved.generation), width: result.width, height: result.height,
    size: result.bytes.length, contentType: result.contentType, policy, ...(video ? { duration: result.duration } : {}) };
}
