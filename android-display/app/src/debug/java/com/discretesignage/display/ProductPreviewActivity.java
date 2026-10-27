package com.discretesignage.display;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Debug rehearsal using synthetic products, with no camera or paired playlist access. */
public final class ProductPreviewActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final AttractionSession session = new AttractionSession();
    private boolean nearby, robot = true;
    private final AvatarGaze gaze = new AvatarGaze();
    private int position = 1;
    private Button character, positionControl;
    private TextView status;
    private long started;
    private TextView advert, greeting, product;
    private LinearLayout overlay;
    private Button engage, presence;
    private AvatarPreviewView avatar;
    private AttractionSession.Stage rendered;
    private int shownAdvert = -1;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            long now = SystemClock.elapsedRealtime();
            if (now - started >= 120000) { finish(); return; }
            int index = (int)((now - started) / 6000 % 2);
            if (index != shownAdvert) {
                shownAdvert = index;
                advert.setText(index == 0 ? "SAMPLE ADVERT 1\n\nA little break.\nA fresh coffee."
                        : "SAMPLE ADVERT 2\n\nSomething cool.\nSomething refreshing.");
                advert.setBackgroundColor(index == 0 ? 0xff193d36 : 0xff24435e);
            }
            session.update(nearby, now); render();
            if (nearby && session.stage() != AttractionSession.Stage.ADVERTISING) {
                gaze.target(position == 0 ? .15f : position == 2 ? .85f : .5f, .5f);
                gaze.step();
            } else gaze.reset();
            avatar.look(gaze.x(), gaze.y());
            handler.postDelayed(this, 100);
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state); started = SystemClock.elapsedRealtime();
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(12),dp(12),dp(12),dp(12)); root.setBackgroundColor(0xfff4f5ee);
        setContentView(root);
        label(root, "Product interaction · developer preview", 20);
        label(root, "Sample adverts and prices · camera and microphone off", 13);
        FrameLayout screen = new FrameLayout(this);
        root.addView(screen,new LinearLayout.LayoutParams(-1,0,1));
        advert = new TextView(this); advert.setTextColor(0xffffffff); advert.setTextSize(28);
        advert.setGravity(Gravity.CENTER); advert.setPadding(dp(20),dp(20),dp(20),dp(180));
        screen.addView(advert,new FrameLayout.LayoutParams(-1,-1));
        overlay = new LinearLayout(this); overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setGravity(Gravity.CENTER); overlay.setPadding(dp(10),dp(8),dp(10),dp(8));
        overlay.setBackgroundColor(0xffeef7f8);
        FrameLayout.LayoutParams corner = new FrameLayout.LayoutParams(dp(240),-2,Gravity.BOTTOM|Gravity.END);
        screen.addView(overlay,corner);
        avatar = new AvatarPreviewView(this); avatar.setRobot(true);
        overlay.addView(avatar,new LinearLayout.LayoutParams(dp(80),dp(80)));
        greeting = label(overlay,"Hi! Want to explore iced coffee?",16);
        product = label(overlay,"SAMPLE PRODUCT\nIced coffee · AUD $5.00\nA cool coffee break.\nAsk at the counter.",16);
        engage = button(overlay,"Simulate wave-back / select",() -> { if (session.engage(SystemClock.elapsedRealtime())) render(); });
        button(overlay,"No thanks / close",() -> { session.end(SystemClock.elapsedRealtime()); render(); });
        presence = button(root,"Simulate someone nearby",() -> {
            nearby = !nearby;
            presence.setText(nearby ? "Simulate visitor leaving" : "Simulate someone nearby");
            session.update(nearby,SystemClock.elapsedRealtime()); render();
        });
        LinearLayout controls = new LinearLayout(this); controls.setOrientation(LinearLayout.HORIZONTAL);
        root.addView(controls);
        character = button(controls,"Avatar: Robot",() -> {
            robot = !robot; avatar.setRobot(robot);
            character.setText(robot ? "Avatar: Robot" : "Avatar: Cat");
            if (session.stage() == AttractionSession.Stage.GREETING) avatar.wave();
        });
        positionControl = button(controls,"Position: Centre",() -> {
            position = (position + 1) % 3;
            positionControl.setText("Position: " + new String[]{"Left","Centre","Right"}[position]);
        });
        character.setLayoutParams(new LinearLayout.LayoutParams(0,-2,1));
        positionControl.setLayoutParams(new LinearLayout.LayoutParams(0,-2,1));
        status = label(root,"",13);
        label(root,"Arrival takes 2 seconds. To greet again, leave for 2 seconds and allow the 30-second cooldown. Preview closes after 2 minutes.",13);
        button(root,"Return to display",this::finish);
        render();
    }
    private void render() {
        AttractionSession.Stage stage = session.stage();
        status.setText(stage == AttractionSession.Stage.GREETING ? "Greeting · simulate a wave-back or select to explore"
                : stage == AttractionSession.Stage.PRODUCT ? "Featured product · sample adverts keep rotating"
                : nearby ? "Visitor present · waiting for arrival dwell or a new visit after cooldown"
                : "No visitor · sample adverts keep rotating");
        overlay.setVisibility(stage == AttractionSession.Stage.ADVERTISING ? View.GONE : View.VISIBLE);
        greeting.setVisibility(stage == AttractionSession.Stage.GREETING ? View.VISIBLE : View.GONE);
        engage.setVisibility(stage == AttractionSession.Stage.GREETING ? View.VISIBLE : View.GONE);
        product.setVisibility(stage == AttractionSession.Stage.PRODUCT ? View.VISIBLE : View.GONE);
        if (stage != rendered) {
            avatar.reset();
            if (stage == AttractionSession.Stage.GREETING) avatar.wave();
            rendered = stage;
        }
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView label(LinearLayout parent,String text,int size) {
        TextView view = new TextView(this); view.setText(text); view.setTextSize(size);
        view.setTextColor(0xff193d36); view.setGravity(Gravity.CENTER); parent.addView(view); return view;
    }
    private Button button(LinearLayout parent,String title,Runnable action) {
        Button button = new Button(this); button.setText(title); button.setOnClickListener(v -> action.run());
        parent.addView(button); return button;
    }
    @Override protected void onResume() { super.onResume(); handler.post(tick); }
    @Override protected void onPause() {
        handler.removeCallbacksAndMessages(null); gaze.reset(); avatar.reset(); nearby = false;
        session.end(SystemClock.elapsedRealtime()); super.onPause(); finish();
    }
}
