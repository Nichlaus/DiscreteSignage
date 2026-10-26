package com.discretesignage.display;

/** Session-only wave heuristic; coordinates are normalized after camera rotation. */
final class HandMotion {
    private float anchor, peak;
    private int direction, reversals;
    private long last = -1, started, cooldownUntil;

    void reset() { last = -1; direction = 0; reversals = 0; cooldownUntil = 0; }
    boolean update(float x, float y, boolean openPalm, long now) {
        if (!Float.isFinite(x) || !Float.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1 || !openPalm) {
            last = -1; direction = 0; reversals = 0; return false;
        }
        if (last < 0 || now <= last || now - last > 500 || now - started > 2200) {
            anchor = peak = x; direction = 0; reversals = 0; started = now;
        }
        last = now;
        if (now < cooldownUntil) return false;
        if (direction == 0) {
            if (Math.abs(x - anchor) >= .10f) { direction = x > anchor ? 1 : -1; peak = x; }
        } else {
            if ((direction > 0 && x > peak) || (direction < 0 && x < peak)) peak = x;
            if ((direction > 0 && peak - x >= .10f) || (direction < 0 && x - peak >= .10f)) {
                direction = -direction; peak = x; reversals++;
                if (reversals >= 2) {
                    cooldownUntil = now + 2500; last = -1; return true;
                }
            }
        }
        return false;
    }
}
