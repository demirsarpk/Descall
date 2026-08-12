package com.descall.app;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CallKeepAlive")
public class CallKeepAlivePlugin extends Plugin {
  @PluginMethod
  public void start(PluginCall call) {
    String title = call.getString("title", "Descall");
    String body = call.getString("body", "Call in progress");

    Intent intent = new Intent(getContext(), CallForegroundService.class);
    intent.setAction(CallForegroundService.ACTION_START);
    intent.putExtra(CallForegroundService.EXTRA_TITLE, title);
    intent.putExtra(CallForegroundService.EXTRA_BODY, body);

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        getContext().startForegroundService(intent);
      } else {
        getContext().startService(intent);
      }
      call.resolve();
    } catch (Exception e) {
      call.reject("Failed to start call keep-alive: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void stop(PluginCall call) {
    Intent intent = new Intent(getContext(), CallForegroundService.class);
    intent.setAction(CallForegroundService.ACTION_STOP);
    try {
      getContext().startService(intent);
      getContext().stopService(new Intent(getContext(), CallForegroundService.class));
      call.resolve();
    } catch (Exception e) {
      call.reject("Failed to stop call keep-alive: " + e.getMessage(), e);
    }
  }
}
