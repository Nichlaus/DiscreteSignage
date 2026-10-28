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
    private final java.util.function.Supplier<com.google.android.gms.tasks.Task<Object>> load;
    private ProductOffer offer;
    private java.util.List<ProductOffer> offers = Collections.emptyList();
    private int productIndex;
    private final TriviaRound round = new TriviaRound();
    private final PointSelection point = new PointSelection();
    private boolean playingTrivia, answered, pointNeedsNeutral;
    private long answerUntil;
    private final Button play, nextProduct, nextQuestion;
    private final android.widget.GridLayout answers;
    private final Button[] answerButtons = new Button[5];
    private final PresenceInput presence = new PresenceInput();
    private final AvatarGaze gaze = new AvatarGaze();
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
            if (playingTrivia && answered && now >= answerUntil) {
                if (round.complete()) dismiss();
                else if (round.next()) { answered=false; point.reset(); pointNeedsNeutral=true; render(); }
            }
            if (presenceMode && now >= presenceDeadline) stopPresence();
            if (presenceMode) {
                if (offer == null) { stopPresence(); panel.setVisibility(View.GONE); }
                else {
                    attraction.update(lastPresence >= 0 && now - lastPresence <= 500, now);
                    expanded = attraction.stage() == AttractionSession.Stage.PRODUCT;
                    if (attraction.stage() != AttractionSession.Stage.TRIVIA && playingTrivia) resetTrivia();
                    if (attraction.stage() != lastStage) {
                        if (attraction.stage() == AttractionSession.Stage.GREETING) {point.reset(); avatar.wave();}
                        lastStage = attraction.stage();
                    }
                    if (lastPresence < 0 || now - lastPresence > 500
                            || attraction.stage() == AttractionSession.Stage.ADVERTISING) gaze.reset();
                    else gaze.step();
                    avatar.look(gaze.x(), gaze.y());
                    render(); handler.postDelayed(this,100); return;
                }
            }
            if ((expanded || playingTrivia) && (offer == null || now >= closeAt)) dismiss();
            panel.setVisibility(offer != null && now >= cooldownUntil ? View.VISIBLE : View.GONE);
            handler.postDelayed(this,100);
        }
    };
    ProductOverlay(Activity activity, FrameLayout root, FirebaseFunctions functions) {
        this(activity, root, () -> functions.getHttpsCallable("getScreenFeaturedProduct")
                .call(Collections.emptyMap()).continueWith(task -> task.getResult().getData()));
    }
    ProductOverlay(Activity activity, FrameLayout root,
                   java.util.function.Supplier<com.google.android.gms.tasks.Task<Object>> load) {
        this.load = load; this.activity = activity;
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
        nextProduct = new Button(activity); nextProduct.setText("Next product"); panel.addView(nextProduct);
        nextProduct.setOnClickListener(v -> { if (!offers.isEmpty()) { productIndex=(productIndex+1)%offers.size(); offer=offers.get(productIndex); render(); } });
        play = new Button(activity); play.setText("Play a quick trivia round"); panel.addView(play);
        play.setOnClickListener(v -> openTrivia());
        answers = new android.widget.GridLayout(activity); answers.setColumnCount(3); answers.setRowCount(3); panel.addView(answers);
        int[] rows={0,1,1,1,2}, columns={1,0,1,2,1};
        for(int i=0;i<5;i++) {
            final int answer=i; Button button=new Button(activity); answerButtons[i]=button; button.setTextSize(11);
            android.widget.GridLayout.LayoutParams cell=new android.widget.GridLayout.LayoutParams(android.widget.GridLayout.spec(rows[i]),android.widget.GridLayout.spec(columns[i]));
            cell.width=(int)(68*activity.getResources().getDisplayMetrics().density); cell.height=-2;
            answers.addView(button,cell); button.setOnClickListener(v -> answer(answer));
        }
        nextQuestion=new Button(activity); nextQuestion.setText("Next question");panel.addView(nextQuestion);
        nextQuestion.setOnClickListener(v -> {if(round.complete()) {dismiss();return;} if(round.next()) {answered=false;point.reset();pointNeedsNeutral=true;render();}});
        Button close = new Button(activity); close.setText("No thanks / close"); close.setOnClickListener(v -> dismiss()); panel.addView(close);
    }
    void start(Object character) {
        avatar.setRobot(!"cat".equals(character));
        if (running) return;
        running = true; int ticket = ++epoch; handler.post(tick); fetch(ticket);
    }
    private void fetch(int ticket) {
        long started = SystemClock.elapsedRealtime();
        load.get().addOnCompleteListener(task -> {
            if (!running || ticket != epoch) return;
            java.util.List<ProductOffer> received = Collections.emptyList();
            ProductOffer next = null;
            if (task.isSuccessful() && task.getResult() instanceof Map) {
                received = ProductOffer.readAll((Map<?, ?>)task.getResult(),started,SystemClock.elapsedRealtime());
                if (!received.isEmpty()) next = received.get(Math.min(productIndex,received.size()-1));
            }
            if (next == null) stopPresence();
            if (next == null || offer == null || next.version != offer.version) {
                expanded = false; resetTrivia(); attraction.end(SystemClock.elapsedRealtime());
            }
            offers = received; productIndex = Math.min(productIndex,Math.max(0,offers.size()-1)); offer = next; render(); handler.postDelayed(() -> fetch(ticket),20000);
        });
    }
    private void render() {
        if (offer == null || SystemClock.elapsedRealtime() >= offer.deadline) { panel.setVisibility(View.GONE); return; }
        if (presenceMode && attraction.stage() == AttractionSession.Stage.ADVERTISING) { panel.setVisibility(View.GONE); return; }
        open.setText(presenceMode ? "Wave back or select to explore" : "Explore a featured product");
        open.setVisibility(expanded || playingTrivia ? View.GONE : View.VISIBLE);
        play.setVisibility(playingTrivia ? View.GONE : View.VISIBLE);
        nextProduct.setText(presenceMode ? "Next product · point right" : "Next product");
        nextProduct.setVisibility(expanded && offers.size()>1 ? View.VISIBLE : View.GONE);
        answers.setVisibility(playingTrivia ? View.VISIBLE : View.GONE);
        nextQuestion.setVisibility(playingTrivia && answered ? View.VISIBLE : View.GONE);
        text.setVisibility(expanded || presenceMode || playingTrivia ? View.VISIBLE : View.GONE);
        text.setText(expanded ? offer.name + "\n" + offer.description + "\n" + String.format(Locale.US,"AUD $%.2f",offer.cents / 100.0) : presenceMode ? "Hi! Explore " + offer.name + ", or point up for trivia." : "");
        if (playingTrivia) {
            text.setText("Question " + round.number() + " of 3\n" + round.question() + (answered ? "\n"+round.feedback()+" Score: "+round.score() : "\nSelect, or hold a point toward an answer."));
            String[] directions={"Top","Left","Centre","Right","Bottom"};
            for(int i=0;i<5;i++) {answerButtons[i].setText(directions[i]+"\n"+round.option(i));answerButtons[i].setEnabled(!answered);}
            nextQuestion.setText(round.complete() ? "Finish · score "+round.score()+"/3" : "Next question");
        }
        panel.setVisibility(SystemClock.elapsedRealtime() >= cooldownUntil ? View.VISIBLE : View.GONE);
    }
    private void openTrivia() {
        long now=SystemClock.elapsedRealtime();
        if(offer==null || now>=offer.deadline || (presenceMode && !attraction.play(now))) return;
        resetTrivia();playingTrivia=true;pointNeedsNeutral=true;expanded=false;closeAt=now+45000;render();
    }
    private void resetTrivia() {playingTrivia=false;answered=false;round.reset();point.reset();}
    private void answer(int choice) {
        long now=SystemClock.elapsedRealtime();
        if(!playingTrivia || answered || offer==null || now>=offer.deadline || now>=closeAt
                || (presenceMode && (lastPresence<0 || now-lastPresence>500))) return;
        round.answer(choice);answered=true;answerUntil=now+2500;point.lock();render();
    }
    private void dismiss() { resetTrivia(); attraction.end(SystemClock.elapsedRealtime()); expanded = false; cooldownUntil = SystemClock.elapsedRealtime() + 30000; avatar.reset(); render(); }
    boolean startPresence(String cameraId) {
        if (!running || offer == null || SystemClock.elapsedRealtime() >= offer.deadline) return false;
        stopPresence(); attraction = new AttractionSession(); presenceMode = true; lastPresence = -1; presenceDeadline = SystemClock.elapsedRealtime() + 120000;
        cameraNotice.setVisibility(View.VISIBLE); panel.setVisibility(View.GONE);
        boolean started = presence.start(activity, cameraId, new PresenceInput.Listener() {
            @Override public void sample(boolean present, boolean wave) {
                if (!running || !presenceMode) return;
                long now = SystemClock.elapsedRealtime(); lastPresence = present ? now : -1;
                if (wave && offer != null && now < offer.deadline && attraction.engage(now)) {
                    expanded = true; closeAt = now + 20000; render();
                }
            }
            @Override public void point(int zone, long captured) {
                if(!running || !presenceMode) return;
                if(playingTrivia && !answered) {
                    if(pointNeedsNeutral) {if(zone<0) pointNeedsNeutral=false; return;}
                    int choice=point.update(zone,captured,SystemClock.elapsedRealtime());
                    if(choice>=0) answer(choice);
                } else if(attraction.stage()==AttractionSession.Stage.GREETING) {
                    if(point.update(zone==0 ? 0 : -1,captured,SystemClock.elapsedRealtime())==0) openTrivia();
                } else if(attraction.stage()==AttractionSession.Stage.PRODUCT && offers.size()>1) {
                    if(zone<0) {point.reset(); return;}
                    if(point.update(zone==3 ? 3 : -1,captured,SystemClock.elapsedRealtime())==3) {
                        productIndex=(productIndex+1)%offers.size();offer=offers.get(productIndex);render();
                    }
                } else point.cancel();
            }
            @Override public void position(float x, float y) {
                if (running && presenceMode) gaze.target(x, y);
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
        presence.stop(); resetTrivia(); gaze.reset(); presenceMode = false; lastPresence = -1; expanded = false;
        attraction.end(SystemClock.elapsedRealtime()); lastStage = AttractionSession.Stage.ADVERTISING;
        cameraNotice.setVisibility(View.GONE); avatar.reset(); render();
    }
    void stop() { stopPresence(); running = false; epoch++; handler.removeCallbacksAndMessages(null); offers = Collections.emptyList(); productIndex=0; offer = null; expanded = false; panel.setVisibility(View.GONE); avatar.reset(); }
}
