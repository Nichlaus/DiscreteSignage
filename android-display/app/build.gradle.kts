import java.util.zip.ZipFile
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.TaskAction
import org.gradle.work.DisableCachingByDefault

plugins {
    alias(libs.plugins.android.application)
}

@DisableCachingByDefault(because = "Verification runs after each release package is built")
abstract class VerifyReleaseCameraGate : DefaultTask() {
    @get:InputFile abstract val manifest: RegularFileProperty
    @get:InputFile abstract val archive: RegularFileProperty

    @TaskAction fun verify() {
        val forbiddenManifest = listOf("android.permission.CAMERA", "android.permission.RECORD_AUDIO", "InteractivePreviewActivity", "ProductPreviewActivity")
        val merged = manifest.get().asFile.readText()
        forbiddenManifest.forEach { check(!merged.contains(it)) { "Release camera gate failed: $it appears in the merged manifest." } }
        val file = archive.get().asFile
        val bundle = file.extension == "aab"
        ZipFile(file).use { zip ->
            val entries = zip.entries().asSequence().toList()
            val packagedManifest = zip.getEntry(if (bundle) "base/manifest/AndroidManifest.xml" else "AndroidManifest.xml")
            check(packagedManifest != null) { "Release package is missing its manifest." }
            val manifestBytes = zip.getInputStream(packagedManifest).use { it.readBytes() }
            val manifestData = manifestBytes.toString(Charsets.ISO_8859_1)
            forbiddenManifest.forEach {
                val utf16Bytes = it.toByteArray(Charsets.UTF_16LE).toString(Charsets.ISO_8859_1)
                check(!manifestData.contains(it) && !manifestData.contains(utf16Bytes)) { "Release camera gate failed: $it appears in the packaged manifest." }
            }
            check(entries.none { it.name.endsWith(".task", ignoreCase = true) }) { "Release package contains a camera model." }
            val forbidden = listOf("Lcom/discretesignage/display/CameraProbe;", "Lcom/discretesignage/display/LocalBodyTracker;", "Lcom/discretesignage/display/LocalHandTracker;")
            val dexEntries = entries.filter { it.name.matches(Regex("(?:.*/)?classes[0-9]*\\.dex")) }
            check(dexEntries.isNotEmpty()) { "Release package contains no dex files to verify." }
            dexEntries.forEach { entry ->
                val dex = zip.getInputStream(entry).use { it.readBytes().toString(Charsets.ISO_8859_1) }
                forbidden.forEach { check(!dex.contains(it)) { "Release camera gate failed: $it is packaged." } }
            }
        }
    }
}

android {
    namespace = "com.discretesignage.display"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.discretesignage.display"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            optimization {
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
    implementation("com.google.firebase:firebase-functions")
    implementation("com.google.firebase:firebase-appcheck")
    debugImplementation("com.google.firebase:firebase-appcheck-debug")
    debugImplementation("com.google.mediapipe:tasks-vision:1.1.1")
    releaseImplementation("com.google.firebase:firebase-appcheck-playintegrity")
    implementation("androidx.media3:media3-exoplayer:1.9.3")
    implementation("androidx.media3:media3-ui:1.9.3")
    implementation(libs.activity.ktx)
    implementation(libs.appcompat)
    implementation(libs.constraintlayout)
    implementation(libs.material)
    testImplementation(libs.junit)
    androidTestImplementation(libs.espresso.core)
    androidTestImplementation(libs.ext.junit)
}

// Keep the camera preview out of release packages until device acceptance is complete.
val mergedReleaseManifest = layout.buildDirectory.file("intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml")
val verifyReleaseApkCameraGate = tasks.register<VerifyReleaseCameraGate>("verifyReleaseApkCameraGate") {
    manifest.set(mergedReleaseManifest)
    archive.set(layout.buildDirectory.file("outputs/apk/release/app-release-unsigned.apk"))
}
val verifyReleaseBundleCameraGate = tasks.register<VerifyReleaseCameraGate>("verifyReleaseBundleCameraGate") {
    manifest.set(mergedReleaseManifest)
    archive.set(layout.buildDirectory.file("outputs/bundle/release/app-release.aab"))
}
tasks.matching { it.name == "assembleRelease" }.configureEach { finalizedBy(verifyReleaseApkCameraGate) }
tasks.matching { it.name == "bundleRelease" }.configureEach { finalizedBy(verifyReleaseBundleCameraGate) }
