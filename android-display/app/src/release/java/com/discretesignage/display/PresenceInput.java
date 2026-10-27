package com.discretesignage.display;

import android.app.Activity;

/** Camera input stays unavailable in release until physical acceptance. */
final class PresenceInput {
    interface Listener { void sample(boolean present, boolean wave); void position(float x, float y); void point(int zone, long captured); void failed(); }
    static boolean available() { return false; }
    boolean start(Activity activity, String cameraId, Listener listener) { return false; }
    void stop() { }
}
