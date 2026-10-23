package com.discretesignage.display;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.*;

/** Private, content-verified files. A cache hit is never playback authorization. */
final class MediaCache {
    static final long FILE_LIMIT = 20L * 1024 * 1024, TOTAL_LIMIT = 512L * 1024 * 1024;
    private final File root;
    private Set<String> current = new HashSet<>();
    private long epoch;
    MediaCache(File root) {
        this.root = root;
        File[] files = root.listFiles();
        if (files != null) for (File file : files) if (file.getName().endsWith(".part")) file.delete();
    }
    synchronized long ticket() { return epoch; }
    synchronized void cancel() { epoch++; }
    synchronized void clear() {
        epoch++;
        current.clear();
        File[] files = root.listFiles();
        if (files != null) for (File file : files) file.delete();
    }
    private synchronized void check(long ticket) throws IOException {
        if (ticket != epoch || Thread.currentThread().isInterrupted()) throw new IOException("Download cancelled");
    }
    static String digest(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[32768]; int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        StringBuilder result = new StringBuilder();
        for (byte value : digest.digest()) result.append(String.format("%02x", value & 255));
        return result.toString();
    }
    static boolean verified(File file, long size, String hash) throws Exception {
        return size > 0 && size <= FILE_LIMIT && hash != null && hash.matches("[a-f0-9]{64}")
                && file.isFile() && file.length() == size && hash.equals(digest(file));
    }
    private File fetch(Map<String, Object> asset, long ticket) throws Exception {
        check(ticket);
        String hash = String.valueOf(asset.get("sha256"));
        long size = asset.get("size") instanceof Number ? ((Number) asset.get("size")).longValue() : 0;
        if (!hash.matches("[a-f0-9]{64}") || size < 1 || size > FILE_LIMIT
                || !PlaybackPolicy.mediaUrl(String.valueOf(asset.get("url")))) throw new IOException("Invalid download");
        if (!root.isDirectory() && !root.mkdirs()) throw new IOException("Storage unavailable");
        File target = new File(root, hash);
        if (verified(target, size, hash)) return target;
        long used = 0;
        File[] files = root.listFiles();
        if (files != null) for (File file : files) used += file.length();
        if (used + size > TOTAL_LIMIT || root.getUsableSpace() < size + 32L * 1024 * 1024)
            throw new IOException("Insufficient cache space");
        File partial = File.createTempFile("download-", ".part", root);
        HttpURLConnection connection = (HttpURLConnection) new URL((String) asset.get("url")).openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000); connection.setUseCaches(false);
        try {
            if (connection.getResponseCode() != 200 || connection.getContentLengthLong() != size)
                throw new IOException("Download length mismatch");
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
                byte[] buffer = new byte[32768]; int count; long written = 0;
                while ((count = input.read(buffer)) != -1) {
                    check(ticket); written += count;
                    if (written > size) throw new IOException("Oversized download");
                    output.write(buffer, 0, count);
                }
                output.getFD().sync();
            }
            if (!verified(partial, size, hash)) throw new IOException("Download integrity failure");
            synchronized (this) {
                check(ticket);
                Files.move(partial.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            }
            return target;
        } finally { connection.disconnect(); partial.delete(); }
    }
    @SuppressWarnings("unchecked")
    Map<String, Object> prepare(Map<String, Object> manifest, long ticket) throws Exception {
        synchronized (this) {
            check(ticket);
            Set<String> wanted = hashes(manifest); wanted.addAll(current);
            prune(wanted);
        }
        Map<String, Object> result = new HashMap<>(manifest);
        Map<String, Map<String, Object>> assets = new HashMap<>();
        List<List<Map<String, Object>>> regions = new ArrayList<>();
        for (List<Map<String, Object>> region : (List<List<Map<String, Object>>>) manifest.get("regions")) {
            List<Map<String, Object>> items = new ArrayList<>();
            for (Map<String, Object> item : region) {
                Map<String, Object> copy = new HashMap<>(item);
                copy.put("asset", local((Map<String, Object>) item.get("asset"), assets, ticket)); items.add(copy);
            }
            regions.add(items);
        }
        result.put("regions", regions);
        if (manifest.get("logo") != null) result.put("logo", local((Map<String, Object>) manifest.get("logo"), assets, ticket));
        check(ticket);
        return result;
    }
    private Map<String, Object> local(Map<String, Object> asset, Map<String, Map<String, Object>> assets, long ticket) throws Exception {
        String key = asset.get("id") + ":" + asset.get("generation");
        if (!assets.containsKey(key)) {
            Map<String, Object> copy = new HashMap<>(asset);
            copy.put("localFile", fetch(asset, ticket).getAbsolutePath()); assets.put(key, copy);
        }
        return assets.get(key);
    }
    @SuppressWarnings("unchecked")
    synchronized void retain(Map<String, Object> manifest) {
        current = hashes(manifest);
        prune(current);
    }
    @SuppressWarnings("unchecked")
    private static Set<String> hashes(Map<String, Object> manifest) {
        Set<String> keep = new HashSet<>();
        for (List<Map<String, Object>> region : (List<List<Map<String, Object>>>) manifest.get("regions"))
            for (Map<String, Object> item : region) keep.add(String.valueOf(((Map<?, ?>) item.get("asset")).get("sha256")));
        if (manifest.get("logo") instanceof Map) keep.add(String.valueOf(((Map<?, ?>) manifest.get("logo")).get("sha256")));
        return keep;
    }
    private void prune(Set<String> keep) {
        File[] files = root.listFiles();
        if (files != null) for (File file : files) if (!keep.contains(file.getName()) && !file.getName().endsWith(".part")) file.delete();
    }
}
