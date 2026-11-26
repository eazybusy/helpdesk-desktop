<#
.SYNOPSIS
  Runs as SYSTEM (scheduled task \ITSupport\RemoteAccess). For the newest ticket request the
  desktop app dropped in %ProgramData%\ITSupport\requests, sets a fresh RustDesk password and
  sends ID + password to the HelpDesk server. The employee never sees the password.

  The server accepts it only when the X-Agent-Key is valid AND the computer name matches the
  ticket's computer, so a forged request file can't attach this PC to someone else's ticket.
#>
$ErrorActionPreference = 'Stop'

$dataDir  = Join-Path $env:ProgramData 'ITSupport'
$requests = Join-Path $dataDir 'requests'
$logFile  = Join-Path $dataDir 'remote-access.log'
$rustdesk = Join-Path $env:ProgramFiles 'RustDesk\rustdesk.exe'

function Log([string] $msg) {
    $line = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $msg
    Add-Content -Path $logFile -Value $line -Encoding UTF8
    # keep the log small
    if ((Get-Item $logFile).Length -gt 256KB) { Get-Content $logFile -Tail 500 | Set-Content $logFile -Encoding UTF8 }
}

$files = @(Get-ChildItem -Path $requests -File -ErrorAction SilentlyContinue)
if ($files.Count -eq 0) { exit 0 }

# Only the newest valid request counts; everything else is removed.
$valid = $files | Where-Object { $_.Name -match '^\d{1,10}\.req$' -and $_.LastWriteTime -gt (Get-Date).AddMinutes(-15) } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
$files | Remove-Item -Force -ErrorAction SilentlyContinue
if (-not $valid) { exit 0 }
$ticketId = [int64]$valid.BaseName

try {
    $cfg = Get-ItemProperty 'HKLM:\SOFTWARE\Policies\ITSupport'
    $agentKey = (Get-ItemProperty 'HKLM:\SOFTWARE\ITSupport\Agent').AgentKey
    if (-not $cfg.ApiUrl -or -not $agentKey) { throw 'ApiUrl or AgentKey missing' }
    if (-not (Test-Path $rustdesk)) { throw 'RustDesk is not installed' }

    # 10 characters, no look-alikes (0/O, 1/l/I), from a cryptographic RNG.
    $alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'.ToCharArray()
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $limit = 256 - (256 % $alphabet.Length)   # reject the tail so every character is equally likely
    $chars = New-Object System.Collections.Generic.List[char]
    $byte = New-Object byte[] 1
    while ($chars.Count -lt 10) {
        $rng.GetBytes($byte)
        if ($byte[0] -lt $limit) { $chars.Add($alphabet[$byte[0] % $alphabet.Length]) }
    }
    $password = -join $chars

    # rustdesk.exe is a GUI program: wait for it explicitly.
    $p = Start-Process -FilePath $rustdesk -ArgumentList '--password', $password -WindowStyle Hidden -PassThru -Wait
    if ($p.ExitCode -ne 0) { throw "rustdesk --password exited with $($p.ExitCode)" }
    $rustdeskId = ((& $rustdesk --get-id | Out-String) -replace '\s', '')
    if ($rustdeskId -notmatch '^[A-Za-z0-9_-]{6,32}$') { throw "unexpected RustDesk ID '$rustdeskId'" }

    $body = @{
        hostname     = [System.Net.Dns]::GetHostName()
        netbios      = $env:COMPUTERNAME
        rustdesk_id  = $rustdeskId
        password     = $password
    } | ConvertTo-Json -Compress

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-RestMethod -Method Post -Uri ('{0}/api/tickets/{1}/remote' -f $cfg.ApiUrl.TrimEnd('/'), $ticketId) `
        -Headers @{ 'X-Agent-Key' = $agentKey } -ContentType 'application/json; charset=utf-8' `
        -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 20 -UseBasicParsing | Out-Null

    Log "ticket $ticketId -> RustDesk $rustdeskId, password sent"
}
catch {
    Log "ticket ${ticketId}: $($_.Exception.Message)"
    exit 1
}
