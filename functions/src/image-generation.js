import { createHash } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';
import { decodeImage } from './image-validation.js';

export const advertSizes = { landscape: '1536x864', portrait: '864x1536', square: '1024x1024' };
const fail = (code, message) => { throw new HttpsError(code, message); };
function text(value, max, optional = false) {
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > max || /[\u0000-\u001f\u007f]/u.test(value.replaceAll('\n', ''))) {
    fail('invalid-argument', 'Check your advert description and wording.');
  }
  return value.trim();
}

export function openAIImageGenerator({ apiKey, fetchImpl = fetch }) {
  return async ({ prompt, copy, orientation, safetyId }) => {
    if (!apiKey || !Object.hasOwn(advertSizes, orientation)) throw Error('Image setup unavailable');
    const response = await fetchImpl('https://api.openai.com/v1/images/generations', {
      method: 'POST', signal: AbortSignal.timeout(150000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-2.5-flare', n: 1, size: advertSizes[orientation], quality: 'medium',
        output_format: 'jpeg', output_compression: 95, background: 'opaque', moderation: 'auto', safety_identifier: safetyId,
        prompt: `Create one polished digital signage advertisement with a clear focal point, generous safe margins and legible high-contrast text. Do not invent prices, discounts, opening hours, contact details or claims. Use only the supplied wording; if empty, create an artwork without text.\nDesign brief: ${prompt}\nExact advert wording: ${copy || '(no text)'}` }),
    });
    if (!response.ok) { await response.body?.cancel(); throw Error('Image provider unavailable'); }
    // Bound the JSON before parsing: never follow a provider-supplied URL.
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 12 * 1024 * 1024) throw Error('Image response too large');
      chunks.push(chunk);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const base64 = data.data?.[0]?.b64_json;
    if (data.data?.length !== 1 || typeof base64 !== 'string' || !base64.length || base64.length % 4
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw Error('Invalid image response');
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length > 8 * 1024 * 1024) throw Error('Generated image too large');
    return bytes;
  };
}

export function createImageGeneration({ firestore: db, auth, generate, reserve, now = () => Date.now() }) {
  return async request => {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'prompt', 'copy', 'orientation']);
    const businessId = identifier(request.data.businessId), prompt = text(request.data.prompt, 2000);
    const copy = text(request.data.copy, 500, true), orientation = request.data.orientation;
    if (!Object.hasOwn(advertSizes, orientation)) fail('invalid-argument', 'Choose landscape, portrait or square.');
    const business = db.doc(`businesses/${businessId}`);
    async function access() {
      await authorize(auth, request);
      const [member, entitlement, meta] = await db.getAll(business.collection('members').doc(user.uid),
        business.collection('entitlements').doc('current'), business);
      if (member.data()?.active !== true || member.data()?.role !== 'owner') fail('permission-denied', 'Active business ownership is required.');
      const t = entitlement.data();
      if (!meta.exists || t?.source !== 'trial' || !t.trialModules?.includes('screens') || !t.trialModules?.includes('aiStudio')
        || !(t.trialStartedAt?.toMillis() <= now()) || !(t.trialEndsAt?.toMillis() > now())) fail('failed-precondition', 'Active signage and portal AI trial access is required.');
      if ((meta.data().mediaCount ?? 0) >= 100 || (meta.data().mediaReservedBytes ?? 0) >= 1024 ** 3) fail('resource-exhausted', 'Your media library is full. Free eligible uploads or contact support before creating an advert.');
    }
    await access();
    const reservation = await reserve(businessId);
    let image;
    try {
      const bytes = await generate({ prompt, copy, orientation,
        safetyId: createHash('sha256').update(`discrete-signage:${user.uid}`).digest('hex') });
      if (!Buffer.isBuffer(bytes) || bytes.length > 8 * 1024 * 1024) throw Error('Invalid image size');
      image = await decodeImage(bytes, 'image/jpeg');
      const [width, height] = advertSizes[orientation].split('x').map(Number);
      if (image.width !== width || image.height !== height || image.bytes.length > 6 * 1024 * 1024) throw Error('Unexpected image output');
    } catch { fail('unavailable', 'We couldn’t create a usable image. Try a simpler description later. This attempt counts toward your image allowance.'); }
    finally { await reservation.finish(); }
    await access();
    return { base64: image.bytes.toString('base64'), contentType: image.contentType, width: image.width, height: image.height,
      usage: reservation.usage };
  };
}
