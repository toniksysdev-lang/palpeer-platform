# Submit the latest (or given) Android production AAB to Google Play via EAS.
# Requires secrets/google-play-service-account.json (Play Console API access) and
# eas.json submit.production.android.
param(
  [string]$BuildId = "",
  [string]$Profile = "production"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$key = Join-Path (Resolve-Path ..\secrets -ErrorAction SilentlyContinue) "google-play-service-account.json"
if (-not (Test-Path $key)) {
  Write-Error @"
Missing Play API service account JSON at:
  d:\projects\palpeer-platform\secrets\google-play-service-account.json

Create a Google Cloud service account with Play Developer API access, download the JSON,
add it in Play Console → Users and permissions, then save the file at that path.
"@
}

$args = @(
  "eas-cli", "submit",
  "--platform", "android",
  "--profile", $Profile,
  "--non-interactive"
)
if ($BuildId) {
  $args += @("--id", $BuildId)
} else {
  $args += "--latest"
}

Write-Host "Submitting Android build to Play ($Profile / internal draft)…"
npx @args
