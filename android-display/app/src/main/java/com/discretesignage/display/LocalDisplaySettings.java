package com.discretesignage.display;

import android.content.SharedPreferences;
import java.util.HashMap;
import java.util.Map;

/** Device adjustments apply only to the current screen revision. */
final class LocalDisplaySettings {
    static final String[] ORIENTATIONS = {"", "landscape", "portrait", "landscape-flipped", "portrait-flipped"};
    static final String[] SCALES = {"", "fit", "fill", "stretch"};
    private final SharedPreferences preferences;
    LocalDisplaySettings(SharedPreferences preferences) { this.preferences = preferences; }

    void bind(String device, long version) {
        if (!device.equals(preferences.getString("device", "")) || version != preferences.getLong("version", -1)) {
            preferences.edit().clear().putString("device", device).putLong("version", version).apply();
        }
    }
    void save(int orientation, int scale) {
        preferences.edit().putString("orientation", ORIENTATIONS[orientation]).putString("scaleType", SCALES[scale]).apply();
    }
    int selected(String key, String[] choices) {
        String value = preferences.getString(key, "");
        for (int i = 0; i < choices.length; i++) if (choices[i].equals(value)) return i;
        return 0;
    }
    boolean overridden() { return selected("orientation", ORIENTATIONS) != 0 || selected("scaleType", SCALES) != 0; }
    Map<String, Object> apply(Map<String, Object> config) {
        Map<String, Object> result = new HashMap<>(config);
        int orientation = selected("orientation", ORIENTATIONS), scale = selected("scaleType", SCALES);
        if (orientation != 0) result.put("orientation", ORIENTATIONS[orientation]);
        if (scale != 0) result.put("scaleType", SCALES[scale]);
        return result;
    }
    void clear() { preferences.edit().clear().apply(); }
}
