#!/usr/bin/env bash
set -euo pipefail
adb shell pm disable-user --user 0 com.android.chrome
adb install android/app/build/outputs/apk/debug/app-debug.apk
adb install android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w -r it.primegestionale.authenticator.test/androidx.test.runner.AndroidJUnitRunner | tee native-test-results.txt
grep -q 'OK (' native-test-results.txt
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
