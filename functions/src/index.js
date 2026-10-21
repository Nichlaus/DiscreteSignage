import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { createProvisioning } from './provisioning.js';
import { createTeam } from './team.js';
import { createPairing } from './pairing.js';
import { createScreens } from './screens.js';
import { createMedia, stripDownloadToken } from './media.js';
import { createPlayback } from './playback.js';
import { createReporting } from './reporting.js';
import { getStorage } from 'firebase-admin/storage';
import { onObjectFinalized } from 'firebase-functions/v2/storage';

initializeApp();
const service = createProvisioning({ firestore: getFirestore(), auth: getAuth() });
const team = createTeam({ firestore: getFirestore(), auth: getAuth() });
const pairing = createPairing({ firestore: getFirestore(), auth: getAuth() });
const screens = createScreens({ firestore: getFirestore(), auth: getAuth() });
const reporting = createReporting({ firestore: getFirestore(), auth: getAuth() });
const media = createMedia({ firestore: getFirestore(), auth: getAuth(),
  bucket: () => getStorage().bucket('discretesignage.firebasestorage.app') });
const playback = createPlayback({ firestore: getFirestore(), auth: getAuth(),
  bucket: () => getStorage().bucket('discretesignage.firebasestorage.app') });
const options = {
  region: 'australia-southeast1',
  serviceAccount: 'discrete-platform@discretesignage.iam.gserviceaccount.com',
  enforceAppCheck: true,
  maxInstances: 5,
  concurrency: 20,
  timeoutSeconds: 30,
  memory: '256MiB',
};
export const provisionBusiness = onCall(options, service.provisionBusiness);
export const createLocation = onCall(options, service.createLocation);
export const createInvitation = onCall(options, team.createInvitation);
export const acceptInvitation = onCall(options, team.acceptInvitation);
export const revokeInvitation = onCall(options, team.revokeInvitation);
export const getWorkspace = onCall(options, team.getWorkspace);
export const beginPairing = onCall(options, pairing.beginPairing);
export const claimScreen = onCall(options, pairing.claimScreen);
export const completePairing = onCall(options, pairing.completePairing);
export const revokeScreen = onCall(options, pairing.revokeScreen);
export const updateScreenSettings = onCall(options, screens.updateScreenSettings);
export const beginMediaUpload = onCall(options, media.beginMediaUpload);
export const authorizeMediaUpload = onCall(options, media.authorizeMediaUpload);
export const completeMediaUpload = onCall(options, media.completeMediaUpload);
export const listMedia = onCall(options, media.listMedia);
export const cleanupMedia = onCall(options, media.cleanupMedia);
export const validateMedia = onCall({ ...options, memory: '1GiB', concurrency: 1,
  timeoutSeconds: 180, maxInstances: 2 }, playback.validateMedia);
export const getScreenPlayback = onCall(options, playback.getScreenPlayback);
export const reportPlayback = onCall(options, reporting.reportPlayback);
export const getMediaReport = onCall(options, reporting.getMediaReport);
export const quarantineMedia = onObjectFinalized({
  region: options.region, serviceAccount: options.serviceAccount,
  bucket: 'discretesignage.firebasestorage.app', maxInstances: 3, retry: true,
}, async event => {
  const object = event.data;
  if (!/^businesses\/[a-zA-Z0-9_-]+\/media\/[a-f0-9]{64}\/original$/.test(object.name)) return;
  try {
    await stripDownloadToken(getStorage().bucket(object.bucket).file(object.name, { generation: object.generation }));
  } catch (error) {
    if (Number(error.code) !== 404) throw error;
  }
});
