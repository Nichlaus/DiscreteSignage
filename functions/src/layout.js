import { HttpsError } from 'firebase-functions/v2/https';
import { identifier } from './provisioning.js';
import { playlist } from './playlist.js';

export function screenLayout(value) {
  const layout = value.layout === undefined ? 'single' : value.layout;
  if (!['single', 'columns', 'rows'].includes(layout)) {
    throw new HttpsError('invalid-argument', 'Choose a supported screen layout.');
  }
  const secondaryPlaylist = playlist(value.secondaryPlaylist === undefined ? [] : value.secondaryPlaylist);
  let logo = value.logo ?? null;
  if (logo !== null) {
    if (typeof logo !== 'object' || Object.keys(logo).sort().join(',') !== 'mediaId,position,size'
      || !['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(logo.position)
      || !['small', 'medium'].includes(logo.size)) {
      throw new HttpsError('invalid-argument', 'Choose a logo, position and size.');
    }
    logo = { mediaId: identifier(logo.mediaId), position: logo.position, size: logo.size };
  }
  return { layout, secondaryPlaylist, logo };
}
