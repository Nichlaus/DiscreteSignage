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
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker;
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class LocalBodyTracker {
    interface Listener { void result(boolean found, float x, float y, long captured); void failed(); }
    private final Context context;
    private final Listener listener;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private PoseLandmarker model;
    private volatile boolean closed, busy;
    private long lastSubmitted;

    LocalBodyTracker(Context context, Listener listener) {
        this.context = context.getApplicationContext(); this.listener = listener;
    }
    // Called only on the camera's main-thread callback; no Image is retained.
    void frame(Image source, int rotation, boolean mirrored) {
        long now = SystemClock.elapsedRealtime();
        if (closed || busy || now - lastSubmitted < 250) return;
        busy = true; lastSubmitted = now;
        final Bitmap bitmap;
        try { bitmap = LocalHandTracker.rgb(source); }
        catch (RuntimeException error) { busy = false; close(); listener.failed(); return; }
        worker.execute(() -> {
            Bitmap upright = bitmap;
            try {
                if (closed) return;
                if (model == null) model = PoseLandmarker.createFromOptions(context,
                        PoseLandmarker.PoseLandmarkerOptions.builder()
                                .setBaseOptions(BaseOptions.builder().setModelAssetPath("pose_landmarker_lite.task").build())
                                .setRunningMode(RunningMode.VIDEO).setNumPoses(2)
                                .setMinPoseDetectionConfidence(.65f).setMinPosePresenceConfidence(.65f)
                                .setMinTrackingConfidence(.65f).build());
                if (rotation != 0) {
                    Matrix matrix = new Matrix(); matrix.postRotate(rotation);
                    upright = Bitmap.createBitmap(bitmap,0,0,bitmap.getWidth(),bitmap.getHeight(),matrix,false);
                }
                MPImage input = new BitmapImageBuilder(upright).build();
                try {
                    List<List<NormalizedLandmark>> poses = model.detectForVideo(input, now).landmarks();
                    boolean found = false; float x = .5f, y = .5f;
                    if (poses.size() == 1 && poses.get(0).size() >= 25) {
                        float[][] torso = new float[4][4];
                        int[] indices = {11, 12, 23, 24};
                        for (int i = 0; i < indices.length; i++) {
                            NormalizedLandmark point = poses.get(0).get(indices[i]);
                            torso[i] = new float[]{point.x(), point.y(), point.visibility().orElse(0f), point.presence().orElse(0f)};
                        }
                        found = BodyPresence.visible(torso);
                        if (found) {
                            x = (torso[0][0] + torso[1][0]) / 2;
                            y = (torso[0][1] + torso[1][1]) / 2;
                            if (mirrored) x = 1 - x;
                        }
                    }
                    final boolean detected = found; final float px = x, py = y;
                    main.post(() -> { if (!closed) listener.result(detected, px, py, now); });
                } finally { input.close(); }
            } catch (RuntimeException | LinkageError error) {
                main.post(() -> { if (!closed) { close(); listener.failed(); } });
            } finally { if (upright != bitmap) upright.recycle(); bitmap.recycle(); busy = false; }
        });
    }
    void close() {
        if (closed) return;
        closed = true; main.removeCallbacksAndMessages(null);
        worker.execute(() -> { if (model != null) { model.close(); model = null; } });
        worker.shutdown();
    }
}
