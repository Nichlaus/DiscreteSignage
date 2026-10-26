package com.discretesignage.display;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;

/** Native interaction rehearsal; optional local camera probe, no storage or provider calls. */
public final class InteractivePreviewActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable expire = this::finish;
    private final List<Button> answers = new ArrayList<>();
    private TextView feedback;
    private CatPreviewView cat;
    private CameraProbe camera;
    private TextView cameraStatus;
    private boolean permissionPending;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        int gap = Math.round(16 * getResources().getDisplayMetrics().density);
        content.setPadding(gap, gap, gap, gap);
        content.setBackgroundColor(0xfff4f5ee);
        scroll.addView(content); setContentView(scroll);
        text(content, "Interactive preview", 25);
        text(content, "Developer simulation · Microphone off · Gestures not connected", 14);
        text(content, "Touch or use your remote. No visitor data is recorded. Ends after 30 seconds without input.", 14);
        cameraStatus = text(content, "Camera off", 16);
        cameraStatus.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        camera = new CameraProbe(this, new CameraProbe.Listener() {
            @Override public void live() { cameraStatus.setText("Camera on · local frames only · no recording"); }
            @Override public void failed() {
                android.widget.Toast.makeText(InteractivePreviewActivity.this,
                        "Camera unavailable. Returning to display.", android.widget.Toast.LENGTH_LONG).show();
                finish();
            }
        });
        button(content, "Enable local camera", () -> {
            if (permissionPending) return;
            if (checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                permissionPending = true;
                requestPermissions(new String[]{android.Manifest.permission.CAMERA}, 41);
            } else { cameraStatus.setText("Starting camera… No recording or uploads."); camera.start(); }
        });
        button(content, "Stop camera", () -> { camera.close(); cameraStatus.setText("Camera off"); });
        cat = new CatPreviewView(this);
        content.addView(cat, new LinearLayout.LayoutParams(gap * 15, gap * 12));
        button(content, "Simulate wave", () -> cat.wave());
        text(content, "Which mountain is tallest above sea level?", 21);
        feedback = text(content, "Choose an answer using touch or D-pad and OK.", 16);
        feedback.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        GridLayout grid = new GridLayout(this); grid.setColumnCount(3); grid.setRowCount(3);
        content.addView(grid, new LinearLayout.LayoutParams(-1, -2));
        String[] labels = {"Top: Kilimanjaro", "Left: K2", "Centre: Everest", "Right: Mont Blanc", "Bottom: Fuji"};
        int[][] positions = {{0,1},{1,0},{1,1},{1,2},{2,1}};
        for (int i = 0; i < labels.length; i++) {
            final int answer = i;
            Button option = new Button(this); option.setText(labels[i]);
            option.setTextSize(12); option.setMinWidth(0);
            GridLayout.LayoutParams params = new GridLayout.LayoutParams(
                    GridLayout.spec(positions[i][0]), GridLayout.spec(positions[i][1], 1f));
            params.width = 0; params.height = gap * 5;
            grid.addView(option, params); answers.add(option);
            option.setOnFocusChangeListener((v, focused) -> {
                if (focused) cat.look(positions[answer][1] - 1, positions[answer][0] - 1);
            });
            option.setOnClickListener(v -> {
                for (Button item : answers) item.setEnabled(false);
                feedback.setText(answer == 2 ? "Correct! Everest is tallest above sea level."
                        : "Good try! The answer is Everest.");
                if (answer == 2) cat.wave();
            });
        }
        button(content, "Start over", () -> {
            for (Button item : answers) item.setEnabled(true);
            feedback.setText("Choose an answer using touch or D-pad and OK."); cat.reset();
        });
        button(content, "Return to display", this::finish);
    }

    private TextView text(LinearLayout parent, String value, int size) {
        TextView view = new TextView(this); view.setText(value); view.setTextSize(size);
        view.setTextColor(0xff193d36); view.setGravity(Gravity.CENTER); parent.addView(view); return view;
    }
    private void button(LinearLayout parent, String label, Runnable action) {
        Button button = new Button(this); button.setText(label);
        button.setOnClickListener(v -> action.run()); parent.addView(button);
    }
    @Override public void onUserInteraction() {
        super.onUserInteraction(); handler.removeCallbacks(expire); handler.postDelayed(expire, 30000);
    }
    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        if (cat != null) cat.look(event.getX() / Math.max(1, getWindow().getDecorView().getWidth()) * 2 - 1, 0);
        return super.dispatchTouchEvent(event);
    }
    @Override protected void onResume() { super.onResume(); onUserInteraction(); }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(code, permissions, grants);
        if (code != 41) return;
        permissionPending = false;
        if (grants.length == 0 || grants[0] != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            finish(); return;
        }
        cameraStatus.setText("Camera off · permission granted. Select Enable local camera to start.");
    }
    @Override protected void onPause() {
        handler.removeCallbacksAndMessages(null); cat.reset(); camera.close(); cameraStatus.setText("Camera off");
        super.onPause(); if (!permissionPending) finish();
    }
    @Override protected void onStop() { super.onStop(); camera.close(); finish(); }
}
