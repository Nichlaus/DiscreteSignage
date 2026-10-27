package com.discretesignage.display;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Matrix;
import android.media.Image;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker;
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class LocalHandTracker {
    interface Listener { void result(boolean found, float x, float y, boolean wave, int zone, long captured); void failed(); }
    private final Context context;
    private final Listener listener;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final HandMotion motion = new HandMotion();
    private HandLandmarker model;
    private volatile boolean closed, busy;
    private long lastSubmitted;

    LocalHandTracker(Context context, Listener listener) {
        this.context = context.getApplicationContext(); this.listener = listener;
    }
    // Called only on the camera's main-thread callback; no Image is retained.
    void frame(Image source, int rotation, boolean mirrored) {
        long now = SystemClock.elapsedRealtime();
        if (closed || busy || now - lastSubmitted < 125) return;
        busy = true; lastSubmitted = now;
        final Bitmap bitmap;
        try { bitmap = rgb(source); }
        catch (RuntimeException error) { busy = false; close(); listener.failed(); return; }
        worker.execute(() -> {
            Bitmap upright = bitmap;
            try {
                if (closed) return;
                if (model == null) model = HandLandmarker.createFromOptions(context,
                        HandLandmarker.HandLandmarkerOptions.builder()
                                .setBaseOptions(BaseOptions.builder().setModelAssetPath("hand_landmarker.task").build())
                                .setRunningMode(RunningMode.VIDEO).setNumHands(2)
                                .setMinHandDetectionConfidence(.65f).setMinHandPresenceConfidence(.65f)
                                .setMinTrackingConfidence(.65f).build());
                if (rotation != 0) {
                    Matrix matrix = new Matrix(); matrix.postRotate(rotation);
                    upright = Bitmap.createBitmap(bitmap,0,0,bitmap.getWidth(),bitmap.getHeight(),matrix,false);
                }
                MPImage input = new BitmapImageBuilder(upright).build();
                try {
                    List<List<NormalizedLandmark>> hands = model.detectForVideo(input, now).landmarks();
                    boolean found = hands.size() == 1;
                    float x = 0, y = 0; boolean wave = false; int zone = -1;
                    if (found) {
                        List<NormalizedLandmark> hand = hands.get(0);
                        // Palm centre; front cameras mirror only the interaction coordinates.
                        for (int index : new int[]{0,5,9,13,17}) { x += hand.get(index).x()/5; y += hand.get(index).y()/5; }
                        if (mirrored) x = 1 - x;
                        found = Float.isFinite(x) && Float.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1;
                        int extended = 0;
                        for (int tip : new int[]{8,12,16,20}) {
                            if (distance(hand.get(tip),hand.get(0)) > distance(hand.get(tip-2),hand.get(0)) * 1.15f) extended++;
                        }
                        wave = motion.update(x, y, found && extended >= 3, now);
                        boolean indexExtended = distance(hand.get(8), hand.get(0)) > distance(hand.get(6), hand.get(0)) * 1.15f;
                        if (found && extended == 1 && indexExtended) {
                            float tipX = hand.get(8).x();
                            zone = PointSelection.zone(mirrored ? 1 - tipX : tipX, hand.get(8).y());
                        }
                    } else motion.update(Float.NaN, Float.NaN, false, now);
                    final boolean detected = found, waved = wave;
                    final float px = x, py = y; final int pointZone = zone;
                    main.post(() -> { if (!closed) listener.result(detected,px,py,waved,pointZone,now); });
                } finally { input.close(); }
            } catch (RuntimeException | LinkageError error) {
                main.post(() -> { if (!closed) { close(); listener.failed(); } });
            } finally { if (upright != bitmap) upright.recycle(); bitmap.recycle(); busy = false; }
        });
    }
    private static float distance(NormalizedLandmark a, NormalizedLandmark b) {
        return (float)Math.hypot(a.x()-b.x(),a.y()-b.y());
    }
    static Bitmap rgb(Image image) {
        int width = image.getWidth(), height = image.getHeight();
        if (width > 640 || height > 480 || image.getPlanes().length != 3) throw new IllegalArgumentException("Unsupported frame");
        Image.Plane[] planes = image.getPlanes();
        ByteBuffer y = planes[0].getBuffer(), u = planes[1].getBuffer(), v = planes[2].getBuffer();
        int[] pixels = new int[width*height];
        for (int row=0; row<height; row++) for (int col=0; col<width; col++) {
            int yy = (y.get(y.position()+row*planes[0].getRowStride()+col*planes[0].getPixelStride())&255)-16;
            int uu = (u.get(u.position()+row/2*planes[1].getRowStride()+col/2*planes[1].getPixelStride())&255)-128;
            int vv = (v.get(v.position()+row/2*planes[2].getRowStride()+col/2*planes[2].getPixelStride())&255)-128;
            yy = Math.max(0,yy)*1192;
            pixels[row*width+col] = 0xff000000 | clamp((yy+1634*vv)>>10)<<16
                    | clamp((yy-833*vv-400*uu)>>10)<<8 | clamp((yy+2066*uu)>>10);
        }
        return Bitmap.createBitmap(pixels,width,height,Bitmap.Config.ARGB_8888);
    }
    private static int clamp(int value) { return Math.max(0,Math.min(255,value)); }
    void close() {
        if (closed) return;
        closed = true; main.removeCallbacksAndMessages(null);
        worker.execute(() -> { if (model != null) { model.close(); model = null; } motion.reset(); });
        worker.shutdown();
    }
}
