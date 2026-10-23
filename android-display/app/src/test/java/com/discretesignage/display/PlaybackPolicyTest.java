package com.discretesignage.display;

import org.junit.Test;
import java.util.HashMap;
import java.util.Map;
import static org.junit.Assert.*;

public class PlaybackPolicyTest {
    @Test public void leasesNeverOutliveTheirRequestOrAcceptExpiredAuthorization() {
        assertEquals(45000, PlaybackPolicy.leaseMillis(61000, 1000, 15000));
        assertEquals(0, PlaybackPolicy.leaseMillis(1000, 1000, 0));
        assertEquals(0, PlaybackPolicy.leaseMillis(61001, 1000, 0));
        assertEquals(0, PlaybackPolicy.leaseMillis(61000, 1000, 60001));
    }
    @Test public void onlyPrivateProjectMediaOriginIsAccepted() {
        String path = "/discretesignage.firebasestorage.app/businesses/b/media/m/playback-v1.webp?signature=x";
        assertTrue(PlaybackPolicy.mediaUrl("https://storage.googleapis.com" + path));
        for (String origin : new String[]{"http://storage.googleapis.com", "https://storage.googleapis.com.evil.test",
                "https://storage.googleapis.com@evil.test", "https://storage.googleapis.com:444", "file://storage.googleapis.com"})
            assertFalse(PlaybackPolicy.mediaUrl(origin + path));
        assertFalse(PlaybackPolicy.mediaUrl("https://storage.googleapis.com/another-bucket/file"));
    }
    @Test public void unsupportedLayoutsNeverReceiveAppliedStatus() {
        Map<String, Object> config = new HashMap<>();
        config.put("orientation", "landscape"); config.put("scaleType", "fit");
        assertTrue(PlaybackPolicy.supported(config));
        config.put("layout", "split-horizontal"); assertFalse(PlaybackPolicy.supported(config));
        config.put("layout", "single"); config.put("logo", Map.of("mediaId", "image"));
        assertFalse(PlaybackPolicy.supported(config));
        config.remove("logo"); config.put("transition", "zoom"); assertFalse(PlaybackPolicy.supported(config));
    }
}
