package com.discretesignage.display;

import android.app.Activity;
import android.app.role.RoleManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.provider.Settings;
import androidx.appcompat.app.AlertDialog;

/** Android launches its selected Home app after startup; selection belongs to the owner. */
final class StartupSettings {
    static boolean selected(Context context) {
        Intent intent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        ResolveInfo home = context.getPackageManager().resolveActivity(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
        return home != null && home.activityInfo != null && context.getPackageName().equals(home.activityInfo.packageName);
    }

    static void show(Activity activity) {
        boolean enabled = selected(activity);
        new AlertDialog.Builder(activity).setTitle("Start after reboot")
                .setMessage((enabled ? "Discrete Signage is your Home app."
                        : "One-time setup: choose Discrete Signage as this device's Home app.")
                        + "\n\nAndroid can then open the display after startup or unlock. The Home button will also return here."
                        + "\n\nInternet is required after restarting to authorize playback. This does not bypass a screen lock."
                        + "\n\nTo turn this off, choose your previous Home app. Some TVs do not allow changing the Home app; those devices need a supported managed-device setup.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton(enabled ? "Change Home app" : "Set up startup", (dialog, which) -> choose(activity, enabled))
                .show();
    }

    private static void choose(Activity activity, boolean enabled) {
        if (!enabled && Build.VERSION.SDK_INT >= 29) {
            RoleManager roles = activity.getSystemService(RoleManager.class);
            if (roles != null && roles.isRoleAvailable(RoleManager.ROLE_HOME)) {
                try {
                    activity.startActivityForResult(roles.createRequestRoleIntent(RoleManager.ROLE_HOME), 41);
                    return;
                } catch (ActivityNotFoundException | SecurityException ignored) { }
            }
        }
        try { activity.startActivity(new Intent(Settings.ACTION_HOME_SETTINGS)); }
        catch (ActivityNotFoundException | SecurityException error) {
            new AlertDialog.Builder(activity).setTitle("Startup setup unavailable")
                    .setMessage("This device does not expose a Home app selector. Contact your administrator about a supported managed-device setup. Automatic startup has not been enabled.")
                    .setPositiveButton("OK", null).show();
        }
    }
}
