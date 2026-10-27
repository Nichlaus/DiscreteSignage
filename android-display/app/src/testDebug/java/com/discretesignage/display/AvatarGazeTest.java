package com.discretesignage.display;

import org.junit.Test;
import static org.junit.Assert.*;

public class AvatarGazeTest {
    @Test public void followsPositionGraduallyWithinBounds() {
        AvatarGaze gaze = new AvatarGaze(); gaze.target(1,0); gaze.step();
        assertEquals(.35f,gaze.x(),.001f); assertEquals(-.35f,gaze.y(),.001f);
        for (int i=0;i<100;i++) gaze.step();
        assertTrue(gaze.x() <= 1); assertTrue(gaze.y() >= -1);
        gaze.target(0,1); gaze.step();
        assertTrue(gaze.x() > -1); assertTrue(gaze.y() < 1);
    }
    @Test public void invalidPositionAndDepartureClearOldTarget() {
        AvatarGaze gaze = new AvatarGaze();
        for (float invalid : new float[]{Float.NaN,Float.POSITIVE_INFINITY,-.1f,1.1f}) {
            gaze.target(1,1); gaze.step(); gaze.target(invalid,.5f); gaze.step();
            assertEquals(0,gaze.x(),0); assertEquals(0,gaze.y(),0);
        }
        gaze.target(1,1); gaze.step(); gaze.reset(); gaze.step();
        assertEquals(0,gaze.x(),0); assertEquals(0,gaze.y(),0);
    }
    @Test public void centeredVisitorKeepsNeutralGaze() {
        AvatarGaze gaze = new AvatarGaze(); gaze.target(.5f,.5f); gaze.step();
        assertEquals(0,gaze.x(),0); assertEquals(0,gaze.y(),0);
    }
}
