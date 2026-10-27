package com.discretesignage.display;

import org.junit.Test;
import static org.junit.Assert.*;
import static com.discretesignage.display.AttractionSession.Stage.*;

public class AttractionSessionTest {
    @Test public void trackingLossRestartsDwellAndWaveCannotOpenBeforeGreeting() {
        AttractionSession session = new AttractionSession();
        session.update(true,0);
        session.update(true,1500);
        assertFalse(session.engage(1500));
        session.update(false,1600);
        session.update(true,1700);
        assertEquals(ADVERTISING,session.update(true,3500));
        assertEquals(GREETING,session.update(true,3700));
        assertTrue(session.engage(3800));
        assertEquals(ADVERTISING,session.update(false,4000));
        assertFalse(session.engage(4100));
        assertEquals(ADVERTISING,session.update(true,6000));
    }
    @Test public void passingVisitorDoesNotInterruptAndGreetingNeedsEngagement() {
        AttractionSession session = new AttractionSession();
        assertEquals(ADVERTISING,session.update(true,0));
        assertFalse(session.engage(100));
        assertEquals(ADVERTISING,session.update(false,1500));
        session.update(true,2000);
        assertEquals(ADVERTISING,session.update(true,3999));
        assertEquals(GREETING,session.update(true,4000));
        assertEquals(GREETING,session.update(true,6000));
        assertTrue(session.engage(6000));
        assertEquals(PRODUCT,session.stage());
        assertFalse(session.engage(7000));
        assertEquals(ADVERTISING,session.update(true,26000));
    }
    @Test public void greetingExpiresAndContinuousPresenceCannotBypassCooldown() {
        AttractionSession session = new AttractionSession();
        session.update(true,0); session.update(true,2000);
        assertFalse(session.engage(10000));
        assertEquals(ADVERTISING,session.update(true,10000));
        assertEquals(ADVERTISING,session.update(true,39999));
        assertEquals(ADVERTISING,session.update(true,40000));
        assertEquals(ADVERTISING,session.update(true,42000));
        assertEquals(ADVERTISING,session.update(true,120000));
    }
    @Test public void briefDetectionGapDoesNotRearmButDepartureDoes() {
        AttractionSession session = new AttractionSession();
        session.update(true,0); session.update(true,2000);
        session.update(false,3000); session.update(false,4999);
        assertEquals(ADVERTISING,session.update(true,5000));
        assertEquals(ADVERTISING,session.update(true,60000));
        session.update(false,61000); session.update(false,63000);
        assertEquals(ADVERTISING,session.update(true,64000));
        assertEquals(GREETING,session.update(true,66000));
    }
    @Test public void dismissalDoesNotInviteSameVisitorAgain() {
        AttractionSession session = new AttractionSession();
        session.update(true,0); session.update(true,2000); session.end(2100);
        assertEquals(ADVERTISING,session.update(true,60000));
        session.update(false,61000); session.update(false,63000);
        session.update(true,64000);
        assertEquals(GREETING,session.update(true,66000));
    }
    @Test public void departureAndDismissalCloseProductAndApplyCooldown() {
        AttractionSession session = new AttractionSession();
        session.update(true,0); session.update(true,2000); session.engage(2100);
        assertEquals(ADVERTISING,session.update(false,2200));
        assertFalse(session.engage(2300));
        assertEquals(ADVERTISING,session.update(true,3000));
        session.update(false,30000); session.update(false,32000);
        session.update(true,32200); assertEquals(GREETING,session.update(true,34200));
        session.end(35000);
        assertEquals(ADVERTISING,session.update(true,36000));
        assertFalse(session.engage(36000));
    }
    @Test public void triviaRequiresEngagementAndEndsOnDepartureOrDeadline() {
        AttractionSession session=new AttractionSession();
        assertFalse(session.play(0)); session.update(true,0); session.update(true,2000);
        assertTrue(session.play(2100));assertEquals(TRIVIA,session.stage());
        assertFalse(session.play(2200));assertFalse(session.engage(2200));
        assertEquals(TRIVIA,session.update(true,47099));
        assertEquals(ADVERTISING,session.update(true,47100));
        session=new AttractionSession();session.update(true,0);session.update(true,2000);
        session.play(2100);assertEquals(ADVERTISING,session.update(false,2200));
    }
}
