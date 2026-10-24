package com.discretesignage.display;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class StartupSettingsTest {
    @Test public void homeEntryUsesTheSameSecureActivityWithoutSelectingIt() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        PackageManager packages = context.getPackageManager();
        boolean selectedBefore = StartupSettings.selected(context);
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                .addCategory(Intent.CATEGORY_DEFAULT).setPackage(context.getPackageName());
        java.util.List<android.content.pm.ResolveInfo> matches = packages.queryIntentActivities(home, PackageManager.MATCH_DEFAULT_ONLY);
        assertEquals(1, matches.size());
        assertEquals(MainActivity.class.getName(), matches.get(0).activityInfo.name);
        ActivityInfo activity = packages.getActivityInfo(new ComponentName(context, MainActivity.class), 0);
        assertEquals(ActivityInfo.LAUNCH_SINGLE_TASK, activity.launchMode);
        assertTrue(activity.exported);
        assertEquals(selectedBefore, StartupSettings.selected(context));
    }
}
