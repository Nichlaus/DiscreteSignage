package com.discretesignage.display;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.google.firebase.functions.FirebaseFunctions;
import java.util.Collections;
import java.util.Locale;
import java.util.Map;

/** Product overlay with optional local debug input; never persists offers. */
final class ProductOverlay {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final LinearLayout panel;
    private final TextView text;
    private final Button open;
    private final AvatarPreviewView avatar;
    private final FirebaseFunctions functions;
    private ProductOffer offer;
    private final PresenceInput presence = new PresenceInput();
    private AttractionSession attraction = new AttractionSession();
    private final TextView cameraNotice;
    private final Activity activity;
    private boolean presenceMode;
    private long lastPresence = -1, presenceDeadline;
    private AttractionSession.Stage lastStage = AttractionSession.Stage.ADVERTISING;
    private boolean running, expanded;
    private int epoch;
    private long closeAt, cooldownUntil;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!running) return;
            long now = SystemClock.elapsedRealtime();
            if (offer != null && now >= offer.deadline) offer = null;
            if (presenceMode && now >= presenceDeadline) stopPresence();
            if (presenceMode) {
                if (offer == null) { stopPresence(); panel.setVisibility(View.GONE); }
                else {
                    attraction.update(lastPresence >= 0 && now - lastPresence <= 500, now);
                    expanded = attraction.stage() == AttractionSession.Stage.PRODUCT;
                    if (attraction.stage() != lastStage) {
                        if (attraction.stage() == AttractionSession.Stage.GREETING) avatar.wave();
                        lastStage = attraction.stage();
                    }
                    render(); handler.postDelayed(this,100); return;
                }
            }
            if (expanded && (offer == null || now >= closeAt)) dismiss();
            panel.setVisibility(offer != null && now >= cooldownUntil ? View.VISIBLE : View.GONE);
            handler.postDelayed(this,100);
        }
    };
    ProductOverlay(Activity activity, FrameLayout root, FirebaseFunctions functions) {
        this.functions = functions; this.activity = activity;
        cameraNotice = new TextView(activity); cameraNotice.setText("Local camera mode · body detection · no recording");
        cameraNotice.setTextColor(0xffffffff); cameraNotice.setBackgroundColor(0xdd193d36); cameraNotice.setPadding(10,6,10,6);
        cameraNotice.setVisibility(View.GONE);
        root.addView(cameraNotice,new FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.START));
        panel = new LinearLayout(activity); panel.setOrientation(LinearLayout.VERTICAL); panel.setGravity(Gravity.CENTER);
        panel.setPadding(12,8,12,8); panel.setBackgroundColor(0xf2eef7f8); panel.setVisibility(View.GONE);
        int width = Math.min((int)(240 * activity.getResources().getDisplayMetrics().density), activity.getResources().getDisplayMetrics().widthPixels);
        root.addView(panel,new FrameLayout.LayoutParams(width,-2,Gravity.BOTTOM|Gravity.END));
        avatar = new AvatarPreviewView(activity); avatar.setRobot(true);
        int size = (int)(60 * activity.getResources().getDisplayMetrics().density);
        panel.addView(avatar,new LinearLayout.LayoutParams(size,size));
        text = new TextView(activity); text.setTextColor(0xff193d36); text.setTextSize(16); panel.addView(text);
        open = new Button(activity); open.setText("Explore a featured product"); panel.addView(open);
        open.setOnClickListener(v -> {
            if (offer == null || SystemClock.elapsedRealtime() >= offer.deadline) { offer = null; panel.setVisibility(View.GONE); return; }
            if (presenceMode && !attraction.engage(SystemClock.elapsedRealtime())) return;
            expanded = true; closeAt = SystemClock.elapsedRealtime() + 20000; render();
        });
        Button close = new Button(activity); close.setText("No thanks / close"); close.setOnClickListener(v -> dismiss()); panel.addView(close);
    }
    void start(Object character) {
        if (running) return;
        avatar.setRobot(!"cat".equals(character));
        running = true; int ticket = ++epoch; handler.post(tick); fetch(ticket);
    }
    private void fetch(int ticket) {
        long started = SystemClock.elapsedRealtime();
        functions.getHttpsCallable("getScreenFeaturedProduct").call(Collections.emptyMap()).addOnCompleteListener(task -> {
            if (!running || ticket != epoch) return;
            ProductOffer next = null;
            if (task.isSuccessful() && task.getResult().getData() instanceof Map) {
                next = ProductOffer.read((Map<?, ?>)task.getResult().getData(),started,SystemClock.elapsedRealtime());
            }
            if (next == null) stopPresence();
            if (next == null || offer == null || next.version != offer.version) {
                expanded = false; attraction.end(SystemClock.elapsedRealtime());
            }
            offer = next; render(); handler.postDelayed(() -> fetch(ticket),20000);
        });
    }
    private void render() {
        if (offer == null || SystemClock.elapsedRealtime() >= offer.deadline) { panel.setVisibility(View.GONE); return; }
        if (presenceMode && attraction.stage() == AttractionSession.Stage.ADVERTISING) { panel.setVisibility(View.GONE); return; }
        open.setText(presenceMode ? "Wave back or select to explore" : "Explore a featured product");
        open.setVisibility(expanded ? View.GONE : View.VISIBLE);
        text.setVisibility(expanded || presenceMode ? View.VISIBLE : View.GONE);
        text.setText(expanded ? offer.name + "\n" + offer.description + "\n" + String.format(Locale.US,"AUD $%.2f",offer.cents / 100.0) : presenceMode ? "Hi! Want to explore " + offer.name + "?" : "");
        panel.setVisibility(SystemClock.elapsedRealtime() >= cooldownUntil ? View.VISIBLE : View.GONE);
    }
    private void dismiss() { attraction.end(SystemClock.elapsedRealtime()); expanded = false; cooldownUntil = SystemClock.elapsedRealtime() + 30000; avatar.reset(); render(); }
    boolean startPresence() {
        if (!running || offer == null || SystemClock.elapsedRealtime() >= offer.deadline) return false;
        stopPresence(); attraction = new AttractionSession(); presenceMode = true; lastPresence = -1; presenceDeadline = SystemClock.elapsedRealtime() + 120000;
        cameraNotice.setVisibility(View.VISIBLE); panel.setVisibility(View.GONE);
        boolean started = presence.start(activity, new PresenceInput.Listener() {
            @Override public void sample(boolean present, boolean wave) {
                if (!running || !presenceMode) return;
                long now = SystemClock.elapsedRealtime(); lastPresence = present ? now : -1;
                if (wave && offer != null && now < offer.deadline && attraction.engage(now)) {
                    expanded = true; closeAt = now + 20000; render();
                }
            }
            @Override public void failed() {
                stopPresence(); panel.setVisibility(View.GONE);
                android.widget.Toast.makeText(activity,"Camera unavailable. Adverts will continue.",android.widget.Toast.LENGTH_LONG).show();
            }
        });
        if (!started) stopPresence();
        return started;
    }
    void stopPresence() {
        presence.stop(); presenceMode = false; lastPresence = -1; expanded = false;
        attraction.end(SystemClock.elapsedRealtime()); lastStage = AttractionSession.Stage.ADVERTISING;
        cameraNotice.setVisibility(View.GONE); avatar.reset(); render();
    }
    void stop() { stopPresence(); running = false; epoch++; handler.removeCallbacksAndMessages(null); offer = null; expanded = false; panel.setVisibility(View.GONE); avatar.reset(); }
}
