package com.discretesignage.display;

import android.content.Context;
import android.os.SystemClock;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class NativeScreenTest {
    @Test public void splitRegionsRenewWithoutRecreatingAndStopClearsEveryView() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
            FrameLayout stage = new FrameLayout(context);
            int[] ready = {0};
            NativeScreen screen = new NativeScreen(stage, new NativeScreen.Events() {
                public void ready(boolean empty) { assertTrue(empty); ready[0]++; }
                public void played(String id, int region) { fail("Empty regions must not report plays"); }
                public void failed() { fail("Valid blank layout failed"); }
            });
            List<Map<String, Object>> blank = Collections.emptyList();
            for (String layout : new String[]{"columns", "rows"}) {
                Map<String, Object> config = Map.of("orientation", "landscape", "scaleType", "fit", "layout", layout);
                screen.update(List.of(blank, blank), null, config, SystemClock.elapsedRealtime() + 60000);
                LinearLayout container = (LinearLayout) stage.getChildAt(0);
                assertEquals(2, container.getChildCount());
                assertEquals("columns".equals(layout) ? LinearLayout.HORIZONTAL : LinearLayout.VERTICAL, container.getOrientation());
                screen.update(List.of(blank, blank), null, config, SystemClock.elapsedRealtime() + 60000);
                assertSame(container, stage.getChildAt(0));
                screen.stop(); assertEquals(0, stage.getChildCount());
            }
            assertEquals(2, ready[0]); screen.destroy();
        });
    }
}
