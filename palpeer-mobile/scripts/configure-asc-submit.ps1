$ErrorActionPreference = 'Continue'
Set-Location 'd:\projects\palpeer-platform\palpeer-mobile'
$env:EXPO_APPLE_ID = 'palpeerglobal@gmail.com'
$env:NODE_OPTIONS = '--dns-result-order=ipv4first'
Write-Host 'Configure App Store Connect API key for EAS Submit...' -ForegroundColor Cyan
Write-Host "Apple ID: $env:EXPO_APPLE_ID"
# Interactive credentials menu — choose iOS → production → App Store Connect API Key
npx eas-cli credentials -p ios
Write-Host "Exit code: $LASTEXITCODE"
Read-Host 'Press Enter to close'
