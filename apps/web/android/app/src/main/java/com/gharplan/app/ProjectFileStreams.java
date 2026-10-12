package com.gharplan.app;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Bounded streaming verification, independent of Android provider behavior. */
final class ProjectFileStreams {
    static final int MAX_BYTES = 10 * 1024 * 1024;
    static void check(InputStream input, OutputStream output, long expectedBytes, String expectedHash) throws IOException {
        if (expectedBytes < 1 || expectedBytes > MAX_BYTES || expectedHash == null || !expectedHash.matches("[a-f0-9]{64}")) throw new IOException("Invalid export limits");
        MessageDigest digest;
        try { digest = MessageDigest.getInstance("SHA-256"); } catch (NoSuchAlgorithmException e) { throw new IOException("Checksum unavailable", e); }
        byte[] buffer = new byte[8192]; long total = 0; int stalled = 0, count;
        while ((count = input.read(buffer)) != -1) {
            if (count == 0) { if (++stalled > 16) throw new IOException("Source stalled"); continue; }
            stalled = 0; total += count;
            if (total > expectedBytes || total > MAX_BYTES) throw new IOException("Unexpected export length");
            digest.update(buffer, 0, count); if (output != null) output.write(buffer, 0, count);
        }
        StringBuilder hash = new StringBuilder(); for (byte b : digest.digest()) hash.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
        if (total != expectedBytes || !hash.toString().equals(expectedHash)) throw new IOException("Export checksum or length differs");
        if (output != null) output.flush();
    }
}
