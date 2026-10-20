import { existsSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Use a dedicated demo project and config. Never test against live services.
const env = { ...process.env };
env.PATH = `${dirname(process.execPath)}${delimiter}${env.PATH ?? ''}`;
const javaCandidates = [
  env.JAVA_HOME,
  process.platform === 'win32' ? 'C:\\Program Files\\Android\\Android Studio\\jbr' : undefined,
].filter(Boolean);
for (const home of javaCandidates) {
  const java = join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  if (!existsSync(java)) continue;
  const check = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const major = Number(`${check.stderr}${check.stdout}`.match(/version "(\d+)/)?.[1]);
  if (major >= 21) {
    env.JAVA_HOME = home;
    env.PATH = `${join(home, 'bin')}${delimiter}${env.PATH ?? ''}`;
    break;
  }
}
const config = JSON.parse(readFileSync('firebase.test.json', 'utf8'));
if (Object.keys(config.emulators).some(key => key === 'hosting' || key === 'functions')) {
  throw new Error('Rules test configuration must only start rules emulators.');
}
const result = spawnSync(process.execPath, [
  'node_modules/firebase-tools/lib/bin/firebase.js',
  'emulators:exec',
  '--project', 'demo-discretesignage',
  '--config', 'firebase.test.json',
  '--only', 'auth,firestore,database,storage',
  'node --test --test-concurrency=1 tests/rules.test.mjs tests/lease-player.test.mjs functions/test/image-validation.test.mjs functions/test/video-validation.test.mjs video-worker/server.test.mjs functions/test/provisioning.test.mjs functions/test/pairing.test.mjs functions/test/playback.test.mjs',
], { env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
