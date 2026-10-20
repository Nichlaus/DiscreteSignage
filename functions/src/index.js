import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { createProvisioning } from './provisioning.js';
import { createTeam } from './team.js';
import { createPairing } from './pairing.js';
import { createScreens } from './screens.js';
import { createMedia } from './media.js';
import { getStorage } from 'firebase-admin/storage';

initializeApp();
const service = createProvisioning({ firestore: getFirestore(), auth: getAuth() });
const team = createTeam({ firestore: getFirestore(), auth: getAuth() });
const pairing = createPairing({ firestore: getFirestore(), auth: getAuth() });
const screens = createScreens({ firestore: getFirestore(), auth: getAuth() });
const media = createMedia({ firestore: getFirestore(), auth: getAuth(),
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
export const completeMediaUpload = onCall(options, media.completeMediaUpload);
export const listMedia = onCall(options, media.listMedia);
