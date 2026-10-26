package com.discretesignage.display;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.*;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;

/** Run only with explicit permission on the verified synthetic-camera emulator. */
@RunWith(AndroidJUnit4.class)
public class CameraProbeTest {
    private void awaitLive() {
        long deadline = android.os.SystemClock.elapsedRealtime() + 15000;
        while (true) {
            try {
                onView(withText("Camera on · local frames only · no recording")).check(matches(isDisplayed()));
                onView(withText("Show one hand to the camera")).check(matches(isDisplayed()));
                return;
            } catch (androidx.test.espresso.NoMatchingViewException error) {
                if (android.os.SystemClock.elapsedRealtime() >= deadline) throw error;
                android.os.SystemClock.sleep(50);
            }
        }
    }
    @Test public void explicitStartStopAndRestartReceiveLocalFrames() {
        org.junit.Assume.assumeTrue("Explicit synthetic-camera test opt-in required",
                "true".equals(androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("syntheticCameraTest")));
        try (ActivityScenario<InteractivePreviewActivity> scenario = ActivityScenario.launch(InteractivePreviewActivity.class)) {
            java.util.concurrent.CountDownLatch lateCallback = new java.util.concurrent.CountDownLatch(1);
            scenario.onActivity(activity -> {
                CameraProbe pending = new CameraProbe(activity, new CameraProbe.Listener() {
                    @Override public void live() { lateCallback.countDown(); }
                    @Override public void failed() { lateCallback.countDown(); }
                });
                pending.start(); pending.close();
            });
            try {
                org.junit.Assert.assertFalse(lateCallback.await(1, java.util.concurrent.TimeUnit.SECONDS));
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt(); throw new AssertionError(error);
            }
            onView(withText("Camera off")).check(matches(isDisplayed()));
            onView(withText("Enable local camera")).perform(scrollTo(), click());
            awaitLive();
            onView(withText("Stop camera")).perform(scrollTo(), click());
            onView(withText("Camera off")).check(matches(isDisplayed()));
            onView(withText("Enable local camera")).perform(scrollTo(), click());
            awaitLive();
            onView(withText("Return to display")).perform(scrollTo(), click());
        }
    }
}
