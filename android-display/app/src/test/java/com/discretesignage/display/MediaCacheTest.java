package com.discretesignage.display;

import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import java.io.File;
import java.nio.file.Files;
import java.util.*;
import static org.junit.Assert.*;

public class MediaCacheTest {
    @Rule public TemporaryFolder temp = new TemporaryFolder();
    @Test public void corruptOrIncompleteFilesNeverPassVerification() throws Exception {
        File file = temp.newFile(); Files.write(file.toPath(), new byte[]{1, 2, 3});
        String hash = MediaCache.digest(file);
        assertTrue(MediaCache.verified(file, 3, hash));
        assertFalse(MediaCache.verified(file, 4, hash));
        assertFalse(MediaCache.verified(file, 3, "../bad"));
        Files.write(file.toPath(), new byte[]{3, 2, 1});
        assertFalse(MediaCache.verified(file, 3, hash));
        assertFalse(MediaCache.verified(file, MediaCache.FILE_LIMIT + 1, hash));
    }
    @Test public void regionsAndLogoShareVerifiedFilesAndRevocationCancelsPreparation() throws Exception {
        File root = temp.newFolder(); File source = new File(root, "source");
        Files.write(source.toPath(), new byte[]{1, 2, 3}); String hash = MediaCache.digest(source);
        File target = new File(root, hash); Files.move(source.toPath(), target.toPath());
        Map<String, Object> asset = Map.of("id", "test", "generation", "1", "sha256", hash, "size", target.length(),
                "url", "https://storage.googleapis.com/discretesignage.firebasestorage.app/businesses/b/media/test");
        Map<String, Object> manifest = Map.of("regions", List.of(List.of(Map.of("asset", asset)), List.of(Map.of("asset", asset))), "logo", asset);
        MediaCache cache = new MediaCache(root); long ticket = cache.ticket();
        Map<String, Object> prepared = cache.prepare(manifest, ticket);
        assertEquals(target.getAbsolutePath(), ((Map<?, ?>) prepared.get("logo")).get("localFile"));
        assertEquals(1, root.list().length);
        File stale = new File(root, "stale"); Files.write(stale.toPath(), new byte[]{0});
        cache.retain(prepared); assertFalse(stale.exists()); assertTrue(target.exists());
        cache.clear(); assertFalse(target.exists());
        assertThrows(java.io.IOException.class, () -> cache.prepare(manifest, ticket));
    }
}
