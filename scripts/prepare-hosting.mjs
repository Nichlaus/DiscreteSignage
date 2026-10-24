import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkHostingBuild } from './check-hosting-build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  cwd: root, stdio: 'inherit',
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
console.log(`PASS: ${checkHostingBuild(fileURLToPath(new URL('../dist/', import.meta.url)))} Hosting files checked before upload.`);
