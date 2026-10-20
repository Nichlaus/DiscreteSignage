# Private video validation worker

Implemented and tested locally; not deployed. No third-party Node dependencies.
The container uses Debian trixie's maintained FFmpeg package and runs as a
non-root user. Rebuild to receive distribution security updates; record the
container digest and `ffmpeg -version` with every release.

The HTTP service relies on Cloud Run IAM. It must never have public invocation
enabled. Give its dedicated runtime identity no Firestore, Storage, Auth or
project roles. Only the existing `discrete-platform` function runtime should
receive service-scoped `roles/run.invoker` on this worker. The worker receives
bounded file bytes, not bucket credentials, user tokens or arbitrary URLs.

Production deployment requirements:

- Service `discrete-video`, project `discretesignage`, region `australia-southeast1`.
- Build this directory's Dockerfile; run its real decoder tests on the Linux
  image before release. Local Windows tests do not verify the container build.
- Dedicated unprivileged service account, 2 GiB memory, 2 CPUs, concurrency one,
  maximum two instances, zero minimum instances, 150-second request timeout.
- Keep Cloud Run IAM authentication enabled and anonymous requests denied.
  Grant invocation only on this service, never project-wide.
- Set `VIDEO_WORKER_URL` in the functions deployment environment to the service's
  regional `https://…australia-southeast1.run.app` URL (no trailing slash).
  The function obtains a Google ID token for that exact audience.
- Update bucket CORS to PUT and GET on the existing two Hosting origins. This
  permits browser fetches with signed URLs; it does not grant public object access.
- Deploy the updated validation/settings/library/playback functions before Hosting.
  Validation now uses a 180-second function timeout and a 210-second processing
  lease. Keep the existing memory/concurrency/instance limits.
- Verify worker identity, resource limits, private invocation, real cloud decoding,
  signed video delivery, revocation and original/derivative anonymous-read denial.
  No new client Firebase rule grants are required.

`POST /validate` accepts MP4/WebM bytes (12 bytes–20 MiB). Supported video codecs:
H.264, VP8, VP9; one video stream; 8-bit SDR, square pixels, even dimensions,
at most 1920×1080 or 1080×1920, 30 fps average and 60 seconds. Unsupported
subtitle/data/attachment tracks are rejected. Audio is discarded without decoding;
this version intentionally produces silent clips.

Every video frame is decoded and checked for fixed dimensions/pixel format and
bounded timestamps/count. A second decode produces H.264/yuv420p MP4, CRF 18,
fast-start, without resizing; orientation is applied by FFmpeg. Metadata, chapters,
audio and auxiliary tracks are removed. This is a high-quality lossy copy;
the original is preserved. Output is capped at 20 MiB and its duration must agree
with the input within 150 ms. All subprocesses share a 100-second wall-clock
budget and bounded output. Resource exhaustion fails validation, never publishes
the source container. Network protocols and playlist demuxers are disallowed.

The server rejects concurrent work defensively. Cloud Run memory/CPU limits remain
essential: `max_alloc` limits a single allocation, not total process memory.
Original and derived bytes pass through memory and private temporary files;
temporary directories are removed in `finally` and instance teardown handles
hard termination. Do not log request bodies, ID tokens or playback URLs.

Run `npm run test:video` from the repository with `ffmpeg` and `ffprobe` on PATH,
or provide `FFMPEG_PATH` and `FFPROBE_PATH`. Tests create synthetic clips only.
The ordinary emulator suite also covers the HTTP contract and authenticated
function transport with controlled mocks.

References: [Debian FFmpeg](https://packages.debian.org/trixie/ffmpeg),
[FFmpeg options](https://ffmpeg.org/ffmpeg.html),
[protocol restrictions](https://ffmpeg.org/ffmpeg-protocols.html),
[Cloud Run limits](https://docs.cloud.google.com/run/quotas).
