package com.discretesignage.display;

import org.junit.Test;
import static org.junit.Assert.*;
import static com.discretesignage.display.AttractionSession.Stage.*;

public class AttractionSessionTest {
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
        assertEquals(GREETING,session.update(true,42000));
    }
    @Test public void departureAndDismissalCloseProductAndApplyCooldown() {
        AttractionSession session = new AttractionSession();
        session.update(true,0); session.update(true,2000); session.engage(2100);
        assertEquals(ADVERTISING,session.update(false,2200));
        assertFalse(session.engage(2300));
        assertEquals(ADVERTISING,session.update(true,3000));
        session.update(true,32200); session.update(true,34200);
        session.end(35000);
        assertEquals(ADVERTISING,session.update(true,36000));
        assertFalse(session.engage(36000));
    }
}
