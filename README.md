# PRIME Authenticator

PRIME Authenticator is available as an installable web app for Android, iPhone/iPad, and desktop browsers. Android also has a signed APK that opens the authenticator as a full-screen app without a browser address bar.

**Open or install:** [primegestionale.it/authenticator](https://primegestionale.it/authenticator/)

## Android APK

[Download PRIME Authenticator 0.4.0 APK](https://github.com/businessderuvo-cloud/prime-authenticator/releases/download/android-v0.4.0/prime-authenticator-android-v0.4.0.apk)

Install the APK and allow Android to install apps from the download source when prompted. If you already installed the earlier 0.3.1 debug APK, uninstall it first: Android does not allow updating an app signed with a different release key. The encrypted archive belongs to the browser origin and is not removed by uninstalling the APK; still keep an encrypted backup.

The Android app uses a verified Trusted Web Activity associated with `primegestionale.it` through Digital Asset Links. The association must remain available at `/.well-known/assetlinks.json` for the app to keep opening full-screen in Chrome.

## iPhone and iPad

Open the link in Safari, choose **Share** → **Add to Home Screen**, and enable **Open as Web App** if shown. The iOS distribution is the installable web app; no native IPA is published.

## Features

- Scan and approve PRIME login QR codes.
- Store TOTP codes offline in an encrypted, device-local vault.
- Unlock the vault with a platform passkey using device verification where browser, device, and PRF support it; otherwise use the vault password.
- Revoke paired devices from PRIME → Account security.

Biometric/passkey support depends on the device's screen lock and browser. Device biometrics are never sent to PRIME.

## PWA source archive

[Download the PWA source archive](https://github.com/businessderuvo-cloud/prime-authenticator/releases/latest/download/prime-authenticator-pwa-v0.4.0.zip)

This archive is source files, not an Android APK or iOS IPA. For QR pairing and approval, the PRIME service must be online.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the QR decoder license.