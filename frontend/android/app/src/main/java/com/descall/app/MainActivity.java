package com.descall.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(CallKeepAlivePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
