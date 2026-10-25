import { uploadMedia } from './media-upload.js';

export function menuScreenPlan(screen, placement, mediaIds) {
  if (!['full', 'left', 'right', 'top', 'bottom'].includes(placement)) throw Error('Choose a menu position.');
  if (!screen.active || !Number.isSafeInteger(screen.version)) throw Error('Choose an active screen.');
  if (!mediaIds.length || mediaIds.length > 20) throw Error('A menu needs 1–20 pages.');
  const pages = mediaIds.map(mediaId => ({ mediaId, duration: 15 }));
  const primary = screen.playlist ?? (screen.mediaId ? [{ mediaId: screen.mediaId, duration: 10 }] : []);
  const first = ['full', 'left', 'top'].includes(placement);
  return { locationId: screen.locationId, screenId: screen.id, expectedVersion: screen.version,
    orientation: screen.orientation, scaleType: 'fit', transition: screen.transition ?? 'fade',
    layout: placement === 'full' ? 'single' : ['left', 'right'].includes(placement) ? 'columns' : 'rows',
    playlist: first ? pages : primary,
    secondaryPlaylist: placement === 'full' ? [] : first ? ((screen.layout ?? 'single') === 'single' ? primary : screen.secondaryPlaylist ?? []) : pages,
    logo: screen.logo ?? null };
}

export function menuDimensions(screen, placement) {
  let [width, height] = screen.orientation.startsWith('portrait') ? [1080, 1920] : [1920, 1080];
  if (['left', 'right'].includes(placement)) width /= 2;
  if (['top', 'bottom'].includes(placement)) height /= 2;
  return { width, height };
}

// Render only text from the saved menu. No HTML, remote fonts or external images.
export async function renderMenuPages(menu, title, dimensions) {
  if (!menu.items.length) throw Error('Add at least one saved menu item before publishing.');
  const { width, height } = dimensions;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const fontSize = Math.max(24, Math.round(width / 35)), margin = 40, line = fontSize * 1.3;
  const wrap = (text, maxWidth) => {
    const lines = []; let current = '';
    for (const char of text) {
      if (current && ctx.measureText(current + char).width > maxWidth) { lines.push(current.trim()); current = ''; }
      current += char;
    }
    if (current) lines.push(current.trim()); return lines;
  };
  ctx.font = `600 ${fontSize}px sans-serif`;
  const priceWidth = ctx.measureText('$9999.99').width + 24;
  const rows = menu.categories.flatMap(category => menu.items.filter(i => i.categoryId === category.id).map(item => {
    const names = wrap(item.name, width - margin * 2 - priceWidth);
    const categories = wrap(category.name, width - margin * 2);
    return { item, names, categories, height: (names.length + categories.length + (item.available ? 0 : 1)) * line + 32 };
  }));
  const pages = []; let current = [], used = 0;
  const capacity = height - 190;
  for (const row of rows) {
    if (row.height > capacity) throw Error('A menu name is too long for this region. Shorten it or choose a larger region.');
    if (used + row.height > capacity) { pages.push(current); current = []; used = 0; }
    current.push(row); used += row.height;
  }
  if (current.length) pages.push(current);
  if (pages.length > 20) throw Error('This region needs more than 20 pages. Shorten the menu or choose a larger region.');
  const blobs = [];
  for (let index = 0; index < pages.length; index++) {
    ctx.fillStyle = '#102e27'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff'; ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.fillText(title, margin, 60, width - margin * 2);
    let y = 125;
    for (const row of pages[index]) {
      ctx.fillStyle = '#b8d7b0'; ctx.font = `${fontSize}px sans-serif`;
      for (const text of row.categories) { ctx.fillText(text, margin, y); y += line; }
      ctx.fillStyle = '#fff'; ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.textAlign = 'right'; ctx.fillText(`$${(row.item.priceCents / 100).toFixed(2)}`, width - margin, y); ctx.textAlign = 'left';
      for (const text of row.names) { ctx.fillText(text, margin, y); y += line; }
      if (!row.item.available) { ctx.fillStyle = '#ffd39b'; ctx.fillText('Sold out', margin, y); y += line; }
      y += 32;
    }
    ctx.fillStyle = '#b8d7b0'; ctx.font = '22px sans-serif';
    ctx.fillText(`AUD · ${index + 1} / ${pages.length}`, margin, height - 25);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob || blob.size > 20 * 1024 * 1024) throw Error('Menu page could not be prepared within the image limit.');
    blobs.push(blob);
  }
  return blobs;
}

export async function publishMenuPages({ businessId, screen, placement, menu, pages, call, upload = uploadMedia, progress }) {
  const ids = [];
  for (let i = 0; i < pages.length; i++) {
    progress(`Preparing validated page ${i + 1} of ${pages.length}…`);
    const page = pages[i];
    page.requestId ??= crypto.randomUUID();
    if (!page.mediaId) {
      const result = await call('beginMediaUpload', { businessId, requestId: page.requestId,
        name: `Menu v${menu.version} · ${screen.name.slice(0, 50)} · ${i + 1}.png`, contentType: 'image/png', size: page.blob.size });
      page.mediaId = result.mediaId;
    }
    if (!page.ready) {
      if (!page.uploaded) {
        const grant = await call('authorizeMediaUpload', { businessId, mediaId: page.mediaId });
        await upload(page.blob, grant, () => {});
        page.uploaded = true;
      }
      const completed = await call('completeMediaUpload', { businessId, mediaId: page.mediaId });
      if (!['uploaded', 'ready'].includes(completed.status)) throw Error('A menu page failed upload checks. Review the media library.');
      const validated = await call('validateMedia', { businessId, mediaId: page.mediaId });
      if (validated.status !== 'ready') throw Error('A menu page failed validation. Review the media library.');
      page.ready = true;
    }
    ids.push(page.mediaId);
  }
  progress('Saving screen assignment…');
  return call('updateScreenSettings', { businessId, ...menuScreenPlan(screen, placement, ids) });
}
