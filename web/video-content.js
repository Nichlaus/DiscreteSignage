// Fetch the bounded clip once; future range requests must not reuse an expired URL.
export async function loadVideo(asset) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let url, video;
  try {
    if (!(asset.size > 0 && asset.size <= 20 * 1024 * 1024)) throw Error('Unsupported clip size');
    const response = await fetch(asset.url, { signal: controller.signal, cache: 'no-store', credentials: 'omit',
      referrerPolicy: 'no-referrer' });
    if (!response.ok) throw Error('Video download failed');
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > asset.size) { controller.abort(); throw Error('Unexpected clip size'); }
      chunks.push(chunk);
    }
    if (size !== asset.size) throw Error('Incomplete clip');
    url = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
    video = document.createElement('video');
    video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true;
    video.setAttribute('aria-label', 'Assigned business display video');
    const loaded = new Promise((resolve, reject) => {
      video.onloadeddata = resolve; video.onerror = () => reject(Error('Video decoding failed'));
      controller.signal.addEventListener('abort', () => reject(Error('Video load timed out')), { once: true });
    });
    video.src = url; video.load(); await loaded;
    video.onloadeddata = null; video.onerror = null;
    let disposed = false;
    video.dispose = () => {
      if (disposed) return;
      disposed = true; video.onerror = null;
      video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
    };
    return video;
  } catch (error) {
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    if (url) URL.revokeObjectURL(url);
    throw error;
  } finally { clearTimeout(timer); }
}
