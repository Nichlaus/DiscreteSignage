package com.discretesignage.display;

import android.app.Activity;
import android.os.SystemClock;

/** Opt-in debug input: body presence with a separate hand-wave input. */
final class PresenceInput {
    interface Listener { void sample(boolean present, boolean wave); void position(float x, float y); void point(int zone, long captured); void failed(); }
    private CameraProbe camera;
    private LocalHandTracker tracker;
    private LocalBodyTracker body;
    private long bodyAt = -1;
    private int epoch;
    static boolean available() { return true; }
    static boolean fresh(long captured, long now) { return captured >= 0 && captured <= now && now - captured <= 500; }
    boolean start(Activity activity, String cameraId, Listener listener) {
        stop();
        if (activity.checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) return false;
        final int ticket = epoch;
        tracker = new LocalHandTracker(activity, new LocalHandTracker.Listener() {
            @Override public void result(boolean found, float x, float y, boolean wave, int zone, long captured) {
                if (ticket != epoch) return;
                long now = SystemClock.elapsedRealtime();
                boolean valid = fresh(captured, now) && fresh(bodyAt, now);
                listener.point(found && valid ? zone : -1, captured);
                if (wave && found && valid)
                    listener.sample(true, true);
            }
            @Override public void failed() { if (ticket == epoch) { stop(); listener.failed(); } }
        });
        body = new LocalBodyTracker(activity, new LocalBodyTracker.Listener() {
            @Override public void result(boolean found, float x, float y, long captured) {
                if (ticket != epoch) return;
                boolean present = found && fresh(captured, SystemClock.elapsedRealtime());
                bodyAt = present ? captured : -1;
                listener.sample(present, false);
                if (present) listener.position(x, y);
            }
            @Override public void failed() { if (ticket == epoch) { stop(); listener.failed(); } }
        });
        camera = new CameraProbe(activity, cameraId, new CameraProbe.Listener() {
            @Override public void live() { }
            @Override public void frame(android.media.Image image,int rotation,boolean mirrored) {
                if (ticket != epoch) return;
                if (body != null) body.frame(image,rotation,mirrored);
                if (tracker != null && fresh(bodyAt, SystemClock.elapsedRealtime()))
                    tracker.frame(image,rotation,mirrored);
            }
            @Override public void failed() { if (ticket == epoch) { stop(); listener.failed(); } }
        });
        camera.start(); return true;
    }
    void stop() {
        epoch++; bodyAt = -1;
        if (camera != null) { camera.close(); camera = null; }
        if (tracker != null) { tracker.close(); tracker = null; }
        if (body != null) { body.close(); body = null; }
    }
}
