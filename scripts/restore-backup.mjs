import { api, project } from './firebase-project.mjs';
import { validateRestore } from './restore-policy.mjs';

const [backupName, destination, mode] = process.argv.slice(2);
if (!/^projects\/discretesignage\/locations\/australia-southeast1\/backups\/[a-zA-Z0-9-]+$/.test(backupName ?? '')) {
  throw Error('Supply an observed Sydney backup resource name, a recovery-check-* destination, and optional --apply.');
}
if (mode && mode !== '--apply') throw Error('Unknown mode');
const base = `https://firestore.googleapis.com/v1/projects/${project}`;
const [backup, source] = await Promise.all([
  api(`https://firestore.googleapis.com/v1/${backupName}`), api(`${base}/databases/(default)`),
]);
const body = validateRestore(backup, source, destination);
async function requireMissing(url) {
  try { await api(url); } catch (error) { if (error.message.startsWith('404:')) return; throw error; }
  throw Error('Destination database or rules release already exists; refuse to reuse it.');
}
await requireMissing(`${base}/databases/${destination}`);
await requireMissing(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore/${destination}`);
console.log(JSON.stringify({ source: source.name, snapshotTime: backup.snapshotTime,
  destination, backup: backup.name, mode: mode ?? 'read-only preflight' }, null, 2));
if (mode === '--apply') {
  const operation = await api(`${base}/databases:restore`, { method: 'POST', body });
  console.log(JSON.stringify({ operation: operation.name, done: operation.done ?? false }));
  console.log('Restore requested, not verified. Check operation completion, deny-all client rules and restored contents before claiming success.');
} else console.log('No changes made. Apply only to a reviewed, unused destination; never connect application traffic.');
