# Starts the local stack for UI work:
#   - Spring Boot API on :8085
#   - Expo web (mobile) on :8081
#   - Phone-frame preview on :3333
#   - Admin Vite app on :5173
#
# Usage (from repo root):
#   powershell -File scripts\dev-all.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'backend'

function Start-NamedWindow([string]$Title, [string]$WorkingDirectory, [string]$Command) {
  $script = @"
Set-Location '$WorkingDirectory'
Write-Host '=== $Title ===' -ForegroundColor Cyan
$Command
"@
  Start-Process powershell -ArgumentList @('-NoExit', '-Command', $script) | Out-Null
}

Write-Host 'Starting PALPEER local apps...' -ForegroundColor Green

Start-NamedWindow 'PALPEER API :8085' $Backend @"
`$envFile = Join-Path '$Root' '.env'
if (Test-Path `$envFile) {
  Get-Content `$envFile | ForEach-Object {
    `$line = `$_.Trim()
    if (-not `$line -or `$line.StartsWith('#')) { return }
    if (`$line.StartsWith('export ')) { `$line = `$line.Substring(7).Trim() }
    `$eq = `$line.IndexOf('=')
    if (`$eq -lt 1) { return }
    `$name = `$line.Substring(0, `$eq).Trim()
    `$value = `$line.Substring(`$eq + 1).Trim().Trim('`"').Trim("'")
    if (-not [string]::IsNullOrWhiteSpace(`$name) -and -not [Environment]::GetEnvironmentVariable(`$name)) {
      Set-Item -Path ('Env:' + `$name) -Value `$value
    }
  }
  Write-Host 'Loaded repo-root .env into process environment' -ForegroundColor DarkGray
}
.\mvnw.cmd -pl palpeer-app -am install -DskipTests
if (`$LASTEXITCODE -ne 0) { Write-Host 'Backend install failed' -ForegroundColor Red; exit 1 }
Set-Location palpeer-app
`$env:SPRING_PROFILES_ACTIVE = 'dev'
`$env:SERVER_PORT = '8085'
..\mvnw.cmd spring-boot:run `"-Dspring-boot.run.jvmArguments=-Dfile.encoding=UTF-8`"
"@

Start-NamedWindow 'PALPEER Expo web :8081' (Join-Path $Root 'palpeer-mobile') @'
$env:EXPO_PUBLIC_ENV = 'development'
$env:EXPO_PUBLIC_API_BASE_URL = 'http://localhost:8085/api/v1'
$env:EXPO_PUBLIC_WS_URL = 'ws://localhost:8085/ws/websocket'
$env:EXPO_NO_TELEMETRY = '1'
npx expo start --web --port 8081
'@

Start-NamedWindow 'PALPEER Preview :3333' (Join-Path $Root 'palpeer-mobile') @'
node web-emulator/server.cjs --port=3333 --app=http://localhost:8081
'@

Start-NamedWindow 'PALPEER Admin :5173' (Join-Path $Root 'palpeer-admin-end') @'
npm run dev
'@

Write-Host ''
Write-Host 'Opened four terminal windows.' -ForegroundColor Green
Write-Host '  Mobile preview:  http://localhost:3333'
Write-Host '  Expo web raw:    http://localhost:8081'
Write-Host '  Backend API:     http://localhost:8085'
Write-Host '  Admin console:   http://localhost:5173'
Write-Host ''
Write-Host 'Wait for the API health check and Expo bundle before using the preview.'
