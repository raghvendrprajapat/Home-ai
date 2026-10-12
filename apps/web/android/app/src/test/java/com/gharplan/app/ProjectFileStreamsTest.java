package com.gharplan.app;
import static org.junit.Assert.*;
import org.junit.Test;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
public class ProjectFileStreamsTest {
    private String hash(byte[] bytes) throws Exception {
        StringBuilder value = new StringBuilder(); for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes)) value.append(String.format(java.util.Locale.ROOT, "%02x", b & 255)); return value.toString();
    }
    @Test public void exactUtf8CopyAndReadback() throws Exception {
        byte[] data = "{\"name\":\"मेरा घर\"}".getBytes(StandardCharsets.UTF_8); ByteArrayOutputStream output = new ByteArrayOutputStream();
        ProjectFileStreams.check(new ByteArrayInputStream(data), output, data.length, hash(data)); assertArrayEquals(data, output.toByteArray());
        ProjectFileStreams.check(new ByteArrayInputStream(output.toByteArray()), null, data.length, hash(data));
        ProjectFileStreams.check(new ByteArrayInputStream("abc".getBytes(StandardCharsets.UTF_8)), null, 3, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }
    @Test public void partialChangedOversizedAndInvalidLimitsFail() throws Exception {
        byte[] data = "abcdef".getBytes(StandardCharsets.UTF_8); String hash = hash(data);
        assertThrows(IOException.class, () -> ProjectFileStreams.check(new ByteArrayInputStream(data), null, data.length - 1, hash));
        assertThrows(IOException.class, () -> ProjectFileStreams.check(new ByteArrayInputStream(data), null, data.length + 1, hash));
        assertThrows(IOException.class, () -> ProjectFileStreams.check(new ByteArrayInputStream(data), null, data.length, "0".repeat(64)));
        assertThrows(IOException.class, () -> ProjectFileStreams.check(new ByteArrayInputStream(data), null, ProjectFileStreams.MAX_BYTES + 1L, hash));
        assertThrows(IOException.class, () -> ProjectFileStreams.check(new ByteArrayInputStream(data), null, data.length, "invalid"));
    }
    @Test public void stalledOrFailedStreamsDoNotReportSuccess() throws Exception {
        InputStream stalled = new InputStream() { public int read() { return 0; } public int read(byte[] b) { return 0; } };
        assertThrows(IOException.class, () -> ProjectFileStreams.check(stalled, null, 1, "0".repeat(64)));
        InputStream failed = new InputStream() { public int read() throws IOException { throw new IOException("Provider failed"); } };
        assertThrows(IOException.class, () -> ProjectFileStreams.check(failed, null, 1, "0".repeat(64)));
        byte[] data = { 1 }; OutputStream sink = new OutputStream() { public void write(int b) throws IOException { throw new IOException("Write failed"); } };
        assertThrows(IOException.class, () -> ProjectFileStreams.check(new ByteArrayInputStream(data), sink, 1, hash(data)));
    }
}
