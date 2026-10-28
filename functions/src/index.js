import { createInteractiveDelivery } from './interactive-delivery.js';
import { createCustomerConversation, openAICustomerConversation } from './customer-conversation.js';
import { customerConversationUsage } from './customer-conversation-usage.js';
import { initializeApp } from 'firebase-admin/app';
import { defineSecret } from 'firebase-functions/params';
import { createAssistantDrafts } from './assistant-drafts.js';
import { openAIPlanner } from './assistant-provider.js';
import { assistantUsage } from './assistant-usage.js';
import { createImageGeneration, openAIImageGenerator } from './image-generation.js';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { createScreenHealth } from './screen-health.js';
import { publishMetrics } from './monitoring.js';
import { createProvisioning } from './provisioning.js';
import { createFeaturedProducts } from './featured-products.js';
import { createMenus } from './menus.js';
import { createFoodOrders } from './food-orders.js';
import { createBranding } from './branding.js';
import { createTeam } from './team.js';
import { createPairing } from './pairing.js';
import { createScreens } from './screens.js';
import { createMedia, stripDownloadToken } from './media.js';
import { createPlayback } from './playback.js';
import { createReporting } from './reporting.js';
import { createPlatformAdmin } from './platform-admin.js';
import { createAdvertisers } from './advertisers.js';
import { createSubmissions } from './submissions.js';
import { createSubmissionReview } from './submission-review.js';
import { createSubmissionCleanup } from './submission-cleanup.js';
import { getStorage } from 'firebase-admin/storage';
import { onObjectFinalized } from 'firebase-functions/v2/storage';

initializeApp();
const service = createProvisioning({ firestore: getFirestore(), auth: getAuth() });
const featuredProducts = createFeaturedProducts({ firestore: getFirestore(), auth: getAuth() });
const menus = createMenus({ firestore: getFirestore(), auth: getAuth() });
const foodOrders = createFoodOrders({ firestore: getFirestore(), auth: getAuth() });
const branding = createBranding({ firestore: getFirestore(), auth: getAuth() });
const team = createTeam({ firestore: getFirestore(), auth: getAuth() });
const pairing = createPairing({ firestore: getFirestore(), auth: getAuth() });
const screens = createScreens({ firestore: getFirestore(), auth: getAuth() });
const reporting = createReporting({ firestore: getFirestore(), auth: getAuth() });
const platformAdmin = createPlatformAdmin({ firestore: getFirestore(), auth: getAuth() });
const advertisers = createAdvertisers({ firestore: getFirestore(), auth: getAuth() });
const submissions = createSubmissions({ firestore: getFirestore(), auth: getAuth(),
  bucket: () => getStorage().bucket('discretesignage.firebasestorage.app') });
const submissionReview = createSubmissionReview({ firestore: getFirestore(), auth: getAuth(),
  bucket: () => getStorage().bucket('discretesignage.firebasestorage.app') });
const submissionCleanup = createSubmissionCleanup({ firestore: getFirestore(), auth: getAuth(),
  bucket: () => getStorage().bucket('discretesignage.firebasestorage.app') });
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
const openAIKey = defineSecret('OPENAI_API_KEY');
export const preparePlaylistDraft = onCall({ ...options, timeoutSeconds: 60, maxInstances: 2,
  concurrency: 5, secrets: [openAIKey] }, request => createAssistantDrafts({
  firestore: getFirestore(), auth: getAuth(), reserve: assistantUsage(getFirestore()),
  planner: openAIPlanner({ apiKey: openAIKey.value() }),
}).preparePlaylistDraft(request));
export const generateAdvertImage = onCall({ ...options, timeoutSeconds: 210, memory: '1GiB', maxInstances: 2,
  concurrency: 1, secrets: [openAIKey] }, request => createImageGeneration({
  firestore: getFirestore(), auth: getAuth(), reserve: assistantUsage(getFirestore(), undefined, 'image'),
  generate: openAIImageGenerator({ apiKey: openAIKey.value() }),
  bucket: () => getStorage().bucket('discretesignage.firebasestorage.app'),
})(request));
export const updateBusinessMarket = onCall(options, service.updateBusinessMarket);
export const getBranding = onCall(options, branding.getBranding);
export const saveBranding = onCall(options, branding.saveBranding);
export const getScreenFeaturedProduct = onCall(options, createInteractiveDelivery({ firestore: getFirestore(), auth: getAuth() }));
export const askCustomerQuestion = onCall({ ...options, timeoutSeconds: 60, maxInstances: 2, concurrency: 5, secrets: [openAIKey] }, request =>
  createCustomerConversation({ deliver: createInteractiveDelivery({ firestore: getFirestore(), auth: getAuth() }),
    reserve: customerConversationUsage(getFirestore()), generate: openAICustomerConversation({ apiKey: openAIKey.value() }) })(request));
