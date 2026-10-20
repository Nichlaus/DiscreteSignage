import { HttpsError } from 'firebase-functions/v2/https';
const fail = (code, message) => { throw new HttpsError(code, message); };
export async function authorize(auth, request) {
    if (!request.auth?.uid) fail('unauthenticated', 'Sign in first.');
    if (!request.app) fail('failed-precondition', 'App verification is required.');
    if (request.auth.token?.device === true
      || request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
      fail('permission-denied', 'A verified staff account is required.');
    }
    const user = await auth.getUser(request.auth.uid).catch(error => {
      if (error.code === 'auth/user-not-found') fail('unauthenticated', 'Account unavailable.');
      throw error;
    });
    if (user.disabled || !user.emailVerified || !user.email) {
      fail('permission-denied', 'An active account with verified email is required.');
    }
    const authenticatedAt = request.auth.token?.auth_time;
    if (!Number.isFinite(authenticatedAt) || authenticatedAt <= 0
      || authenticatedAt * 1000 < Date.parse(user.tokensValidAfterTime || '1970-01-01')) {
      fail('unauthenticated', 'Sign in again.');
    }
    return user;
  }
