#!/usr/bin/env bash
set -euo pipefail
adb shell pm disable-user --user 0 com.android.chrome
adb install android/app/build/outputs/apk/debug/app-debug.apk
adb install android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell pm grant it.primegestionale.authenticator android.permission.CAMERA
adb shell am instrument -w -r -e class it.primegestionale.authenticator.NativeSecurityTest it.primegestionale.authenticator.test/androidx.test.runner.AndroidJUnitRunner | tee native-test-results.txt
grep -q 'OK (' native-test-results.txt
adb shell locksettings set-pin 1234
# Test-only emulator sensor input. The app still authenticates through Android's
# real BiometricPrompt and auth-per-use Keystore; there is no production bypass.
(
  while true; do
    request="$(adb shell cat /data/local/tmp/prime-finger-request 2>/dev/null | tr -d '\r' || true)"
    if [ -n "$request" ]; then
      if [ "$request" = enroll ]; then
        adb emu finger touch 1 >/dev/null
      else
        adb shell rm -f /data/local/tmp/prime-finger-request
        adb emu finger touch "$request" >/dev/null
      fi
    fi
    sleep 0.7
  done
) &
finger_pid=$!
cleanup() {
  code=$?
  kill "$finger_pid" 2>/dev/null || true
  if [ "$code" -ne 0 ]; then
    adb pull /sdcard/Android/data/it.primegestionale.authenticator/files/biometric-failure.xml biometric-failure.xml || true
    adb logcat -d -s AndroidRuntime:E BiometricPrompt:V FingerprintService:V > biometric-logcat.txt || true
  fi
}
trap cleanup EXIT
adb shell am instrument -w -r -e class 'it.primegestionale.authenticator.NativeBiometricTest#enrollEmulatorFingerprint' it.primegestionale.authenticator.test/androidx.test.runner.AndroidJUnitRunner | tee enrollment-test-results.txt
grep -q 'OK (' enrollment-test-results.txt
adb shell am instrument -w -r -e class 'it.primegestionale.authenticator.NativeBiometricTest#sensorActivationCancellationAndUnlock' it.primegestionale.authenticator.test/androidx.test.runner.AndroidJUnitRunner | tee biometric-test-results.txt
grep -q 'OK (' biometric-test-results.txt
kill "$finger_pid" 2>/dev/null || true
adb uninstall it.primegestionale.authenticator
adb logcat -c
adb install android/app/build/outputs/apk/release/app-release.apk
adb shell am start -W -n it.primegestionale.authenticator/.MainActivity
sleep 5
if adb logcat -d -s AndroidRuntime:E | grep -q 'FATAL EXCEPTION'; then
  adb logcat -d -s AndroidRuntime:E
  exit 1
fi
adb shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity' | grep -F 'it.primegestionale.authenticator/.MainActivity'
