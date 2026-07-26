[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$TaskName = 'AI Status Dashboard'
$FirewallRuleName = 'AI Status Dashboard'
$DashboardPort = 8787
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$StartScriptPath = Join-Path $PSScriptRoot 'start-dashboard.ps1'

function Resolve-ApplicationPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($null -eq $command) {
        return $null
    }

    if ($command.Path) {
        return $command.Path
    }

    return $command.Source
}

function Resolve-TokscalePath {
    $candidates = New-Object System.Collections.Generic.List[string]
    $whereCommand = Get-Command 'where.exe' -CommandType Application -ErrorAction SilentlyContinue

    if ($null -ne $whereCommand) {
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = 'SilentlyContinue'
        try {
            $whereResults = & $whereCommand.Path 'tokscale' 2>$null
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
        foreach ($result in $whereResults) {
            if (-not [string]::IsNullOrWhiteSpace($result)) {
                $candidates.Add([string]$result)
            }
        }
    }

    $commands = Get-Command 'tokscale' -All -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandType -eq 'Application' }
    foreach ($command in $commands) {
        $candidate = $command.Path
        if (-not $candidate) {
            $candidate = $command.Source
        }
        if ($candidate) {
            $candidates.Add([string]$candidate)
        }
    }

    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        $extension = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
        if (($extension -in @('.exe', '.cmd', '.bat')) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    return $null
}

function Invoke-TokscaleCheck {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TokscalePath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [string]$Label,

        [switch]$ExpectJson
    )

    $output = & $TokscalePath @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        return [pscustomobject]@{
            Success = $false
            Label = $Label
            Reason = "exit code $exitCode"
        }
    }

    if ($ExpectJson) {
        try {
            $parsedOutput = $output | ConvertFrom-Json -ErrorAction Stop
        }
        catch {
            return [pscustomobject]@{
                Success = $false
                Label = $Label
                Reason = 'output was not valid JSON'
            }
        }

        foreach ($item in @($parsedOutput)) {
            $errorProperty = $item.PSObject.Properties['error']
            if ($null -ne $errorProperty -and -not [string]::IsNullOrWhiteSpace([string]$errorProperty.Value)) {
                return [pscustomobject]@{
                    Success = $false
                    Label = $Label
                    Reason = 'the provider reported an authorization or upstream error'
                }
            }
        }
    }

    return [pscustomobject]@{
        Success = $true
        Label = $Label
        Reason = $null
        Output = $output.Trim()
    }
}

function Get-ConnectedNetworkProfiles {
    return @(Get-NetConnectionProfile -ErrorAction Stop |
        Where-Object {
            $_.IPv4Connectivity -ne 'Disconnected' -or
            $_.IPv6Connectivity -ne 'Disconnected'
        })
}

function Get-PrivateLanAddresses {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Profiles
    )

    $addresses = New-Object System.Collections.Generic.List[string]
    foreach ($profile in $Profiles) {
        if ($profile.NetworkCategory -ne 'Private') {
            continue
        }

        $interfaceAddresses = Get-NetIPAddress `
            -InterfaceIndex $profile.InterfaceIndex `
            -AddressFamily IPv4 `
            -ErrorAction SilentlyContinue

        foreach ($address in $interfaceAddresses) {
            if ($address.IPAddress -eq '127.0.0.1' -or $address.IPAddress -like '169.254.*') {
                continue
            }
            $addresses.Add([string]$address.IPAddress)
        }
    }

    return @($addresses | Select-Object -Unique)
}

function Test-DashboardPayload {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Payload,

        [Parameter(Mandatory = $true)]
        [string]$Url
    )

    if ($null -eq $Payload.providers) {
        throw "$Url response is missing providers."
    }
    if ($Payload.providers.PSObject.Properties.Name -notcontains 'claude') {
        throw "$Url response is missing providers.claude."
    }
    if ($Payload.providers.PSObject.Properties.Name -notcontains 'codex') {
        throw "$Url response is missing providers.codex."
    }
}

function Get-NodeListener {
    $listener = Get-NetTCPConnection `
        -State Listen `
        -LocalPort $DashboardPort `
        -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($null -eq $listener) {
        return $null
    }

    $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    if ($null -eq $process -or $process.ProcessName -ne 'node') {
        $processName = 'unknown'
        if ($null -ne $process) {
            $processName = $process.ProcessName
        }
        throw "TCP $DashboardPort is listening under a non-Node process (PID $($listener.OwningProcess), process $processName)."
    }

    return $listener
}

