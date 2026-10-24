import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const env = { ...process.env };
env.PATH = `${dirname(process.execPath)}${delimiter}${env.PATH ?? ''}`;
for (const home of [env.JAVA_HOME, 'C:\\Program Files\\Android\\Android Studio\\jbr'].filter(Boolean)) {
  const java = join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  if (!existsSync(java)) continue;
  const result = spawnSync(java, ['-version'], { encoding: 'utf8' });
  if (!(Number(`${result.stderr}${result.stdout}`.match(/version "(\d+)/)?.[1]) >= 21)) continue;
  env.JAVA_HOME = home; env.PATH = `${join(home, 'bin')}${delimiter}${env.PATH}`; break;
}
const config = JSON.parse(readFileSync('firebase.test.json', 'utf8'));
if (config.emulators.functions || config.emulators.hosting) throw Error('Recovery rehearsal must not run application services.');
for (const service of ['auth', 'firestore', 'storage']) {
  if (config.emulators[service]?.host !== '127.0.0.1') throw Error('Loopback emulators required.');
}
mkdirSync('artifacts', { recursive: true });
const directory = mkdtempSync(resolve('artifacts/recovery-'));
const backup = join(directory, 'export');
for (const phase of ['seed', 'verify']) {
  const result = spawnSync(process.execPath, ['node_modules/firebase-tools/lib/bin/firebase.js',
    'emulators:exec', '--project', 'demo-discretesignage', '--config', 'firebase.test.json',
    '--only', 'auth,firestore,storage',
    phase === 'seed' ? `--export-on-exit=${backup}` : `--import=${backup}`,
    `node functions/test/recovery-fixture.mjs ${phase}`,
  ], { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (!existsSync(join(backup, 'firebase-export-metadata.json'))) throw Error('Emulator export is missing.');
}
console.log(`PASS: fresh-emulator restore verified. Synthetic export retained at ${backup}`);
