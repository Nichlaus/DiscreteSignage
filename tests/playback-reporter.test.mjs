import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlaybackReporter } from '../web/playback-reporter.js';

test('reporter retries the same identifiers, drops old events and never blocks playback', async () => {
  let time = 1000, sequence = 0, fail = true;
  const calls = [];
  const reporter = createPlaybackReporter(async data => { calls.push(data); if (fail) throw Error('offline'); },
    { now: () => time, uuid: () => String(++sequence), every: () => 1, cancel: () => {} });
  const start = { mediaId: 'image', version: 1, region: 0 };
  reporter.started(start); await reporter.flush();
  fail = false; await reporter.flush();
  assert.deepEqual(calls[0], calls[1]);
  await reporter.flush(); assert.equal(calls.length, 2);
  reporter.started(start); time += 120000; await reporter.flush(); assert.equal(calls.length, 2);
  reporter.started(start); reporter.stop(); await reporter.flush(); assert.equal(calls.length, 2);
});

test('reporter bounds each batch and keeps events queued during a request', async () => {
  let release, sent;
  const reporter = createPlaybackReporter(data => { sent = data; return new Promise(resolve => { release = resolve; }); },
    { now: () => 1000, uuid: (() => { let id = 0; return () => String(++id); })(), every: () => 1, cancel: () => {} });
  for (let i = 0; i < 25; i++) reporter.started({ mediaId: 'image', version: 1, region: 0 });
  const first = reporter.flush(); assert.equal(sent.events.length, 20);
  reporter.started({ mediaId: 'other', version: 1, region: 1 }); release(); await first;
  const second = reporter.flush(); assert.equal(sent.events.length, 6); release(); await second; reporter.stop();
});
