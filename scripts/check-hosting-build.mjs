import assert from 'node:assert/strict';
import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const pages = ['index.html', 'display.html', 'admin.html', 'client.html'];

export function checkHostingBuild(directory) {
  const files = new Set();
  function walk(relative = '') {
    for (const name of readdirSync(join(directory, relative))) {
      const path = relative ? `${relative}/${name}` : name;
      const stat = lstatSync(join(directory, path));
      assert.ok(!stat.isSymbolicLink(), `Hosting output contains a symbolic link: ${path}`);
      if (stat.isDirectory()) {
        assert.equal(path, 'assets', `Unexpected Hosting directory: ${path}`);
        walk(path);
      } else {
        assert.ok(stat.isFile() && stat.size > 0, `Empty or unsupported Hosting file: ${path}`);
        assert.ok(pages.includes(path) || /^assets\/[\w.-]+-[\w-]+\.(js|css)$/.test(path),
          `Unexpected Hosting file: ${path}`);
        files.add(path);
      }
    }
  }
  walk();
  for (const page of pages) {
    assert.ok(files.has(page), `Missing Hosting page: ${page}`);
    const html = readFileSync(join(directory, page), 'utf8');
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(match => match[1].slice(1));
    assert.ok(assets.some(asset => asset.endsWith('.js')), `Missing JavaScript entry: ${page}`);
    for (const asset of assets) assert.ok(files.has(asset), `Missing asset in ${page}: ${asset}`);
  }
  return files.size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`PASS: ${checkHostingBuild(resolve('dist'))} Hosting files; all four page entries resolve.`);
}
