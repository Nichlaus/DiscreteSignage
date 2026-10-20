import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { decodeImage, InvalidMedia } from '../src/image-validation.js';

test('real JPEG/PNG/WebP decoders produce lossless, metadata-free playback images', async () => {
  for (const [format, type] of [['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']]) {
    const input = await sharp({ create: { width: 12, height: 8, channels: 3, background: '#1a8040' } })
      .withMetadata({ orientation: 6 })[format]().toBuffer();
    const output = await decodeImage(input, type);
    assert.equal(output.contentType, 'image/webp');
    assert.equal(output.width, 8); assert.equal(output.height, 12);
    const meta = await sharp(output.bytes).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.exif, undefined); assert.equal(meta.xmp, undefined); assert.equal(meta.icc, undefined);
    const sourcePixels = await sharp(input).autoOrient().removeAlpha().raw().toBuffer();
    const finalPixels = await sharp(output.bytes).removeAlpha().raw().toBuffer();
    assert.deepEqual(finalPixels, sourcePixels);
  }
});
test('full decode rejects truncated images, spoofed formats and excessive pixels', async () => {
  const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#ff8020' } }).png().toBuffer();
  for (const [bytes, type] of [[png.subarray(0, 32), 'image/png'], [png, 'image/jpeg'],
    [Buffer.from('<svg></svg>'), 'image/png'], [png, 'video/mp4']]) {
    await assert.rejects(decodeImage(bytes, type), InvalidMedia);
  }
  const large = await sharp({ create: { width: 4097, height: 4096, channels: 3, background: '#000000' } }).png().toBuffer();
  await assert.rejects(decodeImage(large, 'image/png'), InvalidMedia);
  const animationChunk = Buffer.alloc(20);
  animationChunk.writeUInt32BE(8); animationChunk.write('acTL', 4);
  animationChunk.writeUInt32BE(2, 8);
  await assert.rejects(decodeImage(Buffer.concat([png.subarray(0, 33), animationChunk, png.subarray(33)]),
    'image/png'), /Animated PNG/);
});
