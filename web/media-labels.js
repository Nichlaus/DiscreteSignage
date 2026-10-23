// Stable references let owners distinguish repeated filenames across selectors.
export function labelMedia(items) {
  return items.map(item => {
    let length = 8;
    while (length < item.id.length && items.some(other => other.id !== item.id
      && other.id.slice(-length) === item.id.slice(-length))) length += 4;
    const reference = item.id.slice(-length);
    const source = item.id.startsWith('submission_') ? 'Client advert' : 'Library upload';
    return { ...item, reference, source, label: `${item.name} · ${source} · ${reference}` };
  });
}
