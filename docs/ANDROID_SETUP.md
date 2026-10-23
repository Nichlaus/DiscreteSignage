# Java display app setup

The user created this Java Views project on 2026-10-23 at the location below.
Its launcher label and Gradle project name are now Discrete Signage Display.
The package is `com.discretesignage.display`, with minimum API 26. Initial testing
will use an Android emulator. Secure playback integration and physical-device
acceptance remain pending. Keep the existing Reutos apps unchanged.

Validation: `:app:assembleDebug` passed on 2026-10-23 with the generated toolchain.
The debug APK is in `android-display/app/build/outputs/apk/debug/app-debug.apk`.
No emulator launch or signage playback acceptance has been performed yet.

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
