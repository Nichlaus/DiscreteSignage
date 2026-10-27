package com.discretesignage.display;

import android.app.Activity;
import android.os.SystemClock;

/** Opt-in debug input: single-hand presence, not whole-person detection. */
final class PresenceInput {
    interface Listener { void sample(boolean present, boolean wave); void failed(); }
    private CameraProbe camera;
    private LocalHandTracker tracker;
    private int epoch;
    boolean start(Activity activity, Listener listener) {
        stop();
        if (activity.checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) return false;
        final int ticket = epoch;
        tracker = new LocalHandTracker(activity, new LocalHandTracker.Listener() {
            @Override public void result(boolean found, float x, float y, boolean wave, int zone, long captured) {
                if (ticket != epoch) return;
                boolean fresh = SystemClock.elapsedRealtime() - captured <= 500;
                listener.sample(found && fresh, wave && found && fresh);
            }
            @Override public void failed() { if (ticket == epoch) { stop(); listener.failed(); } }
        });
        camera = new CameraProbe(activity, new CameraProbe.Listener() {
            @Override public void live() { }
            @Override public void frame(android.media.Image image,int rotation,boolean mirrored) {
                if (ticket == epoch && tracker != null) tracker.frame(image,rotation,mirrored);
            }
            @Override public void failed() { if (ticket == epoch) { stop(); listener.failed(); } }
        });
        camera.start(); return true;
    }
    void stop() {
        epoch++;
        if (camera != null) { camera.close(); camera = null; }
        if (tracker != null) { tracker.close(); tracker = null; }
    }
}
