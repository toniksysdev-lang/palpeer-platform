# Debug Android workflow: Metro hot reload (no release rebuild for JS/UI changes).
#
# First time / after native config changes: builds & installs a debug APK, then starts Metro.
# Day to day: skip the build with -SkipBuild if the debug app is already installed.
#
# Usage (from repo root):
#   powershell -File scripts\android-metro.ps1
#   powershell -File scripts\android-metro.ps1 -SkipBuild

param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Mobile = Join-Path $Root 'palpeer-mobile'
$Adb = if (Test-Path 'D:\android-sdk\platform-tools\adb.exe') {
  'D:\android-sdk\platform-tools\adb.exe'
} else {
  'adb'
}
$Emulator = 'D:\android-sdk\emulator\emulator.exe'

$env:ANDROID_HOME = 'D:\android-sdk'
$env:ANDROID_SDK_ROOT = 'D:\android-sdk'
$env:GRADLE_USER_HOME = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { 'D:\gradle-home' }
$env:ORG_GRADLE_PROJECT_reactNativeArchitectures = 'x86_64'
$env:EXPO_PUBLIC_ENV = 'development'
$env:EXPO_PUBLIC_API_BASE_URL = 'http://10.0.2.2:8085/api/v1'
$env:EXPO_PUBLIC_WS_URL = 'ws://10.0.2.2:8085/ws/websocket'
$env:EXPO_NO_TELEMETRY = '1'

Set-Location $Mobile

function Ensure-Emulator {
  $devices = & $Adb devices 2>$null | Select-String 'emulator-\d+\s+device'
  if ($devices) {
    Write-Host 'Emulator already attached.' -ForegroundColor Green
    return
  }
  Write-Host 'Starting AVD palpeer_e2e...' -ForegroundColor Cyan
  Start-Process -FilePath $Emulator -ArgumentList @(
    '-avd', 'palpeer_e2e',
    '-netdelay', 'none',
    '-netspeed', 'full',
    '-gpu', 'swiftshader_indirect'
  ) | Out-Null
  $deadline = (Get-Date).AddMinutes(4)
  do {
    Start-Sleep 5
    $devices = & $Adb devices 2>$null | Select-String 'emulator-\d+\s+device'
    if ($devices) { break }
    Write-Host 'Waiting for emulator...'
  } while ((Get-Date) -lt $deadline)
  if (-not $devices) { throw 'Emulator did not come online in time.' }
  & $Adb -e wait-for-device | Out-Null
  $bootDeadline = (Get-Date).AddMinutes(2)
  do {
    $boot = (& $Adb -e shell getprop sys.boot_completed 2>$null).Trim()
    if ($boot -eq '1') { break }
    Start-Sleep 3
  } while ((Get-Date) -lt $bootDeadline)
  Write-Host 'Emulator ready.' -ForegroundColor Green
}

Ensure-Emulator

if (-not $SkipBuild) {
  Write-Host 'Building & installing debug APK (one-time / native changes)...' -ForegroundColor Cyan
  npx expo run:android --no-bundler
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'expo run:android reported an error; installing the debug APK directly...' -ForegroundColor Yellow
    $apk = Join-Path $Mobile 'android\app\build\outputs\apk\debug\app-debug.apk'
    if (-not (Test-Path $apk)) { throw "Debug APK missing at $apk" }
    & $Adb -e install -r $apk
  }
} else {
  Write-Host 'Skipping debug build.' -ForegroundColor Cyan
}

# Unlock if the E2E PIN keyguard is up (PIN 1111).
& $Adb -e shell input keyevent KEYCODE_WAKEUP | Out-Null
& $Adb -e shell cmd statusbar collapse | Out-Null
$focus = & $Adb -e shell dumpsys window 2>$null | Select-String 'mCurrentFocus='
if ("$focus" -match 'NotificationShade|Keyguard') {
  & $Adb -e shell input swipe 540 2000 540 800 | Out-Null
  Start-Sleep 1
  & $Adb -e shell input text 1111 | Out-Null
  & $Adb -e shell input keyevent KEYCODE_ENTER | Out-Null
  Start-Sleep 1
}

& $Adb -e reverse tcp:8081 tcp:8081 | Out-Null
& $Adb -e shell pm enable com.palpeer.app | Out-Null
& $Adb -e shell am start -n com.palpeer.app/.MainActivity | Out-Null

Write-Host ''
Write-Host 'Starting Metro. Save a file to hot-reload on the emulator.' -ForegroundColor Green
Write-Host "API: $($env:EXPO_PUBLIC_API_BASE_URL)"
Write-Host 'Do not set CI=1 — that disables hot reload.'
Write-Host ''
Remove-Item Env:CI -ErrorAction SilentlyContinue
npx expo start --port 8081
