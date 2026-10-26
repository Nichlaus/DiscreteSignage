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
    private final Runnable sessionEnd = this::finish;
    private long sessionDeadline;
    private final TriviaRound round = new TriviaRound();
    private final Runnable advance = this::advanceQuestion;
    private TextView question, roundStatus;
    private final List<Button> answers = new ArrayList<>();
    private TextView feedback;
    private final PointSelection selection = new PointSelection();
    private TextView pointingStatus;
    private boolean answered;
    private boolean needsRelease;
    private CatPreviewView cat;
    private CameraProbe camera;
    private TextView cameraStatus;
    private boolean permissionPending;
    private LocalHandTracker tracker;
    private TextView trackingStatus;
    private final Runnable lostHand = () -> {
        selection.cancel();
        if (pointingStatus != null) pointingStatus.setText("Point with one index finger, then hold steady to choose.");
        if (cat != null) cat.look(0, 0);
        if (trackingStatus != null) trackingStatus.setText("Show one hand to the camera");
    };

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
        text(content, "Developer preview · Local hand tracking · Microphone off", 14);
        text(content, "Touch or use your remote. No visitor data is recorded. Three questions. Returns to adverts after the round or 30 seconds without input.", 14);
        cameraStatus = text(content, "Camera off", 16);
        cameraStatus.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        trackingStatus = text(content, "Hand tracking off · trivia uses touch or remote", 14);
        camera = new CameraProbe(this, new CameraProbe.Listener() {
            @Override public void live() { cameraStatus.setText("Camera on · local frames only · no recording"); }
            @Override public void frame(android.media.Image image, int rotation, boolean mirrored) {
                if (tracker != null) tracker.frame(image, rotation, mirrored);
            }
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
            } else {
                stopCamera();
                tracker = new LocalHandTracker(this, new LocalHandTracker.Listener() {
                    @Override public void result(boolean found, float x, float y, boolean wave, int zone, long captured) {
                        handler.removeCallbacks(lostHand);
                        if (!found || android.os.SystemClock.elapsedRealtime() - captured > 500) { lostHand.run(); return; }
                        pointAt(zone, captured, android.os.SystemClock.elapsedRealtime());
                        trackingStatus.setText("Hand detected · wave with an open palm");
                        cat.look(x * 2 - 1, y * 2 - 1);
                        if (wave) cat.wave();
                        onUserInteraction(); handler.postDelayed(lostHand, 750);
                    }
                    @Override public void failed() {
                        android.widget.Toast.makeText(InteractivePreviewActivity.this,
                                "Hand tracking unavailable. Returning to display.", android.widget.Toast.LENGTH_LONG).show();
                        finish();
                    }
                });
                cameraStatus.setText("Starting camera… No recording or uploads.");
                trackingStatus.setText("Starting local hand tracking…"); camera.start();
            }
        });
        button(content, "Stop camera", this::stopCamera);
        cat = new CatPreviewView(this);
        content.addView(cat, new LinearLayout.LayoutParams(gap * 15, gap * 12));
        button(content, "Simulate wave", () -> cat.wave());
        roundStatus = text(content, "Question 1 of 3", 14);
        question = text(content, round.question(), 21);
        pointingStatus = text(content, "Point with one index finger, then hold steady to choose.", 14);
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
            option.setOnClickListener(v -> chooseAnswer(answer));
        }
        button(content, "Start over", () -> {
            handler.removeCallbacks(advance); round.reset(); refreshQuestion();
        });
        button(content, "Return to display", this::finish);
        sessionDeadline = android.os.SystemClock.elapsedRealtime() + 120000;
    }

    void pointAt(int zone, long captured, long now) {
        if (answered) return;
        if (needsRelease) {
            if (zone == -1 && now >= captured && now - captured <= 500) needsRelease = false;
            selection.cancel(); return;
        }
        int answer = selection.update(zone, captured, now);
        if (answer >= 0) { chooseAnswer(answer); return; }
        String[] names = {"Top", "Left", "Centre", "Right", "Bottom"};
        pointingStatus.setText(zone >= 0 && zone < 5 && now >= captured && now - captured <= 500
                ? names[zone] + " · hold steady " + selection.progress() + "%"
                : "Point with one index finger, then hold steady to choose.");
    }
    private void chooseAnswer(int answer) {
        if (answered) return;
        answered = true; selection.lock();
        pointingStatus.setText("Answer selected · choose Start over to try again.");
        for (Button item : answers) item.setEnabled(false);
        boolean correct = round.answer(answer);
        feedback.setText(correct ? "Correct! " + round.feedback()
                : round.number() == 1 ? "Good try! The answer is Everest." : "Good try! " + round.feedback());
        if (correct) cat.wave();
        if (round.complete()) {
            roundStatus.setText("Round complete · " + round.score() + " of 3 correct · returning to adverts in 8 seconds");
        } else roundStatus.setText("Question " + round.number() + " of 3 · next question in 4 seconds");
        handler.postDelayed(advance, round.complete() ? 8000 : 4000);
    }

    private void advanceQuestion() {
        if (round.complete()) { finish(); return; }
        if (round.next()) refreshQuestion();
    }
    private void refreshQuestion() {
        answered = false; needsRelease = true; selection.reset(); cat.reset();
        String[] directions = {"Top", "Left", "Centre", "Right", "Bottom"};
        question.setText(round.question());
        roundStatus.setText("Question " + round.number() + " of 3");
        for (int i = 0; i < answers.size(); i++) {
            answers.get(i).setText(directions[i] + ": " + round.option(i));
            answers.get(i).setEnabled(true);
        }
        feedback.setText("Choose an answer using touch or D-pad and OK.");
        pointingStatus.setText("Lower your pointing finger before choosing again.");
    }

    private TextView text(LinearLayout parent, String value, int size) {
        TextView view = new TextView(this); view.setText(value); view.setTextSize(size);
        view.setTextColor(0xff193d36); view.setGravity(Gravity.CENTER); parent.addView(view); return view;
    }
    private void stopCamera() {
        selection.cancel();
        camera.close();
        if (tracker != null) { tracker.close(); tracker = null; }
        handler.removeCallbacks(lostHand);
        cameraStatus.setText("Camera off");
        trackingStatus.setText("Hand tracking off · trivia uses touch or remote");
        if (cat != null) cat.reset();
    }
    private void button(LinearLayout parent, String label, Runnable action) {
        Button button = new Button(this); button.setText(label);
        button.setOnClickListener(v -> action.run()); parent.addView(button);
    }
    @Override public void onUserInteraction() {
        super.onUserInteraction(); handler.removeCallbacks(expire); handler.postDelayed(expire, 30000);
    }
    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        if (cat != null && tracker == null) cat.look(event.getX() / Math.max(1, getWindow().getDecorView().getWidth()) * 2 - 1, 0);
        return super.dispatchTouchEvent(event);
    }
    @Override protected void onResume() {
        super.onResume(); onUserInteraction();
        handler.removeCallbacks(sessionEnd);
        handler.postDelayed(sessionEnd, Math.max(0, sessionDeadline - android.os.SystemClock.elapsedRealtime()));
    }
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
        handler.removeCallbacksAndMessages(null); cat.reset(); stopCamera();
        super.onPause(); if (!permissionPending) finish();
    }
    @Override protected void onStop() { super.onStop(); stopCamera(); finish(); }
}
