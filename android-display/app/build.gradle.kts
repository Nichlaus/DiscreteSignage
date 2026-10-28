import java.util.zip.ZipFile

plugins {
    alias(libs.plugins.android.application)
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

// Keep the camera preview out of release builds until device acceptance is complete.
val releaseManifest = layout.buildDirectory.file("intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml")
val releaseApkDirectory = layout.buildDirectory.dir("outputs/apk/release")
val verifyReleaseCameraGate = tasks.register("verifyReleaseCameraGate") {
    notCompatibleWithConfigurationCache("Verifies packaged release files after assembly")
    doLast {
        val manifest = releaseManifest.get().asFile
        check(manifest.isFile) { "Release manifest is missing; cannot verify the camera gate." }
        val xml = manifest.readText()
        listOf("android.permission.CAMERA", "android.permission.RECORD_AUDIO", "InteractivePreviewActivity", "ProductPreviewActivity").forEach {
            check(!xml.contains(it)) { "Release camera gate failed: $it appears in the manifest." }
        }
        val apkDir = releaseApkDirectory.get().asFile
        val apks = apkDir.listFiles { file -> file.extension == "apk" }?.toList().orEmpty()
        check(apks.size == 1) { "Expected one release APK to verify." }
        ZipFile(apks.single()).use { apk ->
            val entries = apk.entries().asSequence().toList()
            check(entries.none { it.name.endsWith(".task") }) { "Release APK contains a camera model." }
            val forbidden = listOf("Lcom/discretesignage/display/CameraProbe;", "Lcom/discretesignage/display/LocalBodyTracker;", "Lcom/discretesignage/display/LocalHandTracker;")
            entries.filter { it.name.matches(Regex("classes[0-9]*\\.dex")) }.forEach { entry ->
                val dex = apk.getInputStream(entry).use { it.readBytes().toString(Charsets.ISO_8859_1) }
                forbidden.forEach { check(!dex.contains(it)) { "Release camera gate failed: $it is packaged." } }
            }
        }
    }
}
tasks.matching { it.name == "assembleRelease" }.configureEach { finalizedBy(verifyReleaseCameraGate) }
