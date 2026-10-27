package com.discretesignage.display;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.GestureDetector;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.widget.ArrayAdapter;
import android.widget.Spinner;
import androidx.appcompat.app.AlertDialog;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.google.android.gms.tasks.Task;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FirebaseFirestoreException;
import com.google.firebase.firestore.FirebaseFirestoreSettings;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.MemoryCacheSettings;
import com.google.firebase.firestore.Source;
import com.google.firebase.functions.FirebaseFunctions;
import com.google.firebase.functions.FirebaseFunctionsException;
import com.google.firebase.functions.HttpsCallableResult;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class MainActivity extends AppCompatActivity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private FirebaseAuth auth;
    private FirebaseFirestore db;
    private FirebaseFunctions functions;
    private ListenerRegistration listener;
    private DocumentReference statusRef;
    private NativeScreen player;
    private MediaCache mediaCache;
    private final java.util.concurrent.ExecutorService cacheWorker = java.util.concurrent.Executors.newSingleThreadExecutor();
    private FrameLayout stage;
    private ProductOverlay productOverlay;
    private LinearLayout notice;
    private TextView message;
    private TextView connectionLabel;
    private Button retry;
    private Map<String, Object> pairing, config;
    private int epoch;
    private boolean foreground;
    private boolean rendered;
    private long version, deadline;
    private Runnable expire;
    private int recoveryAttempts;
    private LocalDisplaySettings localSettings;
    private GestureDetector gestures;
    private AlertDialog settingsDialog;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        mediaCache = new MediaCache(new java.io.File(getNoBackupFilesDir(), "playlist-media"));
        // Files survive restarts, but offline grants do not: always reauthorize.
        localSettings = new LocalDisplaySettings(getSharedPreferences("display-settings", MODE_PRIVATE));
        gestures = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDown(MotionEvent event) { return true; }
            @Override public void onLongPress(MotionEvent event) { openSettings(); }
        });
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_SECURE);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        FrameLayout root = new FrameLayout(this); root.setBackgroundColor(0xff081b16);
        stage = new FrameLayout(this);
        stage.setDescendantFocusability(android.view.ViewGroup.FOCUS_BLOCK_DESCENDANTS);
        root.addView(stage, new FrameLayout.LayoutParams(-1, -1));
        notice = new LinearLayout(this); notice.setOrientation(LinearLayout.VERTICAL); notice.setGravity(Gravity.CENTER);
        notice.setPadding(48, 32, 48, 32); notice.setBackgroundColor(0xff081b16);
        TextView title = new TextView(this); title.setText(R.string.app_name); title.setTextColor(0xffffffff); title.setTextSize(24);
        notice.addView(title);
        message = new TextView(this); message.setTextColor(0xffffffff); message.setTextSize(22); message.setGravity(Gravity.CENTER);
        message.setPadding(0, 24, 0, 24); notice.addView(message);
        retry = new Button(this); retry.setText("Retry connection"); retry.setOnClickListener(v -> restart()); notice.addView(retry);
        Button settings = new Button(this); settings.setText("Display settings");
        settings.setOnClickListener(v -> openSettings()); notice.addView(settings);
        TextView hint = new TextView(this); hint.setText("For settings during playback, hold the screen, hold OK on your remote, or press Menu.");
        hint.setTextColor(0xffffffff); hint.setGravity(Gravity.CENTER); notice.addView(hint);
        root.addView(notice, new FrameLayout.LayoutParams(-1, -1));
        connectionLabel = new TextView(this); connectionLabel.setTextColor(0xffffffff);
        connectionLabel.setBackgroundColor(0xbb081b16); connectionLabel.setPadding(12, 6, 12, 6);
        connectionLabel.setVisibility(View.GONE);
        root.addView(connectionLabel, new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.START));
        setContentView(root);
        try {
            if (FirebaseApp.initializeApp(this) == null) throw new IllegalStateException();
            AppVerification.install();
            auth = FirebaseAuth.getInstance(); functions = FirebaseFunctions.getInstance("australia-southeast1");
            db = FirebaseFirestore.getInstance();
            db.setFirestoreSettings(new FirebaseFirestoreSettings.Builder()
                    .setLocalCacheSettings(MemoryCacheSettings.newBuilder().build()).build());
        } catch (Exception error) { show("Firebase setup is missing. Contact your administrator.", false); return; }
        productOverlay = new ProductOverlay(this, root, functions);
        player = new NativeScreen(stage, new NativeScreen.Events() {
            @Override public void ready(boolean empty) {
                if (!foreground || SystemClock.elapsedRealtime() >= deadline) { clear(); return; }
                if (empty) show("Connected. Choose media in your business portal.", false);
                else notice.setVisibility(View.GONE);
                if (!empty && config != null && config.get("interactive") instanceof Map
                        && Boolean.TRUE.equals(((Map<?, ?>)config.get("interactive")).get("enabled"))) productOverlay.start();
                else productOverlay.stop();
                rendered = true;
                status("ready", version);
            }
            @Override public void played(String mediaId, int region) {
                if (foreground && SystemClock.elapsedRealtime() < deadline) {
                    Map<String, Object> event = new HashMap<>();
                    event.put("id", UUID.randomUUID().toString()); event.put("mediaId", mediaId); event.put("region", region);
                    event.put("version", version); event.put("startedAt", System.currentTimeMillis());
                    call("reportPlayback", Collections.singletonMap("events", Collections.singletonList(event)));
                }
            }
            @Override public void failed() { rendered = false; show("Could not play this media. Retrying authorization…", false); status("error", 0); }
        });
    }

    @Override protected void onResume() {
        super.onResume(); foreground = true;
        new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView()).hide(WindowInsetsCompat.Type.systemBars());
        if (player != null) restart();
    }
    @Override protected void onPause() {
        if (settingsDialog != null) settingsDialog.dismiss();
        foreground = false; epoch++; handler.removeCallbacksAndMessages(null);
        if (listener != null) listener.remove(); listener = null;
        clear(); statusRef = null; config = null;
        show("Reconnecting securely…", false);
        super.onPause();
    }
    @Override protected void onDestroy() { if (player != null) player.destroy(); cacheWorker.shutdownNow(); super.onDestroy(); }

    private boolean active(int ticket) { return foreground && ticket == epoch; }
    private void show(String text, boolean action) {
        if (productOverlay != null) productOverlay.stop();
        message.setText(text); retry.setVisibility(action ? View.VISIBLE : View.GONE); notice.setVisibility(View.VISIBLE);
    }
    private void clear() { if (productOverlay != null) productOverlay.stop(); deadline = 0; rendered = false; if (mediaCache != null) mediaCache.cancel(); if (player != null) player.stop(); if (connectionLabel != null) connectionLabel.setVisibility(View.GONE); }
    private void restart() {
        if (!foreground || player == null) return;
        epoch++; handler.removeCallbacksAndMessages(null); clear(); config = null;
        if (listener != null) listener.remove(); listener = null; statusRef = null;
        show("Connecting securely…", false);
        int ticket = epoch;
        if (auth.getCurrentUser() != null) restore(ticket);
        else if (pairing != null && number(pairing.get("expiresAt")) > System.currentTimeMillis()) poll(ticket);
        else begin(ticket);
    }
    private Task<HttpsCallableResult> call(String name, Map<String, Object> data) {
        return functions.getHttpsCallable(name).call(data);
    }
    @SuppressWarnings("unchecked") private Map<String, Object> data(HttpsCallableResult result) {
        return (Map<String, Object>) result.getData();
    }
    private static long number(Object value) { return value instanceof Number ? ((Number) value).longValue() : 0; }
    private void begin(int ticket) {
        call("beginPairing", Collections.emptyMap()).addOnCompleteListener(task -> {
            if (!active(ticket)) return;
            if (!task.isSuccessful()) {
                if (transientFailure(task.getException())) recover(ticket);
                else show("Could not create a pairing code. Check internet and App Check setup, then retry.", true);
                return;
            }
            pairing = data(task.getResult()); poll(ticket);
        });
    }
    private void poll(int ticket) {
        if (!active(ticket) || pairing == null) return;
        if (number(pairing.get("expiresAt")) <= System.currentTimeMillis()) {
            pairing = null; show("Your pairing code expired. Retry for a new code.", true); return;
        }
        show("In your business portal, choose Pair a display.\n\n" + pairing.get("code") + "\n\nThis code expires after ten minutes.", false);
        Map<String, Object> request = new HashMap<>(); request.put("code", pairing.get("code")); request.put("secret", pairing.get("secret"));
        call("completePairing", request).addOnCompleteListener(task -> {
            if (!active(ticket)) return;
            if (task.isSuccessful() && "ready".equals(data(task.getResult()).get("status"))) {
                String token = (String) data(task.getResult()).get("token"); pairing = null;
                auth.signInWithCustomToken(token).addOnCompleteListener(signIn -> {
                    if (!active(ticket)) return;
                    if (signIn.isSuccessful()) restore(ticket);
                    else show("Pairing could not finish. Retry for a new code.", true);
                });
            } else if (!task.isSuccessful() && denied(task.getException())) {
                pairing = null; show("Pairing ended. Retry for a new code.", true);
            } else handler.postDelayed(() -> poll(ticket), 5000);
        });
    }
    private void restore(int ticket) {
        if (auth.getCurrentUser() == null) { restart(); return; }
        String uid = auth.getCurrentUser().getUid();
        android.content.SharedPreferences cacheScope = getSharedPreferences("media-cache", MODE_PRIVATE);
        if (!uid.equals(cacheScope.getString("owner", null))) {
            mediaCache.clear(); cacheScope.edit().putString("owner", uid).apply();
        }
        auth.getCurrentUser().getIdToken(false).addOnCompleteListener(token -> {
            if (!active(ticket)) return;
            if (!token.isSuccessful()) {
                if (transientFailure(token.getException())) recover(ticket);
                else show("Could not restore access. Retry or contact your administrator.", true);
                return;
            }
            Map<String, Object> claims = token.getResult().getClaims();
            if (!Boolean.TRUE.equals(claims.get("device")) || !(claims.get("businessId") instanceof String)) { disconnect(); return; }
            String base = "businesses/" + claims.get("businessId");
            db.document(base + "/devices/" + uid).get(Source.SERVER).addOnCompleteListener(device -> {
                if (!active(ticket)) return;
                if (!device.isSuccessful()) {
                    if (denied(device.getException())) disconnect();
                    else recover(ticket);
                    return;
                }
                if (!Boolean.TRUE.equals(device.getResult().getBoolean("active"))) { disconnect(); return; }
                statusRef = db.document(base + "/deviceStatus/" + uid);
                String path = base + "/locations/" + device.getResult().getString("locationId")
                        + "/screens/" + device.getResult().getString("screenId");
                listener = db.document(path).addSnapshotListener((screen, error) -> {
                    if (!active(ticket)) return;
                    if (error != null) { if (denied(error)) disconnect(); else recover(ticket); return; }
                    if (screen == null || screen.getMetadata().isFromCache()) return;
                    if (!Boolean.TRUE.equals(screen.getBoolean("active"))) { disconnect(); return; }
                    long next = number(screen.get("version"));
                    if (config != null && version == next) return;
                    clear(); config = screen.getData(); version = next;
                    localSettings.bind(uid, next);
                    if (!PlaybackPolicy.supported(config)) {
                        show("This screen has unsupported settings. Update its layout in your portal.", false);
                        status("error", 0); return;
                    }
                    orientation((String) localSettings.apply(config).get("orientation"));
                    status("downloading", 0); refresh(ticket, next);
                });
            });
        });
    }
    @SuppressWarnings("unchecked") private void refresh(int ticket, long expected) {
        if (!active(ticket) || config == null || version != expected || !PlaybackPolicy.supported(config)) return;
        long started = SystemClock.elapsedRealtime();
        call("getScreenPlayback", Collections.singletonMap("downloadedPlayback", true)).addOnCompleteListener(task -> {
            if (!active(ticket) || version != expected) return;
            long delay = 15000;
            if (task.isSuccessful()) {
                try {
                    Map<String, Object> manifest = data(task.getResult());
                    if (number(manifest.get("version")) != expected) throw new IllegalStateException();
                    if (auth.getCurrentUser() == null || !auth.getCurrentUser().getUid().equals(manifest.get("deviceId")))
                        throw new IllegalStateException();
                    long remaining = PlaybackPolicy.offlineMillis(number(manifest.get("offlineExpiresAt")), number(manifest.get("serverNow")), SystemClock.elapsedRealtime() - started);
                    if (remaining <= 0) throw new IllegalStateException();
                    List<List<Map<String, Object>>> regions = (List<List<Map<String, Object>>>) manifest.get("regions");
                    Map<String, Object> logo = (Map<String, Object>) manifest.get("logo");
                    if (!PlaybackPolicy.manifest(regions, logo, config)) throw new IllegalStateException();
                    long until = SystemClock.elapsedRealtime() + remaining;
                    long cacheTicket = mediaCache.ticket();
                    if (!rendered) show("Downloading your playlist for local playback…", false);
                    cacheWorker.execute(() -> {
                        Map<String, Object> prepared = null;
                        try { prepared = mediaCache.prepare(manifest, cacheTicket); } catch (Exception ignored) { }
                        final Map<String, Object> local = prepared;
                        handler.post(() -> {
                            if (!active(ticket) || version != expected) return;
                            if (local != null && SystemClock.elapsedRealtime() < until) {
                                deadline = until;
                                connectionLabel.setVisibility(View.GONE);
                                if (expire != null) handler.removeCallbacks(expire);
                                expire = () -> { clear(); show("Offline playback time ended. Reconnect to continue.", false); status("error", 0); };
                                handler.postDelayed(expire, until - SystemClock.elapsedRealtime());
                                recoveryAttempts = 0;
                                player.update((List<List<Map<String, Object>>>) local.get("regions"),
                                        (Map<String, Object>) local.get("logo"), localSettings.apply(config), deadline);
                                mediaCache.retain(local);
                                status(rendered ? "ready" : "downloading", rendered ? version : 0);
                            } else if (!rendered) show("Download incomplete. Check connection and free storage. Retrying…", false);
                            handler.postDelayed(() -> refresh(ticket, expected), 20000);
                        });
                    });
                    return;
                } catch (Exception error) { clear(); show("Waiting for valid playback authorization…", false); status("error", 0); }
            } else if (denied(task.getException())) {
                mediaCache.clear(); clear(); show("Playback unavailable. Check the screen assignment and trial in your portal.", true); status("error", 0);
            } else if (rendered && SystemClock.elapsedRealtime() < deadline) {
                connectionLabel.setText("Offline · playing downloaded playlist"); connectionLabel.setVisibility(View.VISIBLE);
            }
            handler.postDelayed(() -> refresh(ticket, expected), delay);
        });
    }
    private void status(String state, long applied) {
        if (!foreground || statusRef == null) return;
        Map<String, Object> value = new HashMap<>(); value.put("state", state);
        value.put("appliedVersion", localSettings.overridden() ? 0 : applied); value.put("reportedAt", FieldValue.serverTimestamp());
        int ticket = epoch;
        statusRef.set(value).addOnFailureListener(error -> { if (active(ticket) && denied(error)) disconnect(); });
    }
    private void disconnect() {
        mediaCache.clear();
        epoch++; handler.removeCallbacksAndMessages(null); clear();
        if (listener != null) listener.remove(); listener = null;
        statusRef = null; config = null; pairing = null; localSettings.clear(); auth.signOut();
        show("Display access ended. Ask the owner to pair this screen again.", true);
    }
    private void recover(int ticket) {
        if (!active(ticket)) return;
        if (rendered && SystemClock.elapsedRealtime() < deadline) {
            if (listener != null) listener.remove(); listener = null;
            connectionLabel.setText("Offline · playing downloaded playlist"); connectionLabel.setVisibility(View.VISIBLE);
            long delay = Math.min(30000L, 5000L << Math.min(recoveryAttempts++, 3));
            handler.postDelayed(() -> { if (active(ticket)) restore(ticket); }, delay);
            return;
        }
        int recoveryTicket = ++epoch;
        clear(); config = null; statusRef = null;
        if (listener != null) listener.remove(); listener = null;
        handler.removeCallbacksAndMessages(null);
        show("Connection interrupted. Retrying automatically…", true);
        long delay = Math.min(30000L, 5000L << Math.min(recoveryAttempts++, 3));
        handler.postDelayed(() -> { if (active(recoveryTicket)) restart(); }, delay);
    }
    private static boolean transientFailure(Exception error) {
        if (error instanceof com.google.firebase.FirebaseNetworkException) return true;
        if (!(error instanceof FirebaseFunctionsException)) return false;
        FirebaseFunctionsException.Code code = ((FirebaseFunctionsException) error).getCode();
        return code == FirebaseFunctionsException.Code.UNAVAILABLE || code == FirebaseFunctionsException.Code.DEADLINE_EXCEEDED
                || code == FirebaseFunctionsException.Code.INTERNAL;
    }
    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        if (gestures != null) gestures.onTouchEvent(event);
        return super.dispatchTouchEvent(event);
    }
    @Override public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_MENU) { openSettings(); return true; }
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER && rendered && notice.getVisibility() == View.GONE) {
            if (event.getRepeatCount() == 0) event.startTracking();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
    @Override public boolean onKeyLongPress(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER && rendered && notice.getVisibility() == View.GONE) {
            openSettings();
            return true;
        }
        return super.onKeyLongPress(keyCode, event);
    }
    private Spinner choice(LinearLayout form, String label, String[] labels, int selected) {
        TextView text = new TextView(this); text.setText(label); form.addView(text);
        Spinner spinner = new Spinner(this); spinner.setContentDescription(label);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, labels);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinner.setAdapter(adapter); spinner.setSelection(selected); form.addView(spinner);
        return spinner;
    }
    private void openSettings() {
        if (!foreground || (settingsDialog != null && settingsDialog.isShowing())) return;
        LinearLayout form = new LinearLayout(this); form.setOrientation(LinearLayout.VERTICAL);
        int padding = Math.round(24 * getResources().getDisplayMetrics().density); form.setPadding(padding, padding, padding, padding);
        TextView help = new TextView(this);
        help.setText(config == null ? "Connect this display before adjusting it. You can retry the connection below."
                : "Adjust this device until the next portal change. Choose Follow portal to use the owner's settings. Local adjustments show as pending in the portal.");
        if (deadline > SystemClock.elapsedRealtime()) help.append("\nDownloaded playback is authorised for up to "
                + Math.max(1, (deadline - SystemClock.elapsedRealtime()) / 60000) + " more minutes. Reopening the app requires internet.");
        form.addView(help);
        Spinner orientation = choice(form, "Orientation", new String[]{"Follow portal", "Landscape", "Portrait", "Landscape reversed", "Portrait reversed"},
                localSettings.selected("orientation", LocalDisplaySettings.ORIENTATIONS));
        Spinner scale = choice(form, "Scale", new String[]{"Follow portal", "Fit · show everything", "Fill · crop edges", "Stretch / Fit XY"},
                localSettings.selected("scaleType", LocalDisplaySettings.SCALES));
        orientation.setEnabled(config != null); scale.setEnabled(config != null);
        Button startup = new Button(this);
        startup.setText(StartupSettings.selected(this) ? "Startup: Home app selected" : "Set up startup after reboot");
        startup.setOnClickListener(v -> {
            settingsDialog.dismiss();
            StartupSettings.show(this);
        });
        form.addView(startup);
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            Button interactive = new Button(this);
            interactive.setText("Interactive preview · developer only");
            interactive.setOnClickListener(v -> {
                settingsDialog.dismiss();
                startActivity(new android.content.Intent().setClassName(this,
                        "com.discretesignage.display.InteractivePreviewActivity"));
            });
            form.addView(interactive);
            Button products = new Button(this);
            products.setText("Product greeting preview · developer only");
            products.setOnClickListener(v -> {
                settingsDialog.dismiss();
                startActivity(new android.content.Intent().setClassName(this,
                        "com.discretesignage.display.ProductPreviewActivity"));
            });
            form.addView(products);
        }
        android.widget.ScrollView scroll = new android.widget.ScrollView(this); scroll.addView(form);
        settingsDialog = new AlertDialog.Builder(this).setTitle("Display settings").setView(scroll)
                .setNegativeButton("Cancel", null).setNeutralButton("Retry connection", (dialog, which) -> restart())
                .setPositiveButton("Apply", (dialog, which) -> {
                    if (config == null) return;
                    localSettings.save(orientation.getSelectedItemPosition(), scale.getSelectedItemPosition());
                    orientation((String) localSettings.apply(config).get("orientation")); restart();
                }).create();
        settingsDialog.show(); settingsDialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(config != null);
    }
    private static boolean denied(Exception error) {
        if (error instanceof FirebaseFunctionsException) {
            FirebaseFunctionsException.Code code = ((FirebaseFunctionsException) error).getCode();
            return code == FirebaseFunctionsException.Code.PERMISSION_DENIED || code == FirebaseFunctionsException.Code.UNAUTHENTICATED
                    || code == FirebaseFunctionsException.Code.FAILED_PRECONDITION;
        }
        return error instanceof FirebaseFirestoreException && ((FirebaseFirestoreException) error).getCode() == FirebaseFirestoreException.Code.PERMISSION_DENIED;
    }
    private void orientation(String value) {
        int target = "portrait".equals(value) ? ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                : "portrait-flipped".equals(value) ? ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
                : "landscape-flipped".equals(value) ? ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE;
        setRequestedOrientation(target);
    }
}
