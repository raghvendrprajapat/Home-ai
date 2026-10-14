package com.gharplan.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "ProjectFiles")
public class ProjectFilesPlugin extends Plugin {
    // Provider stalls must not block the main thread or Capacitor/autosave queue.
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final AtomicBoolean pending = new AtomicBoolean(false);

    private File source(PluginCall call) throws IOException {
        return ProjectFileSource.resolve(getContext().getCacheDir(), call.getString("path", ""), call.getString("format", "json"));
    }
    private long size(PluginCall call) throws IOException {
        Object value = call.getData().opt("bytes");
        if (!(value instanceof Number)) throw new IOException("Invalid export length");
        double n = ((Number) value).doubleValue();
        if (!Double.isFinite(n) || n != Math.rint(n) || n < 1 || n > ProjectFileStreams.MAX_BYTES) throw new IOException("Invalid export length");
        return (long) n;
    }
    private void reject(PluginCall call, String code) { pending.set(false); call.reject("Export was not verified; original drawing is retained.", code); }

    @PluginMethod
    public void save(PluginCall call) {
        if (!pending.compareAndSet(false, true)) { call.reject("Another export is pending.", "EXPORT_BUSY"); return; }
        io.execute(() -> {
            try {
                try (InputStream input = new FileInputStream(source(call))) { ProjectFileStreams.check(input, null, size(call), call.getString("sha256")); }
                if ("png".equals(call.getString("format", "json"))) { try (InputStream input = new FileInputStream(source(call))) { ProjectPngSource.check(input); } }
                getBridge().executeOnMainThread(() -> {
                    try {
                        boolean png = "png".equals(call.getString("format", "json"));
                        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(png ? "image/png" : "application/json");
                        intent.putExtra(Intent.EXTRA_TITLE, png ? "gharplan-plan.png" : "gharplan-project.json");
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                        startActivityForResult(call, intent, "destination");
                    } catch (Exception e) { reject(call, "EXPORT_PICKER"); }
                });
            } catch (Exception e) { reject(call, "EXPORT_SOURCE"); }
        });
    }
    @ActivityCallback
    private void destination(PluginCall call, ActivityResult result) {
        if (call == null) { pending.set(false); return; }
        if (result.getResultCode() != Activity.RESULT_OK) { reject(call, "EXPORT_CANCELLED"); return; }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (uri == null || !"content".equals(uri.getScheme())) { reject(call, "EXPORT_DESTINATION"); return; }
        io.execute(() -> {
            try {
                try (InputStream input = new FileInputStream(source(call)); OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (output == null) throw new IOException("Destination unavailable");
                    ProjectFileStreams.check(input, output, size(call), call.getString("sha256"));
                }
                try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
                    if (input == null) throw new IOException("Destination readback unavailable");
                    ProjectFileStreams.check(input, null, size(call), call.getString("sha256"));
                }
                JSObject receipt = new JSObject(); receipt.put("verified", true); receipt.put("bytes", size(call)); receipt.put("sha256", call.getString("sha256"));
                pending.set(false); call.resolve(receipt);
            } catch (Exception e) { reject(call, "EXPORT_WRITE"); }
        });
    }
    @Override protected void handleOnDestroy() { io.shutdownNow(); }
}
