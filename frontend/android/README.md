# Descall Android release

The Android app uses Capacitor and the package ID `com.descall.app`.

## Local development

```bash
npm run android:sync
npm run android:apk:debug
```

The debug APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Secure direct-release APK

Create a durable signing key once and store its password in a password manager:

```bash
keytool -genkeypair -v \
  -keystore ../secrets/descall-release.jks \
  -alias descall-release \
  -keyalg RSA -keysize 4096 -validity 10000
```

Copy `keystore.properties.example` to `keystore.properties`, replace every
placeholder, then run:

```bash
npm run android:apk:release
```

Never commit the keystore, `keystore.properties`, or a Firebase
`google-services.json`. Losing the signing key prevents future updates to
the same Android application.

## Firebase stage

When the Descall Firebase project is created, add its Android app with
package ID `com.descall.app`, download `google-services.json` into
`android/app/`, then add the native FCM integration. This is required for
reliable background call and message notifications; browser Web Push alone
is not sufficient for a native Android app.
