package com.discretesignage.display;

import android.view.Gravity;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Owns the regions and logo so authorization loss clears the whole composition. */
final class NativeScreen {
    interface Events { void ready(boolean empty); void played(String mediaId, int region); void failed(); }
    private final FrameLayout stage;
    private final Events events;
    private final List<NativePlaylist> players = new ArrayList<>();
    private boolean[] ready;
    private boolean empty;
    private Map<String, Object> settings;
    private FrameLayout logoView;

    NativeScreen(FrameLayout stage, Events events) {
        this.stage = stage; this.events = events;
        stage.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> positionLogo());
    }

    void update(List<List<Map<String, Object>>> regions, Map<String, Object> logo,
                Map<String, Object> config, long deadline) {
        if (!PlaybackPolicy.manifest(regions, logo, config)) throw new IllegalArgumentException("Invalid composition");
        empty = regions.stream().allMatch(List::isEmpty);
        if (players.isEmpty()) {
            settings = config;
            ready = new boolean[regions.size() + (logo == null ? 0 : 1)];
            LinearLayout layout = new LinearLayout(stage.getContext());
            layout.setOrientation("rows".equals(config.get("layout")) ? LinearLayout.VERTICAL : LinearLayout.HORIZONTAL);
            stage.addView(layout, new FrameLayout.LayoutParams(-1, -1));
            for (int i = 0; i < regions.size(); i++) {
                FrameLayout region = new FrameLayout(stage.getContext());
                region.setBackgroundColor(0xff000000); region.setClipChildren(true);
                layout.addView(region, layout.getOrientation() == LinearLayout.HORIZONTAL
                        ? new LinearLayout.LayoutParams(0, -1, 1) : new LinearLayout.LayoutParams(-1, 0, 1));
                addPlayer(region, i, true);
            }
            if (logo != null) {
                logoView = new FrameLayout(stage.getContext());
                stage.addView(logoView); positionLogo(); addPlayer(logoView, regions.size(), false);
            }
        }
        for (int i = 0; i < regions.size(); i++) players.get(i).update(regions.get(i), config, deadline);
        if (logo != null) {
            Map<String, Object> logoConfig = new HashMap<>(config);
            logoConfig.put("scaleType", "fit"); logoConfig.put("transition", "none");
            players.get(regions.size()).update(Collections.singletonList(Map.of("asset", logo, "duration", 30)), logoConfig, deadline);
        }
    }

    private void addPlayer(FrameLayout view, int index, boolean report) {
        players.add(new NativePlaylist(view, new NativePlaylist.Events() {
            @Override public void ready(String mediaId) {
                ready[index] = true;
                if (report && mediaId != null) events.played(mediaId, index);
                for (boolean complete : ready) if (!complete) return;
                events.ready(empty);
            }
            @Override public void failed() { stop(); events.failed(); }
        }));
    }

    @SuppressWarnings("unchecked") private void positionLogo() {
        if (logoView == null || settings == null) return;
        Map<String, Object> logo = (Map<String, Object>) settings.get("logo");
        String position = (String) logo.get("position");
        float size = "medium".equals(logo.get("size")) ? .18f : .12f;
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                Math.max(1, Math.round(stage.getWidth() * size)), Math.max(1, Math.round(stage.getHeight() * size)));
        params.gravity = (position.startsWith("top") ? Gravity.TOP : Gravity.BOTTOM)
                | (position.endsWith("left") ? Gravity.LEFT : position.endsWith("right") ? Gravity.RIGHT : Gravity.CENTER_HORIZONTAL);
        params.setMargins(Math.round(stage.getWidth() * .03f), Math.round(stage.getHeight() * .03f),
                Math.round(stage.getWidth() * .03f), Math.round(stage.getHeight() * .03f));
        logoView.setLayoutParams(params);
    }

    void stop() {
        for (NativePlaylist player : players) player.destroy();
        players.clear(); stage.removeAllViews(); logoView = null; settings = null;
    }
    void destroy() { stop(); }
}
