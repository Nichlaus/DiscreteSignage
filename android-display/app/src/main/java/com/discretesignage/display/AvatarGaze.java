package com.discretesignage.display;

/** Ephemeral, bounded gaze; a camera position never moves the advert or overlay. */
final class AvatarGaze {
    private float x, y, targetX, targetY;
    void target(float normalizedX, float normalizedY) {
        if (!Float.isFinite(normalizedX) || !Float.isFinite(normalizedY)
                || normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
            reset(); return;
        }
        targetX = normalizedX * 2 - 1;
        targetY = normalizedY * 2 - 1;
    }
    // Called by the existing 100 ms overlay tick, independent of detector frame rate.
    void step() { x += (targetX - x) * .35f; y += (targetY - y) * .35f; }
    float x() { return x; }
    float y() { return y; }
    void reset() { x = y = targetX = targetY = 0; }
}
