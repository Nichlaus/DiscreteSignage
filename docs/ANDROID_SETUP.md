# Java display app setup

The user created this Java Views project on 2026-10-23 at the location below.
Its launcher label and Gradle project name are now Discrete Signage Display.
The package is `com.discretesignage.display`, with minimum API 26. Initial testing
uses an Android emulator. The native preview passed initial live acceptance;
physical-device acceptance remains pending. Keep the existing Reutos apps unchanged.

Validation: `:app:assembleDebug` passed on 2026-10-23 with the generated toolchain.
The debug APK is in `android-display/app/build/outputs/apk/debug/app-debug.apk`.

## Firebase client key restrictions — 2026-10-23

GitHub secret-scanning alert 1 identified the public Android SDK key in
`app/src/main/res/values/firebase.xml` (commit e002a963). Firebase client keys
ship in the APK and are not administrator credentials; data authorization still
requires Auth, Security Rules and App Check. See the
[Firebase key guidance](https://firebase.google.com/docs/projects/api-keys).

The auto-created key's broad Firebase allowlist was narrowed live to App Check,
Installations, Firestore, Identity Toolkit and Secure Token. In particular, AI/ML
and unrelated services are excluded. `node scripts/firebase-android-key.mjs`
audits the scope without printing key values; `--apply` reapplies this allowlist
while preserving application restrictions. Current Android package/certificate
restrictions are empty; signing-specific restrictions and release compatibility
remain a release gate. Use separate server-side credentials for future paid AI.

Read-back confirmed the five-service restriction. A credential-free Auth request
reached normal MISSING_EMAIL validation, while Gemini ListModels returned
API_KEY_SERVICE_BLOCKED. This is not a full Android pairing/playback retest.
The key was not rotated or removed from Git history: it remains public client
configuration. GitHub alert 1 was verified dismissed as "Won't fix" on
2026-10-23, with the restriction rationale recorded. It detected a real public
client identifier; it was not marked revoked. No abuse/billing-history audit was performed.

## Local settings and recovery checkpoint — 2026-10-23

Open Display settings on the connection screen, hold the touch screen during
playback, or press Menu on a remote. Choose Follow portal or a local orientation
and Fit/Fill/Stretch override. Connect first to enable Apply. Cancel leaves settings
unchanged; Retry connection starts fresh authorization. The dialog scrolls on
small displays. Local preferences contain only device/revision binding and display
choices, never media or signed URLs. They survive app restarts but clear when the
portal revision or paired device changes, or access is revoked. Local overrides
report appliedVersion 0 so the portal does not falsely claim its settings applied.
A dedicated local-override diagnostic label is still planned.

Playback now clears at onPause, invalidates in-flight callbacks and cancels timers.
onResume restores identity from the server and obtains a new playback lease.
Transient restoration/listener failures retain pairing and retry at 5/10/20/30
seconds, capped at 30 seconds. Permission denial still revokes local access.
A failed manifest refresh never extends the existing deadline; expiry clears all
regions and logos. There is no persistent offline media cache or offline grace.

Validation includes build/release compilation, policy tests, Android settings
persistence/scope tests and unpaired dialog/background-resume checks.

Live paired acceptance passed on API 36 (2026-10-23): local Landscape/Stretch,
Fill cropping, Follow portal restoring Fit, Home/background and launcher resume
preserving pairing and overrides, and a changed portal revision clearing overrides.
The portal showed Changes pending during local overrides and Applied afterward.
An identical portal save intentionally does not create a revision and therefore
does not clear overrides; change a setting or choose Follow portal locally.
With emulator Wi-Fi/data disabled, authorization expiry cleared the image by the
41-second observation (not a measurement of the exact expiry instant). Restoring
connectivity recovered playback automatically without Retry or re-pairing.
Resuming from Home while offline also kept media hidden, displayed automatic
retry, and recovered after the network returned. This exercised a single image;
video/split-region outage coverage followed below. Prolonged soak and physical TV tests remain.
Both transports were restored to their original enabled state. Test screen
Android recovery acceptance was revoked; native content cleared. Its temporary
App Check registration was deleted with absence verified, and the local debug
secret was removed. No code fix or backend deployment was required.
Evidence: artifacts/android-local-stretch-live.png, android-offline-expired-live.png,
android-network-recovered-live.png, android-offline-resume-live.png and
android-recovery-revoked-{live,portal}.png. The Windows UI helper could not reliably
operate the emulator; the user explicitly authorized ADB input restricted to
emulator-5554 for this test. Always set ANDROID_SERIAL=emulator-5554 for phone tests: the
first unscoped run also installed test packages on a connected Pixel Watch. That
run was stopped; both newly installed packages were removed and absence verified.

## Video and split-screen network acceptance — 2026-10-23

On Medium Phone API 36, existing synthetic video (0.71 MiB) was visibly moving
before emulator-5554 Wi-Fi and mobile data were disabled. Playback was cleared by
the 50-second observation at authorization expiry. After restoring both transports,
video returned automatically by the 29-second check, without Retry or re-pairing.

A rows layout with video above an image and a small top-right logo cleared every
layer by the 45-second check. This first split recovery attempt was inconclusive:
the cached App Check token expired after its old debug registration had been
removed. Renewal failed and permission denial signed the device out. The screen
was revoked and the approved temporary registration created before repeating.
Keep debug registration valid throughout future acceptance tests; a cached token
does not prove renewal will work.

The repeat split outage cleared all layers by the 48-second check. With both
transports restored, video, image and logo returned automatically at the next
check, approximately two minutes later, without user intervention. These are
observation bounds, not precise expiry/recovery latencies. The user reported poor
connectivity; throughput was not measured. This establishes recovery for small
fixtures, not large/4K video, dual-video decoding or sustained performance.

Both test screens were revoked and native playback cleared. Wi-Fi and data were
verified enabled again. The temporary App Check registration was deleted with
absence verified; the local debug secret was removed. No code fix or deployment
was required. Evidence in artifacts/: android-video-outage-{expired,recovered}.png,
android-split-retry-{expired,recovered}.png and
android-video-recovery-revoked-{live,portal}.png.

## Native pairing/playback checkpoint — 2026-10-23

Java uses Firebase Auth, Functions and Firestore directly, with Media3 for muted
video and bounded in-memory image decoding. Firebase Android app
`1:203068976562:android:79c2072797bd44697ac8ab` is registered for
`com.discretesignage.display`. Public SDK resources are generated by
`scripts/firebase-android-setup.mjs`; no service-account credentials are embedded.

Implemented: secure pairing and device restore; live screen settings; one or two
independent image/video playlists in equal columns or rows; fit/fill/stretch;
orientation; image logo overlays at six positions with 12%/18% bounds; fade
(default), cut, slide and zoom. Incoming media prepares while the previous item
remains visible. TextureView video supports alpha and transforms. Transitions
last 450 ms and respect disabled system animations. Local orientation/scale adjustments are available (see the recovery checkpoint below).
Play-start reporting identifies each region and excludes logos. Applied status
waits for all regions and the logo. Authorization loss clears every layer.

Composition checkpoint (2026-10-23): debug build, release Java compilation, unit
policy tests, lint and API 36 emulator composition lifecycle tests passed. Tests
cover region counts, logo identity/type, renewal without rebuilding and complete
view removal. Live acceptance followed on 2026-10-23 using Medium Phone API 36 and the
existing synthetic fixtures. Both columns and rows rendered independently; the
first region alternated video/image while the second retained its image. All six
logo positions, small/medium sizing and logo removal were observed. Fade, Slide,
Zoom and None were selected and playback continued; screenshot sampling does not
establish animation frame pacing or smoothness. The portal acknowledged Applied.
The temporary `Android layout acceptance` screen was revoked and native content
cleared. Its App Check debug registration was removed with absence verified, and
the captured local debug secret was deleted. No backend deployment was needed.
Evidence: `artifacts/android-columns-logo-live.png`, `android-rows-logo-live.png`,
`android-layout-revoked-live.png` and `android-layout-revoked-portal.png`.
Physical TV motion quality, dual-video decoding and
extended soak tests remain pending. No rendering fixes were needed in this run.

Authorization is renewed at most every 20 seconds and expires within 60 seconds
or an earlier server schedule boundary. The manifest's server timestamp supplies
the remaining lifetime; the entire request round trip is subtracted before setting
an elapsed-time deadline. Device wall-clock drift cannot extend playback leases.
Missing server timestamps fail closed. Elapsed-time deadlines bound playback;
network failures cannot extend a lease. Backgrounding clears all media; foreground
restore requires fresh server authorization. Signed URLs and decoded images are
not persisted, Firestore uses memory cache, and Android backup/device-transfer
exclusions protect persisted Firebase device credentials. HTTP is disabled.

Debug and release App Check providers live in separate source sets: emulator builds
use the debug provider, release builds use Play Integrity. Debug token allowlisting
was temporary for acceptance and removed afterward. Never commit or send debug secrets in chat. Release signing,
Play Integrity registration and store/device attestation acceptance are also pending.
No backend rules or App Check enforcement were relaxed.

Debug build, three policy tests (plus the generated sample test), release Java
compilation and Android lint passed. Lint retains dependency-update, version-catalog
and localization warnings. The debug APK installed on Medium_Phone_API_36 (`emulator-5554`).
During the first attempt the emulator repeatedly showed “Process system isn't responding”; startup was
retried once after boot. Firebase initialized but no debug token or visible pairing
screen was confirmed. That attempt granted no screen access. The follow-up below
supersedes this initial blocker.

Follow-up: the user repaired the AVD and the app launched. App Check correctly
denied the unregistered emulator. With explicit approval, its debug credential
was temporarily registered and “Android acceptance” was paired to Test Cafe /
blacktown (`d_e8392f6ee57bfc9b141e99a53a0c629f`). The initial playback rejection
exposed roughly three seconds of emulator clock lag. The native lease calculation
was corrected to use server time conservatively, with expiry-boundary tests.

Live acceptance passed after deploying the server timestamp addition to
`getScreenPlayback`: pairing, alternating existing image/video fixtures, remote
portrait/Stretch settings, Applied status, process restart with restored device
identity and fresh authorization, and revocation clearing content. The screen is
revoked and the debug registration was removed and its absence verified. Removing
the registration prevents future debug exchanges; already issued App Check tokens
can remain valid until expiry, while screen revocation independently blocks access.
The local captured debug secret was removed. Screenshots are in
`artifacts/android-{video,image,revoked}-live.png`.

All 111 backend/security tests, Android policy tests, debug build and lint passed;
production postflight passed all 37 callable/security and Hosting checks. Extended
offline/expiry, background/resume (distinct from process restart), TV remote and
physical hardware acceptance remain pending. Emulator toolbar Home interaction
was inconclusive, so only process restart recovery is claimed here.

Choose **New Project → Phone and Tablet → Empty Views Activity**. Select the
Views template that offers Java, rather than the Compose Empty Activity.

| Setting | Value |
| --- | --- |
| Name | Discrete Signage Display |
| Package name | `com.discretesignage.display` |
| Save location | `E:\Screens\DiscreteSignage\android-display` |
| Language | Java |
| Minimum SDK | API 26 — Android 8.0 |
| Build configuration language | Kotlin DSL, if offered (build files only; app code stays Java) |
| Activity / layout | Keep `MainActivity` / `activity_main` defaults |

API 26 is our proposed initial support floor, not a claim that every device on
that version is compatible. Keep the current stable SDK/Gradle defaults generated
by Android Studio. Let Gradle sync finish and run the blank app once if a device
or emulator is available. Do not create a nested Git repository or add Firebase
credentials, signing keys or dependencies manually. The parent repository tracks
this app; local SDK paths, IDE state, build output and signing material are ignored.

Report when the project is ready and which Google TV/Android device will be used.
Then implement TV launcher/remote navigation, secure pairing, full-screen playback,
local/remote orientation and scale, status reporting and revocation in short steps.
Both Android mobile and TV will be supported through the same app; touchscreen
and Leanback features must be optional in the manifest. Native playback quality,
rotation and resilience need physical-device acceptance before release.

References: [Android project setup](https://developer.android.com/studio/projects/create-project)
and [Android TV setup](https://developer.android.com/training/tv/get-started/create).
