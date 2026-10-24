import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { gzipSync } from 'node:zlib';
import { api, project } from './firebase-project.mjs';
import { checkHostingBuild } from './check-hosting-build.mjs';

// Read-only cloud operations. Builds go in an ignored directory, never the live dist.
const [commit, version] = process.argv.slice(2);
assert.match(commit ?? '', /^[a-f0-9]{7,40}$/);
assert.match(version ?? '', /^[a-f0-9]{16}$/);
const root = fileURLToPath(new URL('../', import.meta.url));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
const sha = run('git', ['rev-parse', '--verify', `${commit}^{commit}`]);
const base = `https://firebasehosting.googleapis.com/v1beta1/sites/${project}`;
const before = (await api(`${base}/releases?pageSize=1`)).releases[0].name;
const metadata = await api(`${base}/versions/${version}`);
assert.equal(metadata.status, 'FINALIZED', 'Candidate must still be retained and finalized');
const remote = {};
let token = '';
do {
  const page = await api(`${base}/versions/${version}/files?pageSize=1000${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`);
  for (const file of page.files ?? []) {
    if (!['/__/firebase/init.js', '/__/firebase/init.json'].includes(file.path)) remote[file.path] = file.hash;
  }
  token = page.nextPageToken ?? '';
} while (token);
mkdirSync(join(root, 'artifacts'), { recursive: true });
const work = mkdtempSync(join(root, 'artifacts', 'rollback-'));
const source = join(work, 'source');
mkdirSync(source);
run('git', ['archive', '--format=tar', `--output=${join(work, 'source.tar')}`, sha]);
run('tar', ['-xf', join(work, 'source.tar'), '-C', source]);
// Historical deployed working files used LF, while Git archives contain CRLF.
// Normalize only web build inputs in this isolated copy, including inlined SVGs.
function normalize(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) normalize(path);
    else if (/\.(html|js|css|svg)$/.test(entry.name)) {
      writeFileSync(path, readFileSync(path, 'utf8').replace(/\r\n/g, '\n'));
    }
  }
}
normalize(join(source, 'web'));
for (const page of ['index.html', 'display.html', 'admin.html', 'client.html']) {
  const path = join(source, page);
  writeFileSync(path, readFileSync(path, 'utf8').replace(/\r\n/g, '\n'));
}
await build({ root: source, envDir: root });
const dist = join(source, 'dist');
checkHostingBuild(dist);
const local = {};
function collect(relative = '') {
  for (const entry of readdirSync(join(dist, relative), { withFileTypes: true })) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) collect(path);
    else local[`/${path}`] = createHash('sha256').update(gzipSync(readFileSync(join(dist, path)), { level: 9 })).digest('hex');
  }
}
collect();
assert.deepEqual(local, remote, 'Rebuilt files differ from retained Hosting version');
const after = (await api(`${base}/releases?pageSize=1`)).releases[0].name;
assert.equal(after, before, 'Live release changed during rehearsal; investigate before continuing');
const evidence = { commit: sha, version: metadata.name, checkedAt: new Date().toISOString(),
  filesMatched: Object.keys(local).length, liveReleaseBefore: before, liveReleaseAfter: after,
  scope: 'Local rebuild and retained-version hash comparison; no live rollback performed' };
writeFileSync(join(work, 'evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
console.log(`Evidence: ${join(work, 'evidence.json')}`);
