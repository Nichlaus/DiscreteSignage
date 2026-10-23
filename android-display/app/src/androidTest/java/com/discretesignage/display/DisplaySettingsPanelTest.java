package com.discretesignage.display;

import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static org.hamcrest.Matchers.not;

@RunWith(AndroidJUnit4.class)
public class DisplaySettingsPanelTest {
    @Test public void unpairedSettingsExplainConnectionAndSurviveBackgroundResume() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            onView(withText("Display settings")).perform(click());
            onView(withText("Apply")).check(matches(not(isEnabled())));
            onView(withText("Connect this display before adjusting it. You can retry the connection below."))
                    .check(matches(isDisplayed()));
            scenario.moveToState(Lifecycle.State.CREATED);
            scenario.moveToState(Lifecycle.State.RESUMED);
            onView(isRoot()).perform(androidx.test.espresso.action.ViewActions.pressKey(android.view.KeyEvent.KEYCODE_MENU));
            onView(withText("Apply")).check(matches(not(isEnabled())));
            onView(withText("Cancel")).perform(click());
            onView(withText("Display settings")).check(matches(isDisplayed()));
        }
    }
}

