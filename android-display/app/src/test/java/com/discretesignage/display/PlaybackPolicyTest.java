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
        assertEquals(0, PlaybackPolicy.leaseMillis(60000, 0, 0));
        assertEquals(0, PlaybackPolicy.leaseMillis(2000, 1000, 1001));
        assertEquals(500, PlaybackPolicy.leaseMillis(2000, 1000, 500));
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
        config.remove("logo");
        for (String layout : new String[]{"single", "columns", "rows"}) {
            config.put("layout", layout);
            for (String transition : new String[]{"none", "fade", "slide", "zoom"}) {
                config.put("transition", transition); assertTrue(PlaybackPolicy.supported(config));
            }
        }
    }
    @Test public void manifestsMustMatchLayoutAndValidatedLogo() {
        Map<String, Object> config = new HashMap<>(Map.of("orientation", "portrait", "scaleType", "stretch", "layout", "columns"));
        java.util.List<Map<String, Object>> blank = java.util.Collections.emptyList();
        assertFalse(PlaybackPolicy.manifest(java.util.List.of(blank), null, config));
        assertTrue(PlaybackPolicy.manifest(java.util.List.of(blank, blank), null, config));
        Map<String, Object> logo = new HashMap<>(Map.of("id", "logo", "contentType", "image/webp",
                "url", "https://storage.googleapis.com/discretesignage.firebasestorage.app/businesses/b/logo.webp"));
        assertFalse(PlaybackPolicy.manifest(java.util.List.of(blank, blank), logo, config));
        config.put("logo", Map.of("mediaId", "logo", "size", "small", "position", "top-center"));
        assertTrue(PlaybackPolicy.manifest(java.util.List.of(blank, blank), logo, config));
        logo.put("contentType", "video/mp4"); assertFalse(PlaybackPolicy.manifest(java.util.List.of(blank, blank), logo, config));
        logo.put("contentType", "image/webp"); logo.put("id", "other");
        assertFalse(PlaybackPolicy.manifest(java.util.List.of(blank, blank), logo, config));
        assertFalse(PlaybackPolicy.manifest(java.util.List.of(blank, blank), null, config));
    }
}
