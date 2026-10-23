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
        return java.util.Arrays.asList("single", "columns", "rows").contains(config.getOrDefault("layout", "single")) && logoSettings(config.get("logo"))
                && java.util.Arrays.asList("none", "fade", "slide", "zoom").contains(config.getOrDefault("transition", "fade"))
                && java.util.Arrays.asList("fit", "fill", "stretch").contains(config.get("scaleType"))
                && java.util.Arrays.asList("landscape", "portrait", "landscape-flipped", "portrait-flipped")
                .contains(config.get("orientation"));
    }
    private static boolean logoSettings(Object value) {
        if (value == null) return true;
        if (!(value instanceof Map)) return false;
        Map<?, ?> logo = (Map<?, ?>) value;
        return logo.get("mediaId") instanceof String
                && java.util.Arrays.asList("small", "medium").contains(logo.get("size"))
                && java.util.Arrays.asList("top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right").contains(logo.get("position"));
    }

    static boolean manifest(java.util.List<java.util.List<Map<String, Object>>> regions,
                            Map<String, Object> logo, Map<String, Object> config) {
        if (!supported(config) || regions == null || regions.size() !=
                ("single".equals(config.getOrDefault("layout", "single")) ? 1 : 2)) return false;
        for (java.util.List<Map<String, Object>> region : regions) {
            if (region == null) return false;
            for (Map<String, Object> item : region) {
                if (item == null || !(item.get("asset") instanceof Map) || !(item.get("duration") instanceof Number)) return false;
                Map<?, ?> asset = (Map<?, ?>) item.get("asset");
                if (!asset(asset) || !java.util.Arrays.asList("image/webp", "video/mp4").contains(asset.get("contentType"))) return false;
            }
        }
        if (config.get("logo") == null) return logo == null;
        return logo != null && asset(logo) && "image/webp".equals(logo.get("contentType"))
                && logo.get("id").equals(((Map<?, ?>) config.get("logo")).get("mediaId"));
    }
    private static boolean asset(Map<?, ?> asset) {
        return asset.get("id") instanceof String && mediaUrl(String.valueOf(asset.get("url")));
    }
}
