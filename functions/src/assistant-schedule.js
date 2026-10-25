import { HttpsError } from 'firebase-functions/v2/https';
import { fields } from './provisioning.js';
import { schedule } from './schedule.js';

export function guidedTiming(value) {
  fields(value, ['duration', 'schedule']);
  if (!Number.isInteger(value.duration) || value.duration < 3 || value.duration > 300) {
    throw new HttpsError('invalid-argument', 'Choose an image duration from 3 to 300 seconds.');
  }
  return { duration: value.duration, ...(value.schedule === null ? {} : { schedule: schedule(value.schedule) }) };
}
