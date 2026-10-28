package com.discretesignage.display;

import android.graphics.Bitmap;
import android.os.SystemClock;
import android.view.View;
import android.widget.FrameLayout;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.TaskCompletionSource;
import com.google.android.gms.tasks.Tasks;
import java.io.File;
import java.io.FileOutputStream;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import java.util.function.Function;
import org.junit.Test;
import org.junit.runner.RunWith;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.action.ViewActions.replaceText;
import static androidx.test.espresso.action.ViewActions.closeSoftKeyboard;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.assertion.ViewAssertions.doesNotExist;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static org.hamcrest.Matchers.containsString;
import static org.junit.Assert.*;

/** Real overlay and native cached-image playback; only the callable transport is substituted. */
@RunWith(AndroidJUnit4.class)
public class ProductOverlayTest {
    private static Object products(long lease) {
        return Map.of("products", List.of(card("Coffee",525), card("Tote",1250), card("Smoothie",675)),
                "currency","AUD","version",1,"serverNow",100000,"expiresAt",100000+lease);
    }
    private static Map<String,Object> card(String name, int cents) {
        return Map.of("name",name,"description","Synthetic acceptance product","priceCents",cents,"available",true);
    }
    private static void tap(String label) { onView(withText(label)).perform(click()); }

    @Test public void productsTriviaAvatarAndOwnerStopLeaveAdvertsRunning() {
        try (Fixture f = new Fixture(() -> Tasks.forResult(products(60000)))) {
            tap("Explore a featured product");
            onView(withText(containsString("AUD $5.25"))).check(matches(isDisplayed()));
            tap("Next product");
            onView(withText(containsString("AUD $12.50"))).check(matches(isDisplayed()));
            tap("Next product");
            onView(withText(containsString("AUD $6.75"))).check(matches(isDisplayed()));
            tap("Next product");
            onView(withText(containsString("AUD $5.25"))).check(matches(isDisplayed()));
            f.scenario.onActivity(a -> f.overlay.start("cat"));
            onView(withContentDescription("Friendly orange cat")).check(matches(isDisplayed()));
            f.scenario.onActivity(a -> f.overlay.start("robot"));
            onView(withContentDescription("Friendly white robot with blue eyes")).check(matches(isDisplayed()));
            tap("Play a quick trivia round"); tap("Centre\nEverest"); tap("Next question");
            tap("Left\nMars"); tap("Next question"); tap("Right\nThree");
            onView(withText("Finish · score 3/3")).check(matches(isDisplayed()));
            tap("Finish · score 3/3"); f.hidden(); f.advertsContinue();
            f.scenario.onActivity(a -> f.overlay.stop()); f.hidden();
        }
    }

    @Test public void leaseExpiryClosesTriviaAndCannotBeReopenedOffline() {
        try (Fixture f = new Fixture(() -> Tasks.forResult(products(3500)))) {
            tap("Play a quick trivia round");
            SystemClock.sleep(3800); f.hidden(); f.advertsContinue();
        }
    }

    @Test public void denialOnRefreshClosesProductWithoutStoppingAdverts() {
        refreshClosesInteraction(Tasks.forResult(Map.of("products",List.of())));
    }

    @Test public void failedRefreshClosesInteractionWithoutStoppingAdverts() {
        refreshClosesInteraction(Tasks.forException(new IllegalStateException("Network unavailable")));
    }

    private void refreshClosesInteraction(Task<Object> response) {
        AtomicInteger requests = new AtomicInteger();
        try (Fixture f = new Fixture(() -> requests.incrementAndGet()==1
                ? Tasks.forResult(products(60000)) : response)) {
            tap("Play a quick trivia round");
            SystemClock.sleep(21000);
            assertEquals(2,requests.get()); f.hidden(); f.advertsContinue();
        }
    }

