package com.descall.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Keeps the Capacitor WebView / mic session alive while a Descall call is
 * active and the user backgrounds the app. Without a real foreground
 * service Android aggressively freezes the WebView and WebRTC dies.
 */
public class CallForegroundService extends Service {
  public static final String CHANNEL_ID = "descall_call_keepalive";
  public static final int NOTIFICATION_ID = 48021;
  public static final String ACTION_START = "com.descall.app.CALL_KEEPALIVE_START";
  public static final String ACTION_STOP = "com.descall.app.CALL_KEEPALIVE_STOP";
  public static final String EXTRA_TITLE = "title";
  public static final String EXTRA_BODY = "body";

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent == null || ACTION_STOP.equals(intent.getAction())) {
      stopForegroundSafely();
      stopSelf();
      return START_NOT_STICKY;
    }

    String title = intent.getStringExtra(EXTRA_TITLE);
    String body = intent.getStringExtra(EXTRA_BODY);
    if (title == null || title.trim().isEmpty()) title = "Descall";
    if (body == null || body.trim().isEmpty()) body = "Call in progress";

    ensureChannel();
    Notification notification = buildNotification(title, body);

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            | ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        );
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            | ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        );
      } else {
        startForeground(NOTIFICATION_ID, notification);
      }
    } catch (Exception e) {
      // Fall back to plain FGS if typed start is rejected on this device.
      try {
        startForeground(NOTIFICATION_ID, notification);
      } catch (Exception ignored) {
        stopSelf();
        return START_NOT_STICKY;
      }
    }

    return START_STICKY;
  }

  @Override
  public void onDestroy() {
    stopForegroundSafely();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  private void stopForegroundSafely() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(STOP_FOREGROUND_REMOVE);
      } else {
        stopForeground(true);
      }
    } catch (Exception ignored) {
      /* ignore */
    }
  }

  private void ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
    if (existing != null) return;
    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "Ongoing calls",
      NotificationManager.IMPORTANCE_LOW
    );
    channel.setDescription("Keeps Descall voice and video calls alive in the background");
    channel.setShowBadge(false);
    nm.createNotificationChannel(channel);
  }

  private Notification buildNotification(String title, String body) {
    Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (launch == null) {
      launch = new Intent(this, MainActivity.class);
    }
    launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

    int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
    }
    PendingIntent contentIntent = PendingIntent.getActivity(this, 0, launch, pendingFlags);

    return new NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(body)
      .setSmallIcon(R.mipmap.descall_launcher)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(contentIntent)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build();
  }
}
