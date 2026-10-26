package com.discretesignage.display;

import org.junit.Test;
import static org.junit.Assert.*;

public class PointSelectionTest {
    @Test public void zonesHaveNeutralGapsAndRejectInvalidCoordinates() {
        assertEquals(0, PointSelection.zone(.5f,.1f));
        assertEquals(1, PointSelection.zone(.1f,.5f));
        assertEquals(2, PointSelection.zone(.5f,.5f));
        assertEquals(3, PointSelection.zone(.9f,.5f));
        assertEquals(4, PointSelection.zone(.5f,.9f));
        for (float[] point : new float[][]{{.1f,.1f},{.35f,.5f},{-1,.5f},{.5f,2},{Float.NaN,.5f}})
            assertEquals(-1, PointSelection.zone(point[0],point[1]));
    }
    @Test public void continuousHoldConfirmsOnceAndResetAllowsAnotherAnswer() {
        PointSelection p = new PointSelection();
        for (long t=0;t<900;t+=150) assertEquals(-1,p.update(2,t,t));
        assertEquals(2,p.update(2,900,900));
        assertEquals(-1,p.update(1,1200,1200));
        p.reset();
        for (long t=1500;t<2400;t+=150) assertEquals(-1,p.update(1,t,t));
        assertEquals(1,p.update(1,2400,2400));
    }
    @Test public void lossChangeGapsAndOldResultsCancelPartialHolds() {
        for (int mode=0;mode<6;mode++) {
            PointSelection p = new PointSelection();
            p.update(2,0,0); p.update(2,300,300); p.update(2,600,600);
            switch (mode) {
                case 0: p.update(-1,750,750); break;
                case 1: p.update(1,750,750); break;
                case 2: p.update(2,600,600); break;
                case 3: p.update(2,750,1300); break;
                case 4: p.update(2,800,750); break;
                default: p.cancel();
            }
            assertEquals(-1,p.update(2,900,900));
            assertEquals(0,p.progress());
        }
        PointSelection p = new PointSelection();
        p.update(2,0,0); p.update(2,300,300);
        assertEquals(-1,p.update(2,901,901));
        assertEquals(0,p.progress());
    }
}
