package com.discretesignage.display;

import org.junit.Test;
import static org.junit.Assert.*;

public class HandMotionTest {
    @Test public void repeatedOpenPalmMotionWavesButJitterAndOneSweepDoNot() {
        HandMotion motion = new HandMotion();
        assertFalse(motion.update(.3f,.5f,true,100));
        assertFalse(motion.update(.31f,.5f,true,200));
        assertFalse(motion.update(.5f,.5f,true,300));
        assertFalse(motion.update(.3f,.5f,true,500));
        assertTrue(motion.update(.5f,.5f,true,700));
        assertFalse(motion.update(.3f,.5f,true,900));
        assertFalse(motion.update(.5f,.5f,true,1100));
        assertFalse(motion.update(.3f,.5f,true,1300));
    }
    @Test public void lossClosedPalmAndLongGapsCancelMotion() {
        HandMotion motion = new HandMotion();
        motion.update(.3f,.5f,true,100); motion.update(.5f,.5f,true,300);
        assertFalse(motion.update(Float.NaN,.5f,true,400));
        assertFalse(motion.update(.3f,.5f,true,500));
        assertFalse(motion.update(.5f,.5f,false,700));
        assertFalse(motion.update(.3f,.5f,true,900));
        assertFalse(motion.update(.5f,.5f,true,2000));
        assertFalse(motion.update(.3f,.5f,true,2200));
        motion.reset(); assertFalse(motion.update(.5f,.5f,true,2400));
    }
}
