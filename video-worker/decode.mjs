import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);
export const MAX_BYTES = 20 * 1024 * 1024;
export class InvalidVideo extends Error {}
const invalid = () => new InvalidVideo('Use a static-resolution SDR video up to 20 MiB, 60 seconds, 1080p and 30 fps.');
const formats = { 'video/mp4': 'mov', 'video/webm': 'matroska' };
function inspect(info) {
  const streams = info.streams ?? [];
  const video = streams.filter(s => s.codec_type === 'video');
  const duration = Number(info.format?.duration);
  if (video.length !== 1 || streams.some(s => !['video', 'audio'].includes(s.codec_type))) throw invalid();
  const v = video[0], [n, d] = (v.avg_frame_rate ?? '').split('/').map(Number), fps = n / d;
  if (!['h264', 'vp8', 'vp9'].includes(v.codec_name) || !['yuv420p', 'yuvj420p'].includes(v.pix_fmt)
    || !Number.isFinite(duration) || duration <= 0 || duration > 60
    || !Number.isFinite(fps) || fps <= 0 || fps > 30.01
    || !Number.isInteger(v.width) || !Number.isInteger(v.height) || v.width < 2 || v.height < 2
    || Math.max(v.width, v.height) > 1920 || Math.min(v.width, v.height) > 1080
    || v.width % 2 || v.height % 2
    || ![undefined, 'N/A', '0:1', '1:1'].includes(v.sample_aspect_ratio)
    || ['smpte2084', 'arib-std-b67'].includes(v.color_transfer)) throw invalid();
  return { width: v.width, height: v.height, duration };
}

export async function decodeVideo(bytes, type, { ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' } = {}) {
  if (!formats[type] || bytes.length < 12 || bytes.length > MAX_BYTES) throw invalid();
  const directory = await mkdtemp(join(tmpdir(), 'discrete-video-'));
  const input = join(directory, 'input'), output = join(directory, 'output.mp4');
  const signal = AbortSignal.timeout(100000);
  // No shell, URLs, playlists or caller-supplied arguments. Only local container formats.
  const run = async (binary, args) => {
    const result = await exec(binary, args, { signal, timeout: 100000,
      killSignal: 'SIGKILL', maxBuffer: 1024 * 1024, windowsHide: true });
    if (result.stderr.trim()) throw invalid();
    return result;
  };
  const probe = async (path, format) => JSON.parse((await run(ffprobe, [
    '-v', 'error', '-max_alloc', '67108864', '-protocol_whitelist', 'file',
    '-format_whitelist', format, '-f', format, '-show_streams', '-show_format', '-of', 'json', path,
  ])).stdout);
  try {
    await writeFile(input, bytes, { flag: 'wx' });
    const original = inspect(await probe(input, formats[type]));
    const decoded = JSON.parse((await run(ffprobe, ['-v', 'error', '-max_alloc', '67108864',
      '-protocol_whitelist', 'file', '-format_whitelist', formats[type], '-f', formats[type],
      '-threads', '2', '-err_detect', 'explode', '-select_streams', 'v:0',
      '-show_frames', '-show_entries', 'frame=width,height,pix_fmt,best_effort_timestamp_time',
      '-of', 'json', input])).stdout).frames;
    if (!decoded?.length || decoded.length > 1801 || decoded.some(frame =>
      frame.width !== original.width || frame.height !== original.height
      || !['yuv420p', 'yuvj420p'].includes(frame.pix_fmt)
      || !(Number(frame.best_effort_timestamp_time) >= 0 && Number(frame.best_effort_timestamp_time) <= 60))) {
      throw invalid();
    }
    // Decode every frame; fail on errors. Re-encode only the video track, stripping
    // audio, attachments, chapters and metadata. Never publish the uploaded container.
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-xerror',
      '-max_alloc', '67108864', '-protocol_whitelist', 'file', '-format_whitelist', formats[type],
      '-err_detect', 'explode', '-threads', '2', '-f', formats[type], '-i', input,
      '-map', '0:v:0', '-an', '-sn', '-dn', '-map_metadata', '-1', '-map_chapters', '-1',
      '-vf', 'setsar=1', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-threads', '2', '-fs', String(MAX_BYTES + 1),
      '-movflags', '+faststart', '-f', 'mp4', output]);
    if ((await stat(output)).size > MAX_BYTES) throw invalid();
    const result = inspect(await probe(output, 'mov'));
    if (Math.abs(result.duration - original.duration) > 0.15) throw invalid();
    return { ...result, bytes: await readFile(output) };
  } catch (error) {
    if (error.code === 'ENOENT') throw error; // Missing deployment dependency is retryable.
    if (error instanceof InvalidVideo) throw error;
    throw new InvalidVideo('Video could not be fully decoded within the supported limits.');
  } finally {
    if (dirname(resolve(directory)) !== resolve(tmpdir())) throw Error('Unexpected temporary directory');
    await rm(directory, { recursive: true, force: true });
  }
}
