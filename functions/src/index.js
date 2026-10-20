import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { createProvisioning } from './provisioning.js';

initializeApp();
const service = createProvisioning({ firestore: getFirestore(), auth: getAuth() });
const options = {
  region: 'australia-southeast1',
  enforceAppCheck: true,
  maxInstances: 5,
  concurrency: 20,
  timeoutSeconds: 30,
  memory: '256MiB',
};
export const provisionBusiness = onCall(options, service.provisionBusiness);
export const createLocation = onCall(options, service.createLocation);
