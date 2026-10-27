package com.discretesignage.display;

import org.junit.Test;
import static org.junit.Assert.*;

public class BodyPresenceTest {
    private float[][] torso() {
        return new float[][]{{.3f,.3f,.9f,.9f},{.7f,.3f,.9f,.9f},{.35f,.7f,.9f,.9f},{.65f,.7f,.9f,.9f}};
    }
    @Test public void torsoNeedsNoHandLandmarks() { assertTrue(BodyPresence.visible(torso())); }
    @Test public void rejectsHiddenOrUncertainTorso() {
        float[][] points = torso(); points[2][2] = .2f;
        assertFalse(BodyPresence.visible(points));
        points = torso(); points[0][3] = .2f;
        assertFalse(BodyPresence.visible(points));
    }
    @Test public void rejectsBadAndOffscreenCoordinates() {
        assertFalse(BodyPresence.visible(null));
        float[][] points = torso(); points[0][0] = Float.NaN;
        assertFalse(BodyPresence.visible(points));
        points = torso(); points[3][1] = 1.2f;
        assertFalse(BodyPresence.visible(points));
    }
    @Test public void rejectsTinyBackgroundPose() {
        float[][] points = torso();
        for (float[] p : points) { p[0] = .5f + (p[0]-.5f)*.1f; p[1] = .5f + (p[1]-.5f)*.1f; }
        assertFalse(BodyPresence.visible(points));
    }
}
