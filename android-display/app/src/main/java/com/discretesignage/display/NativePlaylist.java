package com.discretesignage.display;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** Only current media is decoded. No signed URLs or media bytes are persisted. */
@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
final class NativePlaylist {
    interface Events { void ready(String mediaId); void failed(); }
    private final FrameLayout stage;
    private final Events events;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService downloads = new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(1), new ThreadPoolExecutor.DiscardOldestPolicy());
    private List<Map<String, Object>> items;
    private Map<String, Object> config;
    private long deadline;
    private int generation, index;
    private String identity = "";
    private ExoPlayer video;
    private Bitmap bitmap;

    NativePlaylist(FrameLayout stage, Events events) { this.stage = stage; this.events = events; }

    @SuppressWarnings("unchecked")
    void update(List<Map<String, Object>> next, Map<String, Object> settings, long until) {
        StringBuilder key = new StringBuilder();
        for (Map<String, Object> item : next) {
            Map<String, Object> asset = (Map<String, Object>) item.get("asset");
            if (asset == null || !PlaybackPolicy.mediaUrl(String.valueOf(asset.get("url"))))
                throw new IllegalArgumentException("Invalid media URL");
            key.append(asset.get("id")).append(':').append(asset.get("generation"))
                    .append(':').append(item.get("duration")).append(';');
        }
        boolean changed = !identity.equals(key.toString()) || items == null;
        items = next; config = settings; deadline = until;
        if (changed) { clearContent(); identity = key.toString(); index = 0; show(); }
    }

    @SuppressWarnings("unchecked")
    private void show() {
        clearContent();
        if (SystemClock.elapsedRealtime() >= deadline || items == null) return;
        if (items.isEmpty()) { events.ready(null); return; }
        final int ticket = generation;
        Map<String, Object> item = items.get(index % items.size());
        Map<String, Object> asset = (Map<String, Object>) item.get("asset");
        String url = (String) asset.get("url"), id = (String) asset.get("id");
        String type = (String) asset.get("contentType");
        String scale = (String) config.get("scaleType");
        if ("video/mp4".equals(type)) {
            PlayerView view = new PlayerView(stage.getContext());
            view.setUseController(false);
            view.setResizeMode("fill".equals(scale) ? AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    : "stretch".equals(scale) ? AspectRatioFrameLayout.RESIZE_MODE_FILL : AspectRatioFrameLayout.RESIZE_MODE_FIT);
            video = new ExoPlayer.Builder(stage.getContext()).build();
            video.setVolume(0);
            video.setRepeatMode(items.size() == 1 ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
            view.setPlayer(video); stage.addView(view, full());
            video.addListener(new Player.Listener() {
                private boolean reported;
                @Override public void onRenderedFirstFrame() {
                    if (!active(ticket)) return;
                    if (!reported) { reported = true; reveal(view); events.ready(id); }
                }
                @Override public void onPlaybackStateChanged(int state) {
                    if (state == Player.STATE_ENDED && active(ticket)) advance();
                }
                @Override public void onPlayerError(PlaybackException error) { if (active(ticket)) fail(); }
            });
            video.setMediaItem(MediaItem.fromUri(url)); video.prepare(); video.play();
            handler.postDelayed(() -> { if (active(ticket) && video != null && video.getPlaybackState() != Player.STATE_READY) fail(); }, 20000);
        } else if ("image/webp".equals(type)) {
            int width = Math.max(1, stage.getWidth()), height = Math.max(1, stage.getHeight());
            downloads.execute(() -> {
                Bitmap decoded = null;
                try { decoded = image(url, width, height); } catch (Exception ignored) { }
                Bitmap result = decoded;
                new Handler(Looper.getMainLooper()).post(() -> {
                    if (!active(ticket)) { if (result != null) result.recycle(); return; }
                    if (result == null) { fail(); return; }
                    bitmap = result;
                    ImageView view = new ImageView(stage.getContext());
                    view.setScaleType("fill".equals(scale) ? ImageView.ScaleType.CENTER_CROP
                            : "stretch".equals(scale) ? ImageView.ScaleType.FIT_XY : ImageView.ScaleType.FIT_CENTER);
                    view.setImageBitmap(bitmap); stage.addView(view, full()); reveal(view); events.ready(id);
                    if (items.size() > 1) handler.postDelayed(() -> { if (active(ticket)) advance(); },
                            Math.max(3000, Math.min(300000, ((Number) item.get("duration")).longValue() * 1000)));
                });
            });
        } else fail();
    }

    private boolean active(int ticket) { return ticket == generation && items != null && SystemClock.elapsedRealtime() < deadline; }
    private void advance() { index = (index + 1) % items.size(); show(); }
    private void reveal(View view) {
        if ("fade".equals(config.getOrDefault("transition", "fade"))) {
            view.setAlpha(0); view.animate().alpha(1).setDuration(250).start();
        }
    }
    private FrameLayout.LayoutParams full() { return new FrameLayout.LayoutParams(-1, -1); }
    private void fail() { stop(); events.failed(); }
    private void clearContent() {
        generation++; handler.removeCallbacksAndMessages(null);
        if (video != null) { video.release(); video = null; }
        stage.removeAllViews();
        if (bitmap != null) { bitmap.recycle(); bitmap = null; }
    }
    void stop() { clearContent(); items = null; identity = ""; deadline = 0; }
    void destroy() { stop(); downloads.shutdownNow(); }

    private static Bitmap image(String url, int width, int height) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(10000); connection.setReadTimeout(10000);
        connection.setUseCaches(false);
        try {
            if (connection.getResponseCode() != 200 || connection.getContentLengthLong() > 20 * 1024 * 1024) throw new Exception();
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[16384]; int count;
                while ((count = input.read(buffer)) != -1) {
                    if (bytes.size() + count > 20 * 1024 * 1024) throw new Exception();
                    bytes.write(buffer, 0, count);
                }
            }
            byte[] data = bytes.toByteArray();
            BitmapFactory.Options options = new BitmapFactory.Options(); options.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(data, 0, data.length, options);
            if (options.outWidth < 1 || options.outHeight < 1 || options.outWidth > 8192 || options.outHeight > 8192
                    || (long) options.outWidth * options.outHeight > 16777216) throw new Exception();
            options.inJustDecodeBounds = false; options.inSampleSize = 1;
            while (options.outWidth / (options.inSampleSize * 2) >= width && options.outHeight / (options.inSampleSize * 2) >= height)
                options.inSampleSize *= 2;
            return BitmapFactory.decodeByteArray(data, 0, data.length, options);
        } finally { connection.disconnect(); }
    }
}
