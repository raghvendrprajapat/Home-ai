package com.gharplan.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ProjectFilesPlugin.class);
        super.onCreate(savedInstanceState);
        // A developer can open the disposable lab through adb; release ignores this extra.
        if (BuildConfig.DEBUG && getIntent().getBooleanExtra("perf", false)
                && getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() ->
                getBridge().getWebView().loadUrl(getBridge().getLocalUrl() + "/perf")
            );
        }
    }
}
