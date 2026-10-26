import sharp from 'sharp';

// Composite only validated local bytes. Never accept URLs or arbitrary coordinates.
export async function placeAdvertLogo(image, logo, position) {
  if (!['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(position)) throw Error('Invalid logo position');
  const margin = Math.round(Math.min(image.width, image.height) * 0.04);
  const { data, info } = await sharp(logo).resize({ width: Math.round(image.width * 0.2),
    height: Math.round(image.height * 0.15), fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
  const left = position.endsWith('left') ? margin : image.width - margin - info.width;
  const top = position.startsWith('top') ? margin : image.height - margin - info.height;
  const bytes = await sharp(image.bytes).composite([{ input: data, left, top }]).webp({ lossless: true }).toBuffer();
  if (bytes.length > 6 * 1024 ** 2) throw Error('Composited advert too large');
  return { ...image, bytes };
}
