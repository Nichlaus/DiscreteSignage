import { createHash } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { fields, identifier } from './provisioning.js';
import { decodeImage } from './image-validation.js';

export function advertBrand(value) {
  const placement = Object.hasOwn(value ?? {}, 'logoPlacement');
  fields(value, ['mode', 'sourceId', 'logoId', 'colours', 'consent', ...(placement ? ['logoPlacement'] : [])]);
  if (placement && !['creative', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(value.logoPlacement)) throw new HttpsError('invalid-argument', 'Choose a logo position.');
  if (!['new', 'edit', 'variation'].includes(value.mode)
    || !Array.isArray(value.colours) || value.colours.length > 3
    || value.colours.some(c => typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c))
    || typeof value.consent !== 'boolean') throw new HttpsError('invalid-argument', 'Check your advert mode and up to three hex colours.');
  for (const id of [value.sourceId, value.logoId]) if (id !== null) identifier(id);
  if ((value.mode === 'new') !== (value.sourceId === null)) throw new HttpsError('invalid-argument', 'Choose an existing advert for edits or variations.');
  if ((value.sourceId || value.logoId) && !value.consent) throw new HttpsError('invalid-argument', 'Confirm using the selected images as described in the form.');
  return value;
}

export async function referenceRecords(business, brand) {
  const records = [];
  for (const [role, id] of [['advert', brand.sourceId], ['logo', brand.logoId]]) {
    if (!id) continue;
    const value = (await business.collection('media').doc(id).get()).data(), p = value?.playback;
    if (value?.status !== 'ready' || p?.policy !== 'image-v1' || p.contentType !== 'image/webp'
      || p.path !== `businesses/${business.id}/media/${id}/playback-v1.webp`
      || !/^\d+$/.test(p.generation) || !/^[a-f0-9]{64}$/.test(p.sha256)
      || !Number.isSafeInteger(p.size) || p.size < 12 || p.size > 8 * 1024 ** 2) {
      throw new HttpsError('failed-precondition', 'Choose ready images from this business, with validated copies up to 8 MiB.');
    }
    records.push({ role, ...p });
  }
  return records;
}

export async function loadImageReferences(bucket, records) {
  const images = [];
  for (const p of records) {
    const file = bucket.file(p.path, { generation: p.generation });
    const [meta] = await file.getMetadata();
    if (String(meta.generation) !== p.generation || Number(meta.size) !== p.size || meta.contentType !== p.contentType) throw Error('Reference changed');
    const [bytes] = await file.download({ start: 0, end: p.size - 1 });
    if (bytes.length !== p.size || createHash('sha256').update(bytes).digest('hex') !== p.sha256) throw Error('Reference mismatch');
    const decoded = await decodeImage(bytes, p.contentType);
    if (decoded.bytes.length > 8 * 1024 ** 2) throw Error('Reference too large');
    images.push({ role: p.role, bytes: decoded.bytes });
  }
  return images;
}
