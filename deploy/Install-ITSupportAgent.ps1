<#
.SYNOPSIS
  Prepares a PC for the IT Support desktop app. Run as a GPO *computer startup script* (it runs as SYSTEM).

.DESCRIPTION
  - HKLM\SOFTWARE\Policies\ITSupport  ApiUrl, DeviceKey   (readable by users; the app reads them)
  - HKLM\SOFTWARE\ITSupport\Agent     AgentKey            (SYSTEM + Administrators only)
  - %ProgramFiles%\ITSupport\RemoteAccess.ps1             (the task's script; users can't change it)
  - %ProgramData%\ITSupport\requests                      (the app drops <ticket id>.req here)
  - Scheduled task \ITSupport\RemoteAccess, runs as SYSTEM; users may start it but not change it.
  - HKLM\...\Run  ITSupport = "<app> --hidden"   (the app starts in the tray at sign-in, so ticket
    notifications arrive even if nobody opens it)

  Safe to run at every startup: everything is (re)applied idempotently.

.EXAMPLE
  Startup script parameters in the GPO:
  -ApiUrl "https://helpdesk.water.local" -DeviceKey "<device key>" -AgentKey "<agent key>"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ApiUrl,
    [Parameter(Mandatory)] [string] $DeviceKey,
    [Parameter(Mandatory)] [string] $AgentKey,
    # Where RemoteAccess.ps1 is copied from (the GPO's Scripts folder or a read-only share).
    [string] $SourceDir = $PSScriptRoot,
    # The installed desktop app (tauri.conf.json: productName / mainBinaryName).
    [string] $AppPath = (Join-Path $env:ProgramFiles 'IT Support System\ITSupport.exe')
)
$ErrorActionPreference = 'Stop'

$programFiles = Join-Path $env:ProgramFiles 'ITSupport'
$dataDir      = Join-Path $env:ProgramData 'ITSupport'
$requests     = Join-Path $dataDir 'requests'

# --- registry ---------------------------------------------------------------
$pol = 'HKLM:\SOFTWARE\Policies\ITSupport'
New-Item -Path $pol -Force | Out-Null
Set-ItemProperty -Path $pol -Name ApiUrl    -Value $ApiUrl.TrimEnd('/')
Set-ItemProperty -Path $pol -Name DeviceKey -Value $DeviceKey

$agentKeyPath = 'HKLM:\SOFTWARE\ITSupport\Agent'
New-Item -Path $agentKeyPath -Force | Out-Null
Set-ItemProperty -Path $agentKeyPath -Name AgentKey -Value $AgentKey
# Only SYSTEM and Administrators can read the agent key.
$acl = New-Object System.Security.AccessControl.RegistrySecurity
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in 'S-1-5-18', 'S-1-5-32-544') {
    $who = (New-Object System.Security.Principal.SecurityIdentifier $sid)
    $acl.AddAccessRule((New-Object System.Security.AccessControl.RegistryAccessRule($who, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
}
Set-Acl -Path $agentKeyPath -AclObject $acl

# --- files ------------------------------------------------------------------
New-Item -ItemType Directory -Path $programFiles, $requests -Force | Out-Null
Copy-Item -Path (Join-Path $SourceDir 'RemoteAccess.ps1') -Destination $programFiles -Force

# requests: users may create files; only SYSTEM/Administrators may do anything else.
& icacls.exe $dataDir /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
& icacls.exe $requests /grant '*S-1-5-11:(CI)(WD,AD,S)' '*S-1-5-11:(OI)(IO)(W)' | Out-Null

# --- scheduled task ---------------------------------------------------------
$script = Join-Path $programFiles 'RemoteAccess.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
# Started on demand by the app (schtasks /Run). The repetition is only a fallback in case /Run is blocked.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId 'S-1-5-18' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew -StartWhenAvailable
Register-ScheduledTask -TaskPath '\ITSupport\' -TaskName 'RemoteAccess' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

# Authenticated Users: read + run. SYSTEM/Administrators: full.
$svc = New-Object -ComObject 'Schedule.Service'
$svc.Connect()
$task = $svc.GetFolder('\ITSupport').GetTask('RemoteAccess')
$task.SetSecurityDescriptor('D:(A;;FA;;;SY)(A;;FA;;;BA)(A;;GRGX;;;AU)', 0)

# --- start at sign-in, in the tray ------------------------------------------
$run = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run'
if (Test-Path $AppPath) {
    Set-ItemProperty -Path $run -Name 'ITSupport' -Value "`"$AppPath`" --hidden"
} else {
    Write-Warning "App not found at $AppPath (not installed yet?); autostart skipped this time."
}

Write-Output "IT Support agent configured ($ApiUrl)."
