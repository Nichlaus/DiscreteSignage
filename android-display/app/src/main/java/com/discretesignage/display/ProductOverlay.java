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

/** Optional touch/remote overlay. Never captures sensors or persists offers. */
final class ProductOverlay {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final LinearLayout panel;
    private final TextView text;
    private final Button open;
    private final AvatarPreviewView avatar;
    private final FirebaseFunctions functions;
    private ProductOffer offer;
    private boolean running, expanded;
    private int epoch;
    private long closeAt, cooldownUntil;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!running) return;
            long now = SystemClock.elapsedRealtime();
            if (offer != null && now >= offer.deadline) offer = null;
            if (expanded && (offer == null || now >= closeAt)) dismiss();
            panel.setVisibility(offer != null && now >= cooldownUntil ? View.VISIBLE : View.GONE);
            handler.postDelayed(this,100);
        }
    };
    ProductOverlay(Activity activity, FrameLayout root, FirebaseFunctions functions) {
        this.functions = functions;
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
            expanded = true; closeAt = SystemClock.elapsedRealtime() + 20000; render();
        });
        Button close = new Button(activity); close.setText("No thanks / close"); close.setOnClickListener(v -> dismiss()); panel.addView(close);
    }
    void start() {
        if (running) return;
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
            if (next == null || offer == null || next.version != offer.version) expanded = false;
            offer = next; render(); handler.postDelayed(() -> fetch(ticket),20000);
        });
    }
    private void render() {
        if (offer == null || SystemClock.elapsedRealtime() >= offer.deadline) { panel.setVisibility(View.GONE); return; }
        open.setVisibility(expanded ? View.GONE : View.VISIBLE);
        text.setVisibility(expanded ? View.VISIBLE : View.GONE);
        text.setText(expanded ? offer.name + "\n" + offer.description + "\n" + String.format(Locale.US,"AUD $%.2f",offer.cents / 100.0) : "");
        panel.setVisibility(SystemClock.elapsedRealtime() >= cooldownUntil ? View.VISIBLE : View.GONE);
    }
    private void dismiss() { expanded = false; cooldownUntil = SystemClock.elapsedRealtime() + 30000; avatar.reset(); render(); }
    void stop() { running = false; epoch++; handler.removeCallbacksAndMessages(null); offer = null; expanded = false; panel.setVisibility(View.GONE); avatar.reset(); }
}