export const getFeaturedProduct = onCall(options, featuredProducts.getFeaturedProduct);
export const saveFeaturedProduct = onCall(options, featuredProducts.saveFeaturedProduct);
export const getFoodMenu = onCall(options, menus.getFoodMenu);
export const saveFoodMenu = onCall(options, menus.saveFoodMenu);
export const getPosMenu = onCall(options, foodOrders.getPosMenu);
export const createFoodOrder = onCall(options, foodOrders.createOrder);
export const setFoodOrderStatus = onCall(options, foodOrders.setOrderStatus);
export const monitorScreenHealth = onSchedule({
  region: options.region, serviceAccount: options.serviceAccount,
  schedule: 'every 5 minutes', timeZone: 'Australia/Sydney',
  maxInstances: 1, concurrency: 1, timeoutSeconds: 240, retryCount: 0,
  memory: '256MiB',
}, createScreenHealth({ firestore: getFirestore(), publish: publishMetrics }));
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
export const getPlatformBusiness = onCall(options, platformAdmin.getPlatformBusiness);
export const listPlatformBusinesses = onCall(options, platformAdmin.listPlatformBusinesses);
export const createAdvertiser = onCall(options, advertisers.createAdvertiser);
export const listAdvertisers = onCall(options, advertisers.listAdvertisers);
export const setAdvertiserActive = onCall(options, advertisers.setAdvertiserActive);
export const inviteAdvertiser = onCall(options, advertisers.inviteAdvertiser);
export const acceptAdvertiserInvitation = onCall(options, advertisers.acceptAdvertiserInvitation);
export const getAdvertiserWorkspace = onCall(options, advertisers.getAdvertiserWorkspace);
export const beginClientSubmission = onCall(options, submissions.beginClientSubmission);
export const authorizeClientSubmission = onCall(options, submissions.authorizeClientSubmission);
export const completeClientSubmission = onCall(options, submissions.completeClientSubmission);
export const listClientSubmissions = onCall(options, submissions.listClientSubmissions);
export const listAdvertiserSubmissions = onCall(options, submissions.listAdvertiserSubmissions);
export const validateSubmission = onCall({ ...options, memory: '1GiB', concurrency: 1,
  timeoutSeconds: 180, maxInstances: 2 }, submissionReview.validateSubmission);
export const previewSubmission = onCall(options, submissionReview.previewSubmission);
export const reviewSubmission = onCall(options, submissionReview.reviewSubmission);
export const cleanupSubmission = onCall(options, submissionCleanup.cleanupSubmission);
export const quarantineMedia = onObjectFinalized({
  region: options.region, serviceAccount: options.serviceAccount,
  bucket: 'discretesignage.firebasestorage.app', maxInstances: 3, retry: true,
}, async event => {
  const object = event.data;
  if (!/^businesses\/[a-zA-Z0-9_-]+\/(media|submissions)\/[a-f0-9]{64}\/original$/.test(object.name)) return;
  try {
    await stripDownloadToken(getStorage().bucket(object.bucket).file(object.name, { generation: object.generation }));
  } catch (error) {
    if (Number(error.code) !== 404) throw error;
  }
});

export const setInteractiveAccess = onCall(options, platformAdmin.setInteractiveAccess);
export const getConversationSettings = onCall(options, platformAdmin.getConversationSettings);
export const setConversationSettings = onCall(options, platformAdmin.setConversationSettings);
