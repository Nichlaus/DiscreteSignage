import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { decodeVideo, InvalidVideo, MAX_BYTES } from './decode.mjs';
const exec = promisify(execFile);
const tools = { ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg', ffprobe: process.env.FFPROBE_PATH || 'ffprobe' };

test('real MP4 and WebM decode into silent H264 MP4 without resizing or private metadata', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'video-test-'));
  try {
    for (const [extension, codec, type] of [['mp4', 'libx264', 'video/mp4'], ['webm', 'libvpx-vp9', 'video/webm']]) {
      const path = join(dir, `input.${extension}`);
      await exec(tools.ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24',
        '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '1', '-c:v', codec,
        '-c:a', extension === 'mp4' ? 'aac' : 'libopus', '-metadata', 'title=private test title', path]);
      const original = await readFile(path);
      const result = await decodeVideo(original, type, tools);
      assert.equal(result.width, 320); assert.equal(result.height, 180);
      assert.ok(result.duration >= 0.9 && result.duration <= 1.2);
      assert.equal(result.bytes.toString('ascii', 4, 8), 'ftyp');
      assert.ok(!result.bytes.includes(Buffer.from('private test title')));
      assert.ok(!result.bytes.includes(Buffer.from('soun')));
      assert.ok(result.bytes.includes(Buffer.from('avc1')));
      await assert.rejects(decodeVideo(original.subarray(0, Math.floor(original.length / 2)), type, tools), InvalidVideo);
    }
  } finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    await rm(dir, { recursive: true, force: true });
  }
});
test('real decoder rejects malformed, oversized, overlong and unsupported resolution video', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'video-test-'));
  try {
    await assert.rejects(decodeVideo(Buffer.from('<html>not video</html>'), 'video/mp4', tools), InvalidVideo);
    await assert.rejects(decodeVideo(Buffer.alloc(MAX_BYTES + 1), 'video/mp4', tools), InvalidVideo);
    for (const [name, size, duration] of [['long', '32x32', '61'], ['large', '2048x1080', '0.2']]) {
      const path = join(dir, `${name}.mp4`);
      await exec(tools.ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', `color=size=${size}:rate=1`,
        '-t', duration, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path]);
      await assert.rejects(decodeVideo(await readFile(path), 'video/mp4', tools), InvalidVideo);
    }
  } finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    await rm(dir, { recursive: true, force: true });
  }
});
