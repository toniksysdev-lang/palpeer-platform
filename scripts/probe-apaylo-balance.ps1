# Probe Apaylo GetBalance using credentials from repo-root .env (no secrets inlined).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) { throw ".env not found at $envFile" }

$map = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $i = $_.IndexOf('=')
  if ($i -lt 1) { return }
  $map[$_.Substring(0, $i).Trim()] = $_.Substring($i + 1).Trim()
}

$apiKey = $map['APAYLO_API_KEY']
$secret = $map['APAYLO_SHARED_KEY']
$sandbox = ($map['APAYLO_SANDBOX'] -eq 'true')
$base = if ($sandbox) { $map['APAYLO_SANDBOX_BASE_URL'] } else { $map['APAYLO_BASE_URL'] }
$path = $map['APAYLO_ACCOUNT_BALANCE_PATH']
if (-not $base) { $base = if ($sandbox) { 'https://sandboxapi.apaylo.com/sandboxapi.apaylo.com/api' } else { 'https://api.etransfer.apaylo.com/api.apaylo.com/api' } }
if (-not $path) { $path = '/Merchant/GetBalance' }

$date = [DateTime]::UtcNow.ToString('yyyy-MM-dd')
$concat = $apiKey + $secret + $date
$sha = [System.Security.Cryptography.SHA512]::Create()
$sig = [Convert]::ToBase64String($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($concat)))

$url = ($base.TrimEnd('/') + '/' + $path.TrimStart('/'))
Write-Host "GET $url (sandbox=$sandbox date=$date)"
$headers = @{ Key = $apiKey; Signature = $sig }
try {
  $resp = Invoke-WebRequest -Uri $url -Headers $headers -Method GET -TimeoutSec 45 -UseBasicParsing
  Write-Host "Status $($resp.StatusCode)"
  Write-Host $resp.Content
} catch {
  $r = $_.Exception.Response
  if ($r) {
    $stream = $r.GetResponseStream()
    $body = if ($stream) { (New-Object System.IO.StreamReader($stream)).ReadToEnd() } else { '' }
    Write-Host "HTTP $([int]$r.StatusCode): $body"
  } else {
    Write-Host $_.Exception.Message
  }
  exit 1
}