    @Test public void stoppedSessionIgnoresLateResponseAndCanRestart() {
        TaskCompletionSource<Object> pending = new TaskCompletionSource<>();
        AtomicInteger requests = new AtomicInteger();
        try (Fixture f = new Fixture(() -> requests.incrementAndGet()==1
                ? pending.getTask() : Tasks.forResult(products(60000)))) {
            f.scenario.onActivity(a -> f.overlay.stop());
            pending.setResult(products(60000)); SystemClock.sleep(250); f.hidden();
            f.scenario.onActivity(a -> f.overlay.start("robot"));
            tap("Explore a featured product");
            onView(withText(containsString("AUD $5.25"))).check(matches(isDisplayed()));
            f.scenario.onActivity(a -> f.overlay.stop()); f.hidden(); f.advertsContinue();
        }
    }

    @Test public void optedInConversationShowsNoticeAndEndsWithPlayback() {
        Map<String,Object> enabled = new java.util.HashMap<>((Map<String,Object>)products(60000));
        enabled.put("conversationEnabled", true);
        TaskCompletionSource<Object> pending = new TaskCompletionSource<>();
        try (Fixture f = new Fixture(() -> Tasks.forResult(enabled), data -> pending.getTask())) {
            tap("Ask about our products");
            onView(withText(containsString("sent to OpenAI"))).check(matches(isDisplayed()));
            onView(withHint("Your question")).perform(replaceText("How much?"), closeSoftKeyboard());
            tap("Ask"); onView(withText("Thinking…")).check(matches(isDisplayed()));
            f.scenario.onActivity(a -> f.overlay.stop()); pending.setResult(Map.of("answer", "Late answer"));
            onView(withText("Late answer")).check(doesNotExist()); f.hidden(); f.advertsContinue();
        }
    }

    private static final class Fixture implements AutoCloseable {
        final ActivityScenario<InteractivePreviewActivity> scenario = ActivityScenario.launch(InteractivePreviewActivity.class);
        final AtomicInteger plays = new AtomicInteger();
        ProductOverlay overlay;
        NativeScreen screen;
        View panel;
        File image;
        Fixture(Supplier<Task<Object>> load) {
            this(load, data -> Tasks.forException(new IllegalStateException("Not available")));
        }
        Fixture(Supplier<Task<Object>> load, Function<Map<String,Object>,Task<Object>> send) {
            scenario.onActivity(a -> {
                FrameLayout root = new FrameLayout(a), stage = new FrameLayout(a);
                root.addView(stage,new FrameLayout.LayoutParams(-1,-1)); a.setContentView(root);
                try {
                    image = File.createTempFile("overlay-advert-", ".webp",a.getFilesDir());
                    Bitmap bitmap = Bitmap.createBitmap(64,64,Bitmap.Config.ARGB_8888);
                    bitmap.eraseColor(0xff245d74);
                    try (FileOutputStream out = new FileOutputStream(image)) {bitmap.compress(Bitmap.CompressFormat.WEBP,100,out);}
                    bitmap.recycle();
                } catch (Exception e) {throw new AssertionError(e);}
                screen = new NativeScreen(stage,new NativeScreen.Events() {
                    public void ready(boolean empty) {assertFalse(empty);}
                    public void played(String id,int region) {plays.incrementAndGet();}
                    public void failed() {fail("Cached advert playback failed");}
                });
                screen.update(List.of(List.of(item("a"),item("b"))),null,
                        Map.of("orientation","portrait","scaleType","fit","transition","none"),SystemClock.elapsedRealtime()+120000);
                overlay = new ProductOverlay(a,root,load,send); panel=root.getChildAt(root.getChildCount()-1);
                overlay.start("robot");
            });
            SystemClock.sleep(300);
        }
        Map<String,Object> item(String id) {
            return Map.of("duration",3,"asset",Map.of("id",id,"generation","1","contentType","image/webp",
                    "url","https://storage.googleapis.com/discretesignage.firebasestorage.app/businesses/test/"+id,
                    "localFile",image.getAbsolutePath()));
        }
        void hidden() {scenario.onActivity(a -> assertEquals(View.GONE,panel.getVisibility()));}
        void advertsContinue() {
            int before=plays.get(); SystemClock.sleep(3400); assertTrue("Adverts must keep rotating",plays.get()>before);
        }
        public void close() {
            scenario.onActivity(a -> {overlay.stop();screen.destroy();}); scenario.close();
            if(image!=null) assertTrue(image.delete());
        }
    }
}
