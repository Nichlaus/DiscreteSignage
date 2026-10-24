import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkHostingBuild } from '../scripts/check-hosting-build.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'discrete-hosting-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets/app-abc123.js'), 'export {};');
  for (const page of ['index.html', 'admin.html', 'client.html', 'display.html']) {
    writeFileSync(join(dir, page), '<script type="module" src="/assets/app-abc123.js"></script>');
  }
  return dir;
}

test('complete four-page Hosting output passes', t => {
  assert.equal(checkHostingBuild(fixture(t)), 5);
});

test('a missing display page or entry asset blocks upload', t => {
  const dir = fixture(t);
  rmSync(join(dir, 'display.html'));
  assert.throws(() => checkHostingBuild(dir), /Missing Hosting page/);
  writeFileSync(join(dir, 'display.html'), '<script src="/assets/missing-abc123.js"></script>');
  assert.throws(() => checkHostingBuild(dir), /Missing asset/);
});

test('unexpected files, source maps and empty output block upload', t => {
  const dir = fixture(t);
  for (const file of ['.env.local', 'preview.html', 'assets/app-abc123.js.map']) {
    writeFileSync(join(dir, file), 'synthetic fixture');
    assert.throws(() => checkHostingBuild(dir), /Unexpected Hosting file/);
    rmSync(join(dir, file));
  }
  writeFileSync(join(dir, 'assets/app-abc123.js'), '');
  assert.throws(() => checkHostingBuild(dir), /Empty or unsupported/);
});
