package com.discretesignage.display;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.google.android.gms.tasks.TaskCompletionSource;
import com.google.android.gms.tasks.Tasks;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;
import org.junit.runner.RunWith;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.*;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.assertion.ViewAssertions.doesNotExist;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static org.hamcrest.Matchers.containsString;
import static org.junit.Assert.assertEquals;

@RunWith(AndroidJUnit4.class)
public class ConversationDialogTest {
    @Test public void noticePrecedesSubmissionAndEndingInvalidatesLateReply() {
        AtomicInteger calls = new AtomicInteger(); TaskCompletionSource<Object> pending = new TaskCompletionSource<>();
        try (ActivityScenario<InteractivePreviewActivity> scenario = ActivityScenario.launch(InteractivePreviewActivity.class)) {
            scenario.onActivity(activity -> new ConversationDialog(data -> { calls.incrementAndGet(); return pending.getTask(); }).open(activity));
            onView(withText(containsString("sent to OpenAI"))).check(matches(isDisplayed()));
            assertEquals(0, calls.get());
            onView(withHint("Your question")).perform(replaceText("How much?"), closeSoftKeyboard());
            onView(withHint("Your question")).check(matches(withText("How much?")));
            onView(withText("Ask")).perform(click());
            onView(withText("Thinking…")).check(matches(isDisplayed())); assertEquals(1, calls.get());
            onView(withText("End conversation")).perform(click()); pending.setResult(Map.of("answer", "Late answer"));
            onView(withText("Late answer")).check(doesNotExist());
        }
    }

    @Test public void syntheticAnswerAppearsAndEndClearsTheSession() {
        try (ActivityScenario<InteractivePreviewActivity> scenario = ActivityScenario.launch(InteractivePreviewActivity.class)) {
            ConversationDialog[] chat = new ConversationDialog[1];
            scenario.onActivity(activity -> { chat[0] = new ConversationDialog(data -> Tasks.forResult(Map.of("answer", "AUD $5.25"))); chat[0].open(activity); });
            onView(withHint("Your question")).perform(replaceText("Price?"), closeSoftKeyboard());
            onView(withText("Ask")).perform(click());
            onView(withText("AUD $5.25")).check(matches(isDisplayed()));
            onView(withText("End conversation")).perform(click());
            scenario.onActivity(activity -> chat[0].open(activity));
            onView(withText("AUD $5.25")).check(doesNotExist());
            onView(withHint("Your question")).check(matches(withText("")));
            onView(withText("End conversation")).perform(click());
        }
    }
}