if (-not (Test-Path -LiteralPath $StartScriptPath -PathType Leaf)) {
    throw "Startup script not found: $StartScriptPath"
}

$nodePath = Resolve-ApplicationPath -Name 'node.exe'
if (-not $nodePath) {
    throw 'node.exe was not found. Install Node.js 18 or newer and add node.exe to PATH.'
}

$nodeVersionText = (& $nodePath '--version' 2>$null | Select-Object -First 1)
if (-not $nodeVersionText -or ([string]$nodeVersionText).Trim() -notmatch '^v?(\d+)') {
    throw "Unable to parse the Node.js version: $nodeVersionText"
}
if ([int]$Matches[1] -lt 18) {
    throw "Node.js $nodeVersionText is unsupported. Upgrade to Node.js 18 or newer."
}
Write-Host "Node.js: $(([string]$nodeVersionText).Trim()) ($nodePath)"

if (-not $WhatIfPreference) {
    $windowsPrincipal = New-Object System.Security.Principal.WindowsPrincipal(
        [System.Security.Principal.WindowsIdentity]::GetCurrent()
    )
    if (-not $windowsPrincipal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Windows setup requires Administrator privileges. Open Windows PowerShell 5.1 as Administrator and rerun setup.ps1.'
    }
}

$tokscalePath = Resolve-TokscalePath
if (-not $tokscalePath) {
    $npmPath = Resolve-ApplicationPath -Name 'npm.cmd'
    if (-not $npmPath) {
        throw 'tokscale is missing and npm.cmd was not found on PATH; cannot install tokscale@latest.'
    }

    if ($PSCmdlet.ShouldProcess('global npm packages', 'Install tokscale@latest')) {
        & $npmPath 'install' '--global' 'tokscale@latest'
        if ($LASTEXITCODE -ne 0) {
            throw "Global npm install of tokscale@latest failed (exit code $LASTEXITCODE)."
        }
        $tokscalePath = Resolve-TokscalePath
        if (-not $tokscalePath) {
            throw 'tokscale was installed, but no .exe, .cmd, or .bat application shim was found. Add the npm global bin directory to PATH.'
        }
    }
}

if ($tokscalePath) {
    Write-Host "tokscale: $tokscalePath"
    $versionResult = Invoke-TokscaleCheck `
        -TokscalePath $tokscalePath `
        -Arguments @('--version') `
        -Label 'tokscale --version'
    if (-not $versionResult.Success) {
        throw "$($versionResult.Label) failed: $($versionResult.Reason)."
    }
    Write-Host "tokscale version: $($versionResult.Output)"

    $usageResult = Invoke-TokscaleCheck `
        -TokscalePath $tokscalePath `
        -Arguments @('usage', '--json') `
        -Label 'tokscale usage --json' `
        -ExpectJson
    if ($usageResult.Success) {
        Write-Host "$($usageResult.Label): PASS"
    }
    else {
        Write-Warning "$($usageResult.Label) failed ($($usageResult.Reason)). Sign in interactively with /login in Claude Code, then rerun setup. Do not paste any token."
    }

    $codexResult = Invoke-TokscaleCheck `
        -TokscalePath $tokscalePath `
        -Arguments @('codex', 'status', '--json') `
        -Label 'tokscale codex status --json' `
        -ExpectJson
    if ($codexResult.Success) {
        Write-Host "$($codexResult.Label): PASS"
    }
    else {
        Write-Warning "$($codexResult.Label) failed ($($codexResult.Reason)). Run codex login and then tokscale codex import interactively before rerunning setup. Do not paste any token."
    }
}
else {
    Write-Host 'Post-install checks: tokscale --version, tokscale usage --json, tokscale codex status --json'
}

$profiles = @()
try {
    $profiles = @(Get-ConnectedNetworkProfiles)
}
catch {
    if ($WhatIfPreference) {
        Write-Warning "Unable to query Windows network profiles during WhatIf: $($_.Exception.Message). A real run will fail closed before changing the Firewall."
    }
    else {
        throw
    }
}
if ($profiles.Count -eq 0) {
    if ($WhatIfPreference) {
        Write-Warning 'No connected Windows network profile was available during WhatIf. A real run will not create a Firewall rule without confirming a Private profile.'
    }
    else {
        throw 'No connected Windows network profile was found; the Firewall rule will not be created.'
    }
}

$incompatibleProfiles = @($profiles | Where-Object { $_.NetworkCategory -ne 'Private' })
if ($incompatibleProfiles.Count -gt 0) {
    $profileSummary = ($incompatibleProfiles |
        ForEach-Object { "$($_.Name)=$($_.NetworkCategory)" }) -join ', '
    if ($WhatIfPreference) {
        Write-Warning "Not every connected network is Private ($profileSummary). A real run will stop before changing the Firewall and will not allow Public or DomainAuthenticated profiles."
    }
    else {
        throw "Not every connected network is Private ($profileSummary). Mark only a trusted network as Private in Windows Settings; this script will not change network categories or allow the Public profile."
    }
}

$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$taskArguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $StartScriptPath

if ($PSCmdlet.ShouldProcess($TaskName, 'Create or update the current-user logon task (InteractiveToken; no stored password)')) {
    $action = New-ScheduledTaskAction -Execute $powershellPath -Argument $taskArguments -WorkingDirectory $RepoRoot
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
    $principal = New-ScheduledTaskPrincipal `
        -UserId $currentUser `
        -LogonType Interactive `
        -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Force | Out-Null
}

