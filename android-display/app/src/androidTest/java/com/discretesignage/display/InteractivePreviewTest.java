package com.discretesignage.display;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.*;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static org.hamcrest.Matchers.not;

@RunWith(AndroidJUnit4.class)
public class InteractivePreviewTest {
    @Test public void nativeAnswersLockAndRestartWithoutCameraAccess() {
        try (ActivityScenario<InteractivePreviewActivity> scenario = ActivityScenario.launch(InteractivePreviewActivity.class)) {
            onView(withText("Centre: Everest")).perform(scrollTo(), click());
            onView(withText("Correct! Everest is tallest above sea level.")).check(matches(isDisplayed()));
            onView(withText("Left: K2")).check(matches(not(isEnabled())));
            onView(withText("Start over")).perform(scrollTo(), click());
            onView(withText("Left: K2")).perform(scrollTo(), click());
            onView(withText("Good try! The answer is Everest.")).check(matches(isDisplayed()));
            java.util.concurrent.CountDownLatch destroyed = new java.util.concurrent.CountDownLatch(1);
            androidx.test.runner.lifecycle.ActivityLifecycleCallback callback = (activity, stage) -> {
                if (activity instanceof InteractivePreviewActivity
                        && stage == androidx.test.runner.lifecycle.Stage.DESTROYED) destroyed.countDown();
            };
            androidx.test.runner.lifecycle.ActivityLifecycleMonitor monitor =
                    androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance();
            monitor.addLifecycleCallback(callback);
            try {
                onView(withText("Return to display")).perform(scrollTo(), click());
                org.junit.Assert.assertTrue(destroyed.await(5, java.util.concurrent.TimeUnit.SECONDS));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt(); throw new AssertionError(e);
            } finally { monitor.removeLifecycleCallback(callback); }
        }
    }
}
