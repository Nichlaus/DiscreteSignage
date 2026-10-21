import { HttpsError } from 'firebase-functions/v2/https';
import { identifier } from './provisioning.js';
import { schedule } from './schedule.js';

export function playlist(value) {
  if (!Array.isArray(value) || value.length > 20) {
    throw new HttpsError('invalid-argument', 'Choose up to 20 playlist items.');
  }
  return value.map(item => {
    if (!item || !['duration,mediaId', 'duration,mediaId,schedule'].includes(Object.keys(item).sort().join(','))
      || !Number.isInteger(item.duration) || item.duration < 3 || item.duration > 300) {
      throw new HttpsError('invalid-argument', 'Image durations must be whole seconds from 3 to 300.');
    }
    return { mediaId: identifier(item.mediaId), duration: item.duration,
      ...(Object.hasOwn(item, 'schedule') ? { schedule: schedule(item.schedule) } : {}) };
  });
}

export function screenPlaylist(screen) {
  return playlist(screen.playlist ?? (screen.mediaId ? [{ mediaId: screen.mediaId, duration: 10 }] : []));
}

export function transition(value = 'fade') {
  if (!['none', 'fade', 'slide', 'zoom'].includes(value)) {
    throw new HttpsError('invalid-argument', 'Choose a supported transition.');
  }
  return value;
}