if ($PSCmdlet.ShouldProcess($FirewallRuleName, "Create or update the Private-only inbound TCP $DashboardPort rule (Program: $nodePath)")) {
    Get-NetFirewallRule -DisplayName $FirewallRuleName -ErrorAction SilentlyContinue |
        Remove-NetFirewallRule -ErrorAction Stop

    New-NetFirewallRule `
        -DisplayName $FirewallRuleName `
        -Direction Inbound `
        -Action Allow `
        -Enabled True `
        -Profile Private `
        -Protocol TCP `
        -LocalPort $DashboardPort `
        -Program $nodePath | Out-Null
}

if ($PSCmdlet.ShouldProcess($TaskName, 'Start the scheduled task now')) {
    Start-ScheduledTask -TaskName $TaskName
}

if ($WhatIfPreference) {
    Write-Host 'WhatIf complete: no package installed, task registered, Firewall changed, or service started.'
    exit 0
}

$listener = $null
for ($attempt = 1; $attempt -le 20; $attempt++) {
    $listener = Get-NodeListener
    if ($null -ne $listener) {
        break
    }
    Start-Sleep -Seconds 1
}
if ($null -eq $listener) {
    throw "No Node.js listener appeared on TCP $DashboardPort within 20 seconds. Check logs\dashboard.stderr.log."
}
Write-Host "Listener: TCP $DashboardPort, node PID $($listener.OwningProcess)"

$localhostApiUrl = "http://localhost:$DashboardPort/api/status"
$localhostResponse = Invoke-WebRequest -Uri $localhostApiUrl -UseBasicParsing -TimeoutSec 15
if ($localhostResponse.StatusCode -ne 200) {
    throw "$localhostApiUrl returned HTTP $($localhostResponse.StatusCode)."
}
$localhostPayload = $localhostResponse.Content | ConvertFrom-Json -ErrorAction Stop
Test-DashboardPayload -Payload $localhostPayload -Url $localhostApiUrl
Write-Host 'Local API: HTTP 200; providers.claude and providers.codex are present'

$lanAddresses = @(Get-PrivateLanAddresses -Profiles $profiles)
if ($lanAddresses.Count -eq 0) {
    Write-Warning 'No non-loopback, non-APIPA IPv4 was found on a Private adapter; no iPhone LAN URL is available.'
}
else {
    foreach ($lanAddress in $lanAddresses) {
        $lanApiUrl = "http://${lanAddress}:$DashboardPort/api/status"
        $lanResponse = Invoke-WebRequest -Uri $lanApiUrl -UseBasicParsing -TimeoutSec 15
        if ($lanResponse.StatusCode -ne 200) {
            throw "$lanApiUrl returned HTTP $($lanResponse.StatusCode)."
        }
        $lanPayload = $lanResponse.Content | ConvertFrom-Json -ErrorAction Stop
        Test-DashboardPayload -Payload $lanPayload -Url $lanApiUrl
        Write-Host "LAN API: $lanApiUrl -> HTTP 200"
        Write-Host "iPhone URL: http://${lanAddress}:$DashboardPort"
    }
}

Write-Host 'iPhone Safari UAT: PENDING. Barry must connect the iPhone to the same Private Wi-Fi, open the URL above, and confirm the Claude/Codex cards and automatic updates.'
