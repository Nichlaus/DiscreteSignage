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

/** Native interaction rehearsal only; no camera, identity, storage or provider calls. */
public final class InteractivePreviewActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable expire = this::finish;
    private final List<Button> answers = new ArrayList<>();
    private TextView feedback;
    private CatPreviewView cat;

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
        text(content, "Developer simulation · Camera and microphone off", 14);
        text(content, "Touch or use your remote. No visitor data is recorded. Ends after 30 seconds without input.", 14);
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
    @Override protected void onPause() {
        handler.removeCallbacksAndMessages(null); cat.reset();
        super.onPause(); finish();
    }
}
