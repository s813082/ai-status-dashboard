[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$DashboardPort = 8787
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$ServerPath = Join-Path $RepoRoot 'src\server.js'
$LogsPath = Join-Path $RepoRoot 'logs'
$StdoutLog = Join-Path $LogsPath 'dashboard.stdout.log'
$StderrLog = Join-Path $LogsPath 'dashboard.stderr.log'

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

function Get-PortListener {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    return Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -First 1
}

if (-not (Test-Path -LiteralPath $ServerPath -PathType Leaf)) {
    throw "Dashboard server not found: $ServerPath"
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

$tokscalePath = Resolve-TokscalePath
if (-not $tokscalePath) {
    throw 'No tokscale.exe, tokscale.cmd, or tokscale.bat application was found. Run scripts\windows\setup.ps1 first.'
}

$listener = Get-PortListener -Port $DashboardPort
if ($null -ne $listener) {
    $listenerProcess = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    if ($null -ne $listenerProcess -and $listenerProcess.ProcessName -eq 'node') {
        Write-Host "AI Status Dashboard is already listening on TCP $DashboardPort (node PID $($listener.OwningProcess)); startup skipped."
        exit 0
    }

    $processName = 'unknown'
    if ($null -ne $listenerProcess) {
        $processName = $listenerProcess.ProcessName
    }
    throw "TCP $DashboardPort is occupied by a non-Node process (PID $($listener.OwningProcess), process $processName)."
}

New-Item -ItemType Directory -Path $LogsPath -Force | Out-Null
$env:TOKSCALE_BIN = $tokscalePath

$process = Start-Process `
    -FilePath $nodePath `
    -ArgumentList @('src/server.js') `
    -WorkingDirectory $RepoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $StdoutLog `
    -RedirectStandardError $StderrLog `
    -PassThru

Write-Host "AI Status Dashboard started in the background (PID $($process.Id))."
Write-Host "stdout: $StdoutLog"
Write-Host "stderr: $StderrLog"
