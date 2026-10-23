package com.discretesignage.display;

import java.net.URI;
import java.util.Map;

final class PlaybackPolicy {
    static long leaseMillis(long expiresAt, long serverNow, long requestElapsed) {
        if (serverNow <= 0) return 0;
        long remaining = expiresAt - serverNow;
        if (remaining <= 0 || remaining > 60000 || requestElapsed < 0) return 0;
        // Subtract the entire round trip, conservatively including time before issuance.
        return Math.max(0, remaining - requestElapsed);
    }

    static boolean mediaUrl(String value) {
        try {
            URI uri = new URI(value);
            return "https".equals(uri.getScheme()) && "storage.googleapis.com".equals(uri.getHost())
                    && uri.getRawUserInfo() == null && uri.getPort() == -1 && uri.getFragment() == null
                    && uri.getPath().startsWith("/discretesignage.firebasestorage.app/businesses/");
        } catch (Exception error) { return false; }
    }

    static boolean supported(Map<String, Object> config) {
        return "single".equals(config.getOrDefault("layout", "single")) && config.get("logo") == null
                && ("none".equals(config.get("transition")) || "fade".equals(config.getOrDefault("transition", "fade")))
                && java.util.Arrays.asList("fit", "fill", "stretch").contains(config.get("scaleType"))
                && java.util.Arrays.asList("landscape", "portrait", "landscape-flipped", "portrait-flipped")
                .contains(config.get("orientation"));
    }
}
