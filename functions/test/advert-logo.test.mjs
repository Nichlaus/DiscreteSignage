import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { placeAdvertLogo } from '../src/advert-logo.js';
import { advertBrand } from '../src/image-references.js';

test('original logo preserves colours and proportions in all four corners without enlarging', async () => {
  const bytes = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } }).webp({ lossless: true }).toBuffer();
  const logo = await sharp({ create: { width: 30, height: 10, channels: 4, background: '#174f43' } }).png().toBuffer();
  for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
    const result = await placeAdvertLogo({ bytes, width: 400, height: 300 }, logo, position);
    const { data, info } = await sharp(result.bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const x = position.endsWith('left') ? 12 : 358, y = position.startsWith('top') ? 12 : 278;
    const pixel = (x, y) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    assert.deepEqual(pixel(x, y), [23, 79, 67]);
    assert.deepEqual(pixel(x + 29, y + 9), [23, 79, 67]);
    assert.deepEqual(pixel(x + 30, y + 10), [255, 255, 255]);
  }
});

test('logo treatment accepts old clients and rejects arbitrary placement', () => {
  const brand = { mode: 'new', sourceId: null, logoId: null, colours: [], consent: false };
  assert.deepEqual(advertBrand(brand), brand);
  assert.throws(() => advertBrand({ ...brand, logoPlacement: 'https://example.test' }));
});

test('large transparent logos fit the bounds without painting their transparent background', async () => {
  const bytes = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } }).webp({ lossless: true }).toBuffer();
  const logo = await sharp(Buffer.from('<svg width="600" height="200"><rect x="150" y="50" width="300" height="100" fill="#174f43"/></svg>')).png().toBuffer();
  const result = await placeAdvertLogo({ bytes, width: 400, height: 300 }, logo, 'top-left');
  const { data } = await sharp(result.bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => [...data.subarray((y * 400 + x) * 3, (y * 400 + x) * 3 + 3)];
  assert.deepEqual(pixel(12, 12), [255, 255, 255]);
  assert.deepEqual(pixel(52, 25), [23, 79, 67]);
  assert.deepEqual(pixel(92, 39), [255, 255, 255]);
});
