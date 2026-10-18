$ErrorActionPreference = 'Continue'
Set-Location 'd:\projects\palpeer-platform\palpeer-mobile'
$env:EAS_SKIP_AUTO_FINGERPRINT = '1'
$env:EAS_BUILD_NO_EXPO_GO_WARNING = 'true'
# Node on this machine fails IPv6 lookups for appstoreconnect.apple.com (ENOENT). Prefer IPv4.
$env:NODE_OPTIONS = (($env:NODE_OPTIONS, '--dns-result-order=ipv4first') | Where-Object { $_ } | Select-Object -Unique) -join ' '
# Apple Developer account for this project (distinct from Expo login email).
if (-not $env:EXPO_APPLE_ID) { $env:EXPO_APPLE_ID = 'toniksystems@gmail.com' }
Write-Host 'EAS iOS TestFlight build — complete any Apple Developer prompts below.' -ForegroundColor Cyan
Write-Host "NODE_OPTIONS=$($env:NODE_OPTIONS)" -ForegroundColor DarkGray
Write-Host "EXPO_APPLE_ID=$($env:EXPO_APPLE_ID)" -ForegroundColor DarkGray
Write-Host ''
npx eas-cli build --platform ios --profile production --auto-submit
Write-Host ''
Write-Host 'Finished. Press Enter to close.' -ForegroundColor Cyan
Read-Host
