# Seed sample platform data + smoke-test admin CRUD against local API.
# Requires backend at http://localhost:8085 and admin@palpeer.local / Admin123!

$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8085/api/v1'

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{},
        $Body = $null,
        [int[]]$OkStatuses = @(200, 201)
    )
    $params = @{
        Uri = "$base$Path"
        Method = $Method
        Headers = $Headers
        ContentType = 'application/json'
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
    }
    try {
        $resp = Invoke-WebRequest @params
        $json = $resp.Content | ConvertFrom-Json
        return @{ status = [int]$resp.StatusCode; body = $json }
    } catch {
        $status = 0
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode.value__
        }
        $raw = $_.ErrorDetails.Message
        if ($OkStatuses -contains $status) {
            try { return @{ status = $status; body = ($raw | ConvertFrom-Json) } } catch { return @{ status = $status; body = $raw } }
        }
        throw "API $Method $Path failed ($status): $raw"
    }
}

Write-Host '== Login =='
$login = Invoke-Api -Method Post -Path '/auth/login' -Body @{ email = 'admin@palpeer.local'; password = 'Admin123!' }
$token = $login.body.data.accessToken
$h = @{ Authorization = "Bearer $token" }
Write-Host 'Logged in as admin@palpeer.local'

Write-Host '== Seed sample users =='
$sampleUsers = @(
    @{ email = 'alice@palpeer.local'; phone = '+2348000000011'; password = 'Sample123!' },
    @{ email = 'bob@palpeer.local'; phone = '+2348000000012'; password = 'Sample123!' },
    @{ email = 'carol@palpeer.local'; phone = '+2348000000013'; password = 'Sample123!' },
    @{ email = 'dave@palpeer.local'; phone = '+2348000000014'; password = 'Sample123!' }
)
foreach ($u in $sampleUsers) {
    try {
        $r = Invoke-Api -Method Post -Path '/auth/register' -Body $u -OkStatuses @(200, 201, 409, 400)
        Write-Host ("  register {0}: status={1} msg={2}" -f $u.email, $r.status, $r.body.message)
    } catch {
        Write-Host ("  register {0}: {1}" -f $u.email, $_.Exception.Message)
    }
}

Write-Host '== Seed currencies =='
$currencies = @(
    @{ code = 'NGN'; symbol = 'N'; precision = 2 },
    @{ code = 'CAD'; symbol = 'C$'; precision = 2 },
    @{ code = 'USD'; symbol = '$'; precision = 2 },
    @{ code = 'GBP'; symbol = 'GBP'; precision = 2 }
)
foreach ($c in $currencies) {
    try {
        $r = Invoke-Api -Method Post -Path '/admin/currencies' -Headers $h -Body $c -OkStatuses @(200, 201, 409, 400)
        Write-Host ("  currency {0}: status={1} msg={2}" -f $c.code, $r.status, $r.body.message)
    } catch {
        Write-Host ("  currency {0}: {1}" -f $c.code, $_.Exception.Message)
    }
}

Write-Host '== Seed exchange rates =='
$now = [DateTimeOffset]::UtcNow.ToString('o')
$rates = @(
    @{ baseCurrencyCode = 'NGN'; quoteCurrencyCode = 'CAD'; buyRate = 0.00095; sellRate = 0.00105; effectiveDate = $now },
    @{ baseCurrencyCode = 'CAD'; quoteCurrencyCode = 'NGN'; buyRate = 950; sellRate = 1050; effectiveDate = $now },
    @{ baseCurrencyCode = 'USD'; quoteCurrencyCode = 'NGN'; buyRate = 1450; sellRate = 1550; effectiveDate = $now }
)
foreach ($rate in $rates) {
    try {
        $r = Invoke-Api -Method Post -Path '/admin/rates' -Headers $h -Body $rate -OkStatuses @(200, 201, 409, 400)
        Write-Host ("  rate {0}/{1}: status={2} msg={3}" -f $rate.baseCurrencyCode, $rate.quoteCurrencyCode, $r.status, $r.body.message)
    } catch {
        Write-Host ("  rate {0}/{1}: {2}" -f $rate.baseCurrencyCode, $rate.quoteCurrencyCode, $_.Exception.Message)
    }
}

Write-Host '== CRUD smoke tests =='
$users = Invoke-Api -Method Get -Path '/admin/users?page=0&size=20' -Headers $h
Write-Host ("  LIST users: total={0}" -f $users.body.data.totalElements)

$sample = $users.body.data.content | Where-Object { $_.email -eq 'alice@palpeer.local' } | Select-Object -First 1
if (-not $sample) {
    $sample = $users.body.data.content | Where-Object { $_.email -ne 'admin@palpeer.local' } | Select-Object -First 1
}
if (-not $sample) { throw 'No sample user found for update smoke test' }

$userId = $sample.id
$get = Invoke-Api -Method Get -Path "/admin/users/$userId" -Headers $h
Write-Host ("  GET user: email={0} status={1}" -f $get.body.data.email, $get.body.data.status)

$upd = Invoke-Api -Method Put -Path "/admin/users/$userId" -Headers $h -Body @{ status = 'ACTIVE'; enabled = $true }
Write-Host ("  UPDATE user: status={0} enabled={1}" -f $upd.body.data.status, $upd.body.data.enabled)

$kyc = Invoke-Api -Method Get -Path '/admin/kyc/cases?page=0&size=5' -Headers $h
Write-Host ("  LIST kyc: total={0}" -f $kyc.body.data.totalElements)

$p2pReq = Invoke-Api -Method Get -Path '/admin/p2p/requests' -Headers $h
$p2pOrd = Invoke-Api -Method Get -Path '/admin/p2p/orders' -Headers $h
Write-Host ("  LIST p2p requests={0} orders={1}" -f $p2pReq.body.data.Count, $p2pOrd.body.data.Count)

$admins = Invoke-Api -Method Get -Path '/admin/admins' -Headers $h
Write-Host ("  LIST admins: count={0}" -f $admins.body.data.Count)

$tx = Invoke-Api -Method Get -Path "/admin/users/$userId/transactions/recent?limit=5" -Headers $h
Write-Host ("  LIST recent txs: count={0}" -f $tx.body.data.Count)

$audit = Invoke-Api -Method Get -Path '/admin/audit-logs?page=0&size=5' -Headers $h -OkStatuses @(200, 403)
Write-Host ("  LIST audit: status={0}" -f $audit.status)

Write-Host '== DONE =='
Write-Host 'Admin login: admin@palpeer.local / Admin123!'
