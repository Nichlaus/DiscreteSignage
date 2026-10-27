package com.discretesignage.display;

import java.util.Map;

final class ProductOffer {
    final String name, description;
    final long cents, version, deadline;
    private ProductOffer(String name, String description, long cents, long version, long deadline) {
        this.name = name; this.description = description; this.cents = cents; this.version = version; this.deadline = deadline;
    }
    static ProductOffer read(Map<?, ?> response, long started, long received) {
        if (response == null || !(response.get("product") instanceof Map) || !"AUD".equals(response.get("currency"))) return null;
        Map<?, ?> product = (Map<?, ?>) response.get("product");
        long server = integer(response.get("serverNow")), expires = integer(response.get("expiresAt"));
        long version = integer(response.get("version")), cents = integer(product.get("priceCents"));
        if (server < 0 || expires <= server || expires - server > 60000 || received < started
                || version < 1 || cents < 0 || cents > 999999 || !Boolean.TRUE.equals(product.get("available"))) return null;
        Object name = product.get("name"), description = product.get("description");
        if (!(name instanceof String) || ((String)name).trim().isEmpty() || ((String)name).length() > 100
                || !(description instanceof String) || ((String)description).length() > 300) return null;
        long remaining = expires - server - (received - started);
        if (remaining <= 0) return null;
        return new ProductOffer((String)name, (String)description, cents, version, received + remaining);
    }
    static java.util.List<ProductOffer> readAll(Map<?, ?> response, long started, long received) {
        if (response == null || !(response.get("products") instanceof java.util.List)) {
            ProductOffer one = read(response,started,received);
            return one == null ? java.util.Collections.emptyList() : java.util.Collections.singletonList(one);
        }
        java.util.List<?> raw = (java.util.List<?>)response.get("products");
        if (raw.isEmpty() || raw.size() > 3) return java.util.Collections.emptyList();
        java.util.List<ProductOffer> result = new java.util.ArrayList<>();
        for (Object product : raw) {
            java.util.Map<Object,Object> entry = new java.util.HashMap<>(response); entry.put("product",product);
            ProductOffer offer = read(entry,started,received);
            if (offer == null) return java.util.Collections.emptyList();
            result.add(offer);
        }
        return result;
    }
    private static long integer(Object value) {
        if (!(value instanceof Number)) return -1;
        double number = ((Number)value).doubleValue();
        return Double.isFinite(number) && number >= 0 && number <= 9007199254740991d && number == Math.rint(number) ? (long)number : -1;
    }
}
