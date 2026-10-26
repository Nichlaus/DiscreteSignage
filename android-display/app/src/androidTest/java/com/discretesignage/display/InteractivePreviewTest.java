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
    @Test public void targetHighlightClearsOnLossStaleInputAndAvatarChange() {
        try (ActivityScenario<InteractivePreviewActivity> scenario = ActivityScenario.launch(InteractivePreviewActivity.class)) {
            scenario.onActivity(activity -> { activity.pointAt(2,0,0); activity.pointAt(2,300,300); });
            onView(withText("Centre: Everest")).check(matches(isSelected()));
            scenario.onActivity(activity -> activity.pointAt(-1,450,450));
            onView(withText("Centre: Everest")).check(matches(not(isSelected())));
            scenario.onActivity(activity -> { activity.pointAt(1,600,600); activity.pointAt(1,700,1300); });
            onView(withText("Left: K2")).check(matches(not(isSelected())));
            scenario.onActivity(activity -> activity.pointAt(3,1400,1400));
            onView(withText("Right: Mont Blanc")).check(matches(isSelected()));
            onView(withText("Robot")).perform(scrollTo(), click());
            onView(withText("Right: Mont Blanc")).check(matches(not(isSelected())));
            onView(withContentDescription("Friendly white robot with blue eyes")).check(matches(isDisplayed()));
        }
    }
    @Test public void threeQuestionRoundReturnsToDisplayWithoutCamera() {
        try (ActivityScenario<InteractivePreviewActivity> scenario = ActivityScenario.launch(InteractivePreviewActivity.class)) {
            onView(withText("Centre: Everest")).perform(scrollTo(), click());
            android.os.SystemClock.sleep(4300);
            onView(withText("Left: Mars")).perform(scrollTo(), click());
            android.os.SystemClock.sleep(4300);
            onView(withText("Right: Three")).perform(scrollTo(), click());
            onView(withText("Round complete · 3 of 3 correct · returning to adverts in 8 seconds"))
                    .check(matches(withText("Round complete · 3 of 3 correct · returning to adverts in 8 seconds")));
            android.os.SystemClock.sleep(8300);
            org.junit.Assert.assertEquals(androidx.lifecycle.Lifecycle.State.DESTROYED, scenario.getState());
        }
    }
    @Test public void syntheticPointingRequiresHoldAndReleaseAfterRestart() {
        try (ActivityScenario<InteractivePreviewActivity> scenario = ActivityScenario.launch(InteractivePreviewActivity.class)) {
            scenario.onActivity(activity -> {
                activity.pointAt(2,0,0);
                activity.pointAt(2,300,300);
                activity.pointAt(-1,450,450);
                activity.pointAt(2,600,600);
                activity.pointAt(2,900,900);
            });
            onView(withText("Centre: Everest")).check(matches(isEnabled()));
            scenario.onActivity(activity -> {
                activity.pointAt(2,1200,1200);
                activity.pointAt(2,1500,1500);
            });
            onView(withText("Correct! Everest is tallest above sea level.")).check(matches(withText("Correct! Everest is tallest above sea level.")));
            onView(withText("Start over")).perform(scrollTo(), click());
            scenario.onActivity(activity -> {
                for (long t=1800;t<=3000;t+=300) activity.pointAt(1,t,t);
            });
            onView(withText("Left: K2")).check(matches(isEnabled()));
            scenario.onActivity(activity -> {
                activity.pointAt(-1,3100,3100);
                for (long t=3300;t<=4200;t+=300) activity.pointAt(1,t,t);
            });
            onView(withText("Left: K2")).check(matches(not(isEnabled())));
            onView(withText("Good try! The answer is Everest.")).check(matches(withText("Good try! The answer is Everest.")));
        }
    }
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
