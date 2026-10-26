package com.discretesignage.display;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.ImageFormat;
import android.hardware.camera2.*;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.Handler;
import android.os.Looper;
import android.util.Size;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;

/** Debug camera lifecycle. Frame callbacks must copy synchronously; Images never escape. */
final class CameraProbe {
    interface Listener {
        void live(); void failed();
        default void frame(Image image, int rotation, boolean mirrored) { }
    }
    private final Context context;
    private final CameraManager manager;
    private final Listener listener;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private CameraDevice device;
    private CameraCaptureSession session;
    private ImageReader reader;
    private int epoch;
    private boolean announced;
    private final Runnable timeout = this::fail;

    CameraProbe(Context context, Listener listener) {
        this.context = context;
        manager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
        this.listener = listener;
    }
    @SuppressLint("MissingPermission") // Activity checks runtime permission after explicit per-session opt-in.
    void start() {
        close(); final int ticket = epoch;
        try {
            String[] ids = manager.getCameraIdList();
            if (ids.length == 0) { fail(); return; }
            String selected = ids[0];
            for (String id : ids) {
                if (Integer.valueOf(CameraCharacteristics.LENS_FACING_FRONT).equals(
                        manager.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING))) {
                    selected = id; break;
                }
            }
            CameraCharacteristics characteristics = manager.getCameraCharacteristics(selected);
            boolean mirrored = Integer.valueOf(CameraCharacteristics.LENS_FACING_FRONT).equals(
                    characteristics.get(CameraCharacteristics.LENS_FACING));
            Integer sensor = characteristics.get(CameraCharacteristics.SENSOR_ORIENTATION);
            int display = ((android.view.WindowManager) context.getSystemService(Context.WINDOW_SERVICE))
                    .getDefaultDisplay().getRotation() * 90;
            int rotation = ((sensor == null ? 0 : sensor) + (mirrored ? display : -display) + 360) % 360;
            StreamConfigurationMap map = characteristics
                    .get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            Size[] sizes = map == null ? null : map.getOutputSizes(ImageFormat.YUV_420_888);
            if (sizes == null) { fail(); return; }
            Size size = Arrays.stream(sizes).filter(s -> s.getWidth() <= 320 && s.getHeight() <= 240)
                    .max(Comparator.comparingInt(s -> s.getWidth() * s.getHeight())).orElse(null);
            if (size == null) { fail(); return; }
            reader = ImageReader.newInstance(size.getWidth(), size.getHeight(), ImageFormat.YUV_420_888, 2);
            reader.setOnImageAvailableListener(source -> {
                if (ticket != epoch) return;
                try (Image image = source.acquireLatestImage()) {
                    if (image == null) return;
                    handler.removeCallbacks(timeout); handler.postDelayed(timeout, 5000);
                    if (!announced) { announced = true; listener.live(); }
                    listener.frame(image, rotation, mirrored);
                } catch (IllegalStateException error) { if (ticket == epoch) fail(); }
            }, handler);
            handler.postDelayed(timeout, 5000);
            manager.openCamera(selected, new CameraDevice.StateCallback() {
                @Override public void onOpened(CameraDevice camera) {
                    if (ticket != epoch) { camera.close(); return; }
                    device = camera;
                    try {
                        camera.createCaptureSession(Collections.singletonList(reader.getSurface()),
                                new CameraCaptureSession.StateCallback() {
                            @Override public void onConfigured(CameraCaptureSession configured) {
                                if (ticket != epoch) { configured.close(); return; }
                                session = configured;
                                try {
                                    CaptureRequest.Builder request = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
                                    request.addTarget(reader.getSurface());
                                    configured.setRepeatingRequest(request.build(), null, handler);
                                } catch (CameraAccessException | IllegalStateException | IllegalArgumentException error) { fail(); }
                            }
                            @Override public void onConfigureFailed(CameraCaptureSession failed) {
                                failed.close(); if (ticket == epoch) fail();
                            }
                        }, handler);
                    } catch (CameraAccessException | IllegalStateException | IllegalArgumentException error) { fail(); }
                }
                @Override public void onDisconnected(CameraDevice camera) { camera.close(); if (ticket == epoch) fail(); }
                @Override public void onError(CameraDevice camera, int error) { camera.close(); if (ticket == epoch) fail(); }
            }, handler);
        } catch (CameraAccessException | SecurityException | IllegalArgumentException error) { fail(); }
    }
    private void fail() { close(); listener.failed(); }
    void close() {
        epoch++; announced = false; handler.removeCallbacks(timeout);
        if (session != null) { session.close(); session = null; }
        if (device != null) { device.close(); device = null; }
        if (reader != null) { reader.close(); reader = null; }
    }
}
