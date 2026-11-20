$ErrorActionPreference = 'Continue'
Set-Location 'd:\projects\palpeer-platform\palpeer-mobile'
$env:EXPO_APPLE_ID = 'palpeerglobal@gmail.com'
$env:NODE_OPTIONS = '--dns-result-order=ipv4first'
$buildId = if ($args[0]) { $args[0] } else { '54e8aa20-8863-4108-9d4d-19f8c42757cd' }
Write-Host "EAS iOS submit for build $buildId" -ForegroundColor Cyan
Write-Host "Apple ID: $env:EXPO_APPLE_ID"
npx eas-cli submit --platform ios --id $buildId --profile production
Write-Host "Exit code: $LASTEXITCODE"
Read-Host 'Press Enter to close'
