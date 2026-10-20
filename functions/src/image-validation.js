import sharp from 'sharp';
import { matchesSignature } from './media.js';

export class InvalidMedia extends Error {}
const formats = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
export async function decodeImage(bytes, contentType) {
  if (!formats[contentType] || !matchesSignature(contentType, bytes)) {
    throw new InvalidMedia('Only still JPEG, PNG and WebP images are supported for playback.');
  }
  // libvips can expose only the first APNG frame; reject animation explicitly.
  if (contentType === 'image/png') {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = bytes.readUInt32BE(offset);
      if (offset + length + 12 > bytes.length) throw new InvalidMedia('Incomplete PNG chunk.');
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (type === 'acTL') throw new InvalidMedia('Animated PNG playback is not supported.');
      offset += length + 12;
      if (type === 'IEND') break;
    }
  }
  try {
    const input = sharp(bytes, { failOn: 'warning', limitInputPixels: 16_777_216, sequentialRead: true });
    const metadata = await input.metadata();
    if (metadata.format !== formats[contentType] || (metadata.pages ?? 1) !== 1
      || !metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192) {
      throw new InvalidMedia('Unsupported image format, animation or dimensions.');
    }
    // Full decode + lossless derivative strips metadata and embedded payloads.
    // Auto-orient before stripping EXIF; never resize or re-encode the original.
    const { data, info } = await input.autoOrient().webp({ lossless: true, effort: 2 })
      .timeout({ seconds: 30 }).toBuffer({ resolveWithObject: true });
    if (data.length > 20 * 1024 * 1024) throw new InvalidMedia('The sanitized image exceeds the playback size limit.');
    return { bytes: data, width: info.width, height: info.height, contentType: 'image/webp' };
  } catch (error) {
    if (error instanceof InvalidMedia) throw error;
    throw new InvalidMedia('The image cannot be fully decoded within the supported limits.');
  }
}
