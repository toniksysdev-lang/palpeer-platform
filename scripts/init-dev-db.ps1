# Requires: PostgreSQL client tools (psql).
# Creates role + database for local PALPEER development.

param(
    [string]$PgHost = "localhost",
    [int]$Port = 5432,
    [string]$SuperUser = "postgres",
    [string]$SuperPassword = "postgres",
    [string]$DbName = "palpeer",
    [string]$AppUser = "palpeer",
    [string]$AppPassword = "palpeer"
)

$ErrorActionPreference = "Stop"

$psql = $null
$cmd = Get-Command psql -ErrorAction SilentlyContinue
if ($cmd) { $psql = $cmd.Source }
if (-not $psql) {
    foreach ($ver in @("18", "17", "16", "15")) {
        $candidate = Join-Path $env:ProgramFiles "PostgreSQL\$ver\bin\psql.exe"
        if (Test-Path -LiteralPath $candidate) {
            $psql = $candidate
            break
        }
    }
}
if (-not $psql) {
    Write-Error "psql not found. Install PostgreSQL first (winget install PostgreSQL.PostgreSQL.17)."
}

Write-Host "Using $psql"
$env:PGPASSWORD = $SuperPassword

function Invoke-Sql([string]$Database, [string]$Sql) {
    $result = & $psql -h $PgHost -p $Port -U $SuperUser -d $Database -v ON_ERROR_STOP=1 -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed ($Database): $result"
    }
    return $result
}

function Scalar([string]$Sql) {
    $raw = & $psql -h $PgHost -p $Port -U $SuperUser -d postgres -t -A -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "psql scalar failed: $raw"
    }
    if ($null -eq $raw) { return "" }
    return ([string]$raw).Trim()
}

Write-Host "Ensuring role '$AppUser' exists..."
if ((Scalar "SELECT 1 FROM pg_roles WHERE rolname='$AppUser'") -ne "1") {
    Invoke-Sql "postgres" "CREATE ROLE $AppUser LOGIN PASSWORD '$AppPassword';" | Out-Null
} else {
    Invoke-Sql "postgres" "ALTER ROLE $AppUser WITH LOGIN PASSWORD '$AppPassword';" | Out-Null
}

Write-Host "Ensuring database '$DbName' exists..."
if ((Scalar "SELECT 1 FROM pg_database WHERE datname='$DbName'") -ne "1") {
    Invoke-Sql "postgres" "CREATE DATABASE $DbName OWNER $AppUser;" | Out-Null
} else {
    Invoke-Sql "postgres" "ALTER DATABASE $DbName OWNER TO $AppUser;" | Out-Null
}

Invoke-Sql $DbName "GRANT ALL ON SCHEMA public TO $AppUser;" | Out-Null
Invoke-Sql $DbName "ALTER SCHEMA public OWNER TO $AppUser;" | Out-Null

Write-Host "Done. JDBC: jdbc:postgresql://${PgHost}:${Port}/${DbName} user=$AppUser"
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
