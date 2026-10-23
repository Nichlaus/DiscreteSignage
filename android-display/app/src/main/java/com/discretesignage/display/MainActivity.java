package com.discretesignage.display;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
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
    private NativePlaylist player;
    private FrameLayout stage;
    private LinearLayout notice;
    private TextView message;
    private Button retry;
    private Map<String, Object> pairing, config;
    private int epoch;
    private boolean foreground;
    private boolean rendered;
    private long version, deadline;
    private Runnable expire;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_SECURE);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        FrameLayout root = new FrameLayout(this); root.setBackgroundColor(0xff081b16);
        stage = new FrameLayout(this); root.addView(stage, new FrameLayout.LayoutParams(-1, -1));
        notice = new LinearLayout(this); notice.setOrientation(LinearLayout.VERTICAL); notice.setGravity(Gravity.CENTER);
        notice.setPadding(48, 32, 48, 32); notice.setBackgroundColor(0xff081b16);
        TextView title = new TextView(this); title.setText(R.string.app_name); title.setTextColor(0xffffffff); title.setTextSize(24);
        notice.addView(title);
        message = new TextView(this); message.setTextColor(0xffffffff); message.setTextSize(22); message.setGravity(Gravity.CENTER);
        message.setPadding(0, 24, 0, 24); notice.addView(message);
        retry = new Button(this); retry.setText("Retry connection"); retry.setOnClickListener(v -> restart()); notice.addView(retry);
        root.addView(notice, new FrameLayout.LayoutParams(-1, -1)); setContentView(root);
        try {
            if (FirebaseApp.initializeApp(this) == null) throw new IllegalStateException();
            AppVerification.install();
            auth = FirebaseAuth.getInstance(); functions = FirebaseFunctions.getInstance("australia-southeast1");
            db = FirebaseFirestore.getInstance();
            db.setFirestoreSettings(new FirebaseFirestoreSettings.Builder()
                    .setLocalCacheSettings(MemoryCacheSettings.newBuilder().build()).build());
        } catch (Exception error) { show("Firebase setup is missing. Contact your administrator.", false); return; }
        player = new NativePlaylist(stage, new NativePlaylist.Events() {
            @Override public void ready(String mediaId) {
                if (!foreground || SystemClock.elapsedRealtime() >= deadline) { clear(); return; }
                if (mediaId == null) show("Connected. Choose media in your business portal.", false);
                else notice.setVisibility(View.GONE);
                rendered = true;
                status("ready", version);
                if (mediaId != null) {
                    Map<String, Object> event = new HashMap<>();
                    event.put("id", UUID.randomUUID().toString()); event.put("mediaId", mediaId); event.put("region", 0);
                    event.put("version", version); event.put("startedAt", System.currentTimeMillis());
                    call("reportPlayback", Collections.singletonMap("events", Collections.singletonList(event)));
                }
            }
            @Override public void failed() { rendered = false; show("Could not play this media. Retrying authorization…", false); status("error", 0); }
        });
    }

    @Override protected void onStart() {
        super.onStart(); foreground = true;
        new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView()).hide(WindowInsetsCompat.Type.systemBars());
        if (player != null) restart();
    }
    @Override protected void onStop() {
        foreground = false; epoch++; handler.removeCallbacksAndMessages(null);
        if (listener != null) listener.remove(); listener = null;
        clear(); statusRef = null; config = null;
        show("Reconnecting securely…", false);
        super.onStop();
    }
    @Override protected void onDestroy() { if (player != null) player.destroy(); super.onDestroy(); }

    private boolean active(int ticket) { return foreground && ticket == epoch; }
    private void show(String text, boolean action) {
        message.setText(text); retry.setVisibility(action ? View.VISIBLE : View.GONE); notice.setVisibility(View.VISIBLE);
    }
    private void clear() { deadline = 0; rendered = false; if (player != null) player.stop(); }
    private void restart() {
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
            if (!task.isSuccessful()) { show("Could not create a pairing code. Check internet and the emulator’s App Check registration, then retry.", true); return; }
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
        auth.getCurrentUser().getIdToken(false).addOnCompleteListener(token -> {
            if (!active(ticket)) return;
            if (!token.isSuccessful()) { show("Could not restore access. Check your connection and retry.", true); return; }
            Map<String, Object> claims = token.getResult().getClaims();
            if (!Boolean.TRUE.equals(claims.get("device")) || !(claims.get("businessId") instanceof String)) { disconnect(); return; }
            String base = "businesses/" + claims.get("businessId");
            db.document(base + "/devices/" + uid).get(Source.SERVER).addOnCompleteListener(device -> {
                if (!active(ticket)) return;
                if (!device.isSuccessful()) {
                    if (denied(device.getException())) disconnect();
                    else show("Could not verify this screen. Check your connection and retry.", true);
                    return;
                }
                if (!Boolean.TRUE.equals(device.getResult().getBoolean("active"))) { disconnect(); return; }
                statusRef = db.document(base + "/deviceStatus/" + uid);
                String path = base + "/locations/" + device.getResult().getString("locationId")
                        + "/screens/" + device.getResult().getString("screenId");
                listener = db.document(path).addSnapshotListener((screen, error) -> {
                    if (!active(ticket)) return;
                    if (error != null) { disconnect(); return; }
                    if (screen == null || screen.getMetadata().isFromCache()) return;
                    if (!Boolean.TRUE.equals(screen.getBoolean("active"))) { disconnect(); return; }
                    long next = number(screen.get("version"));
                    if (config != null && version == next) return;
                    clear(); config = screen.getData(); version = next;
                    if (!PlaybackPolicy.supported(config)) {
                        show("This Android preview supports one playlist, no logo, and Fade or None transitions. Update this screen in your portal.", false);
                        status("error", 0); return;
                    }
                    orientation((String) config.get("orientation"));
                    status("downloading", 0); refresh(ticket, next);
                });
            });
        });
    }
    @SuppressWarnings("unchecked") private void refresh(int ticket, long expected) {
        if (!active(ticket) || config == null || version != expected || !PlaybackPolicy.supported(config)) return;
        long started = SystemClock.elapsedRealtime();
        call("getScreenPlayback", Collections.emptyMap()).addOnCompleteListener(task -> {
            if (!active(ticket) || version != expected) return;
            long delay = 15000;
            if (task.isSuccessful()) {
                try {
                    Map<String, Object> manifest = data(task.getResult());
                    if (number(manifest.get("version")) != expected) throw new IllegalStateException();
                    long remaining = PlaybackPolicy.leaseMillis(number(manifest.get("expiresAt")), System.currentTimeMillis(), SystemClock.elapsedRealtime() - started);
                    if (remaining <= 0) throw new IllegalStateException();
                    List<List<Map<String, Object>>> regions = (List<List<Map<String, Object>>>) manifest.get("regions");
                    if (regions.size() != 1 || manifest.get("logo") != null) throw new IllegalStateException();
                    deadline = SystemClock.elapsedRealtime() + remaining;
                    if (expire != null) handler.removeCallbacks(expire);
                    expire = () -> { clear(); show("Playback authorization expired. Reconnecting…", false); status("error", 0); };
                    handler.postDelayed(expire, remaining);
                    player.update(regions.get(0), config, deadline);
                    status(rendered ? "ready" : "downloading", rendered ? version : 0);
                    delay = Math.min(20000, Math.max(1000, remaining / 2));
                } catch (Exception error) { clear(); show("Waiting for valid playback authorization…", false); status("error", 0); }
            } else if (denied(task.getException())) {
                clear(); show("Playback unavailable. Check the screen assignment and trial in your portal.", true); status("error", 0);
            }
            handler.postDelayed(() -> refresh(ticket, expected), delay);
        });
    }
    private void status(String state, long applied) {
        if (!foreground || statusRef == null) return;
        Map<String, Object> value = new HashMap<>(); value.put("state", state);
        value.put("appliedVersion", applied); value.put("reportedAt", FieldValue.serverTimestamp());
        int ticket = epoch;
        statusRef.set(value).addOnFailureListener(error -> { if (active(ticket) && denied(error)) disconnect(); });
    }
    private void disconnect() {
        epoch++; handler.removeCallbacksAndMessages(null); clear();
        if (listener != null) listener.remove(); listener = null;
        statusRef = null; config = null; pairing = null; auth.signOut();
        show("Display access ended. Ask the owner to pair this screen again.", true);
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
