# Collects disks, volumes and printers for the HelpDesk ticket snapshot.
# Runs as the signed-in user (no admin). Windows PowerShell 5.1 compatible. Prints one JSON object.
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Map-Media($m, $bus) {
    if ("$bus" -eq 'NVMe' -or "$bus" -eq '17') { return 'NVMe' }
    switch ("$m") { 'HDD' { 'HDD' } '3' { 'HDD' } 'SSD' { 'SSD' } '4' { 'SSD' } default { 'Unknown' } }
}
function Map-Bus($b) {
    switch ("$b") { '17' { 'NVMe' } '11' { 'SATA' } '7' { 'USB' } '8' { 'RAID' } '10' { 'SAS' } '3' { 'ATA' } default { "$b" } }
}
function Map-Health($h) {
    switch ("$h") { 'Healthy' { 'Healthy' } '0' { 'Healthy' } 'Warning' { 'Warning' } '1' { 'Warning' } 'Unhealthy' { 'Unhealthy' } '2' { 'Unhealthy' } default { 'Unknown' } }
}

# ---- physical disks ----
$disks = @()
foreach ($d in @(Get-PhysicalDisk)) {
    $rel = $null
    try { $rel = $d | Get-StorageReliabilityCounter -ErrorAction Stop } catch { }   # admin only
    $disks += [ordered]@{
        model         = ("$($d.FriendlyName)").Trim()
        media         = Map-Media $d.MediaType $d.BusType
        bus           = Map-Bus $d.BusType
        size_gb       = [math]::Round([double]$d.Size / 1GB, 1)
        health        = Map-Health $d.HealthStatus
        wear_percent  = $(if ($rel -and $null -ne $rel.Wear) { [int]$rel.Wear } else { $null })
        temperature_c = $(if ($rel -and $rel.Temperature) { [int]$rel.Temperature } else { $null })
    }
}
# Fallback for machines where the Storage module is unavailable
if ($disks.Count -eq 0) {
    foreach ($d in @(Get-CimInstance Win32_DiskDrive)) {
        $disks += [ordered]@{
            model = "$($d.Model)".Trim(); media = 'Unknown'; bus = "$($d.InterfaceType)"
            size_gb = [math]::Round([double]$d.Size / 1GB, 1)
            health = $(if ("$($d.Status)" -eq 'OK') { 'Healthy' } elseif ($d.Status) { 'Warning' } else { 'Unknown' })
            wear_percent = $null; temperature_c = $null
        }
    }
}

# ---- volumes (local fixed drives) ----
$volumes = @()
foreach ($v in @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3')) {
    if (-not $v.Size) { continue }
    $volumes += [ordered]@{
        letter   = "$($v.DeviceID)"
        label    = $(if ($v.VolumeName) { "$($v.VolumeName)" } else { $null })
        total_gb = [math]::Round([double]$v.Size / 1GB, 1)
        free_gb  = [math]::Round([double]$v.FreeSpace / 1GB, 1)
    }
}

# ---- printers ----
$jobCounts = @{}
foreach ($j in @(Get-CimInstance Win32_PrintJob)) {
    # Name is "<printer>, <job id>"; printer names may contain commas themselves
    $pn = ("$($j.Name)" -replace ',\s*\d+$', '').Trim()
    $jobCounts[$pn] = 1 + [int]$jobCounts[$pn]
}
$tcpHosts = @{}
foreach ($port in @(Get-CimInstance Win32_TCPIPPrinterPort)) { $tcpHosts["$($port.Name)"] = "$($port.HostAddress)" }

$printers = @()
foreach ($p in @(Get-CimInstance Win32_Printer)) {
    $name = "$($p.Name)"
    $virtual = ($name + ' ' + $p.DriverName + ' ' + $p.PortName) -match 'PDF|XPS|OneNote|Fax|PORTPROMPT|SHRFAX|nul:'

    # Precedence: hard error states > offline > paused > printing > ready
    $state = 'ready'
    switch ([int]$p.ExtendedPrinterStatus) { 4 { $state = 'printing' } 8 { $state = 'paused' } 9 { $state = 'error' } 7 { $state = 'offline' } 6 { $state = 'error' } }
    if ($p.WorkOffline) { $state = 'offline' }
    switch ([int]$p.DetectedErrorState) {
        4 { $state = 'no_paper' } 5 { $state = 'low_toner' } 6 { $state = 'no_toner' } 7 { $state = 'door_open' }
        8 { $state = 'paper_jam' } 9 { $state = 'offline' } 10 { $state = 'error' } 11 { $state = 'error' }
    }

    $reachable = $null
    $hostAddr = $tcpHosts["$($p.PortName)"]
    if (-not $virtual -and $hostAddr) {
        try { $reachable = ((New-Object System.Net.NetworkInformation.Ping).Send($hostAddr, 700).Status -eq 'Success') } catch { $reachable = $false }
    }

    $printers += [ordered]@{
        name       = $name
        state      = $state
        is_default = [bool]$p.Default
        is_network = [bool]($p.Network -or $hostAddr -or $name.StartsWith('\\'))
        port       = $(if ($hostAddr) { $hostAddr } elseif ($p.PortName) { "$($p.PortName)" } else { $null })
        driver     = $(if ($p.DriverName) { "$($p.DriverName)" } else { $null })
        jobs       = [int]$jobCounts[$name]
        reachable  = $reachable
        virtual    = [bool]$virtual
    }
}

[ordered]@{ disks = @($disks); volumes = @($volumes); printers = @($printers) } | ConvertTo-Json -Depth 4 -Compress
