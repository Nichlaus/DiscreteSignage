// Read-only acceptance check for the explicitly named synthetic Test Cafe fixture.
import assert from 'node:assert/strict';
import { api, project } from './firebase-project.mjs';

const root = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const video = process.argv[2] === 'video';
if (process.argv[2] && !video) throw Error('Use no argument for the image fixture, or video.');
const businesses = await api(`${root}/businesses?pageSize=100&mask.fieldPaths=name`);
const matches = (businesses.documents ?? []).filter(d => d.fields?.name?.stringValue === 'Test Cafe');
assert.equal(matches.length, 1, 'Expected one Test Cafe acceptance business');
const result = await api(`https://firestore.googleapis.com/v1/${matches[0].name}/media?pageSize=100`);
const fixtures = (result.documents ?? []).filter(d => d.fields?.name?.stringValue === (video ? 'video-fixture.mp4' : 'playback-fixture.webp'));
assert.equal(fixtures.length, 1, 'Expected one approved playback fixture');
const value = fixtures[0].fields;
assert.equal(value.status.stringValue, 'ready');
const playback = value.playback.mapValue.fields;
assert.equal(playback.policy.stringValue, video ? 'video-v1' : 'image-v1');
assert.equal(Number(playback.width.integerValue), video ? 960 : 1600);
assert.equal(Number(playback.height.integerValue), video ? 540 : 900);
if (video) {
  assert.equal(Number(playback.duration.integerValue ?? playback.duration.doubleValue), 3);
  assert.equal(playback.contentType.stringValue, 'video/mp4');
}
const bucket = `${project}.firebasestorage.app`;
for (const path of [value.path.stringValue, playback.path.stringValue]) {
  for (const url of [
    `https://storage.googleapis.com/${bucket}/${path}`,
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`,
  ]) {
    const response = await fetch(url);
    await response.arrayBuffer();
    assert.ok([401, 403].includes(response.status), 'Anonymous download was not denied');
  }
}
console.log('PASS: fixture validated at full resolution; original and derivative deny anonymous GCS/Firebase reads.');
