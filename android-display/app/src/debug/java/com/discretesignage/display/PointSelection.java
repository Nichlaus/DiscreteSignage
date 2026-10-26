package com.discretesignage.display;

/** Camera-space targets, with neutral gaps and a continuous hold before selection. */
final class PointSelection {
    private int target = -1;
    private long started, last = -1;
    private boolean locked;

    static int zone(float x, float y) {
        if (!Float.isFinite(x) || !Float.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return -1;
        boolean middleX = x >= .4f && x <= .6f, middleY = y >= .4f && y <= .6f;
        if (middleX && middleY) return 2;
        if (middleX && y < .3f) return 0;
        if (middleX && y > .7f) return 4;
        if (middleY && x < .3f) return 1;
        if (middleY && x > .7f) return 3;
        return -1;
    }

    int update(int next, long captured, long now) {
        if (locked) return -1;
        if (next < 0 || next > 4 || captured > now || now - captured > 500 || captured <= last) {
            cancel(); return -1;
        }
        if (next != target || last < 0 || captured - last > 500) { target = next; started = captured; }
        last = captured;
        if (captured - started < 900) return -1;
        locked = true;
        return target;
    }

    int progress() { return target < 0 ? 0 : (int)Math.min(100, (last - started) * 100 / 900); }
    void cancel() { target = -1; last = -1; }
    void lock() { cancel(); locked = true; }
    void reset() { cancel(); locked = false; }
}
