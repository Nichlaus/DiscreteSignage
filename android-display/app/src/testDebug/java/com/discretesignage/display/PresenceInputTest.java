package com.discretesignage.display;

import org.junit.Test;
import static org.junit.Assert.*;

public class PresenceInputTest {
    @Test public void acceptsOnlyRecentNonFutureSamples() {
        assertFalse(PresenceInput.fresh(-1, 1000));
        assertFalse(PresenceInput.fresh(1001, 1000));
        assertFalse(PresenceInput.fresh(499, 1000));
        assertTrue(PresenceInput.fresh(500, 1000));
        assertTrue(PresenceInput.fresh(1000, 1000));
    }
}
