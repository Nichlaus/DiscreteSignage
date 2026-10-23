package com.discretesignage.display;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.Map;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class LocalDisplaySettingsTest {
    @Test public void overridesSurviveRestartButNeverFollowAnotherDeviceOrPortalRevision() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SharedPreferences preferences = context.getSharedPreferences("settings-test", Context.MODE_PRIVATE);
        preferences.edit().clear().commit();
        try {
            LocalDisplaySettings settings = new LocalDisplaySettings(preferences);
            Map<String, Object> portal = Map.of("orientation", "landscape", "scaleType", "fit", "layout", "rows");
            settings.bind("first-device", 4); settings.save(2, 3);
            assertTrue(settings.overridden());
            assertEquals("portrait", settings.apply(portal).get("orientation"));
            assertEquals("stretch", settings.apply(portal).get("scaleType"));
            assertEquals("rows", settings.apply(portal).get("layout"));
            assertEquals("fit", portal.get("scaleType"));
            settings = new LocalDisplaySettings(preferences); settings.bind("first-device", 4);
            assertTrue(settings.overridden());
            settings.bind("first-device", 5); assertFalse(settings.overridden());
            assertEquals(portal, settings.apply(portal));
            settings.save(1, 2); settings.bind("second-device", 5); assertFalse(settings.overridden());
            settings.save(2, 3); settings.clear(); assertFalse(settings.overridden());
        } finally { preferences.edit().clear().commit(); }
    }
}
