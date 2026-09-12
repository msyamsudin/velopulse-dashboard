#Requires -Version 5.1
<#
  Penjaga port untuk start.bat.

  Kenapa ada: `next dev` tidak mencari port kosong sendiri. Kalau port tujuan
  sudah terpakai, ia gagal dengan EADDRINUSE lalu keluar dengan kode 1,
  sementara yang tetap melayani browser adalah instance lama. Akibatnya
  aplikasi tampak "jalan" padahal kode yang sedang diuji bisa jadi bukan kode
  terbaru.

  Skrip ini memeriksa pemegang port, menandai apakah ia dev server proyek ini
  atau proses lain, mematikannya hanya atas permintaan, dan mencari port kosong
  berikutnya.

  Keluaran selalu baris `KUNCI=NILAI` (mis. `STATUS=INUSE`) supaya mudah diurai
  `for /f` di batch.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [int]$Port,

    [ValidateSet('status', 'stop', 'pick')]
    [string]$Mode = 'status',

    [string]$ProjectPath = '',

    [int]$SearchLimit = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = ''
if ($ProjectPath) {
    try {
        # getfullpath merapikan akhiran `\.` yang datang dari `%~dp0.` di batch.
        $ProjectRoot = [System.IO.Path]::GetFullPath($ProjectPath).TrimEnd('\')
    }
    catch {
        $ProjectRoot = ''
    }
}

function Test-InProject {
    param([string]$CommandLine, [string]$Root)

    if (-not $CommandLine -or -not $Root) { return $false }
    return $CommandLine.IndexOf($Root, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Get-ListenerPid {
    param([int]$PortNumber)

    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $connection = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($connection) { return [int]$connection.OwningProcess }
        return 0
    }

    # Cadangan untuk Windows tanpa modul NetTCPIP; kolom terakhir netstat = PID.
    # Pola `[:.]port` + spasi menghindari salah cocok dengan port seperti 30001.
    $match = netstat -ano -p tcp |
        Select-String -Pattern "[:.]$PortNumber\s" |
        Select-String -Pattern 'LISTENING' |
        Select-Object -First 1
    if (-not $match) { return 0 }
    return [int](($match.Line -split '\s+')[-1])
}

function Get-NodeAncestry {
    param([int]$ProcessId, [string]$Root)

    $chain = @()
    $current = $ProcessId

    for ($depth = 0; $depth -lt 8 -and $current -gt 0; $depth++) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $current" -ErrorAction SilentlyContinue
        if (-not $process) { break }
        # Rantai pnpm/next seluruhnya node.exe. Berhenti di cmd.exe atau
        # terminal supaya jendela milik pengguna tidak ikut tertutup.
        if ($process.Name -ne 'node.exe') { break }

        $commandLine = [string]$process.CommandLine
        $chain += [pscustomobject]@{
            Id          = [int]$process.ProcessId
            CommandLine = $commandLine
            InProject   = (Test-InProject -CommandLine $commandLine -Root $Root)
        }
        $current = [int]$process.ParentProcessId
    }

    return $chain
}

function Get-PortState {
    param([int]$PortNumber, [string]$Root)

    $listenerPid = Get-ListenerPid -PortNumber $PortNumber
    if ($listenerPid -le 0) {
        return [pscustomobject]@{
            Status = 'FREE'
            Pid    = 0
            Name   = ''
            Owned  = 'NO'
            Target = 0
            Chain  = @()
        }
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerPid" -ErrorAction SilentlyContinue
    $name = ''
    $commandLine = ''
    if ($process) {
        $name = [string]$process.Name
        $commandLine = [string]$process.CommandLine
    }

    $chain = @(Get-NodeAncestry -ProcessId $listenerPid -Root $Root)

    # "Milik proyek ini" berarti prosesnya berjalan dari folder proyek dan memang
    # server Next; proses lain yang kebetulan menempati port yang sama bukan
    # urusan skrip ini.
    $owned = (Test-InProject -CommandLine $commandLine -Root $Root) -and ($commandLine -match 'next|start-server')

    # Bunuh dari induk node terjauh supaya wrapper pnpm/next tidak tertinggal.
    $target = $listenerPid
    if ($owned -and $chain.Count -gt 0) {
        $target = [int]$chain[$chain.Count - 1].Id
    }

    $ownedFlag = 'NO'
    if ($owned) { $ownedFlag = 'YES' }

    return [pscustomobject]@{
        Status = 'INUSE'
        Pid    = $listenerPid
        Name   = $name
        Owned  = $ownedFlag
        Target = $target
        Chain  = $chain
    }
}

function Stop-PortOwner {
    param([int]$PortNumber, [string]$Root)

    $state = Get-PortState -PortNumber $PortNumber -Root $Root
    if ($state.Status -eq 'FREE') {
        return [pscustomobject]@{ Status = 'FREE'; Killed = '' }
    }

    # Proses di luar proyek: cukup pemegang port, jangan sentuh rantai induknya.
    $target = $state.Target
    if ($state.Owned -ne 'YES') { $target = $state.Pid }

    # Redirect stderr dari program native bisa jadi terminating error saat
    # ErrorActionPreference 'Stop', jadi dilonggarkan hanya untuk taskkill.
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $null = & taskkill.exe /PID $target /T /F 2>&1
    $ErrorActionPreference = $previousPreference

    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if ((Get-ListenerPid -PortNumber $PortNumber) -le 0) {
            return [pscustomobject]@{ Status = 'FREE'; Killed = "$target" }
        }
        Start-Sleep -Milliseconds 250
    }

    return [pscustomobject]@{ Status = 'FAILED'; Killed = "$target" }
}

function Find-FreePort {
    param([int]$StartPort, [int]$Limit)

    for ($candidate = $StartPort + 1; $candidate -le ($StartPort + $Limit); $candidate++) {
        if ((Get-ListenerPid -PortNumber $candidate) -le 0) { return $candidate }
    }
    return 0
}

switch ($Mode) {
    'status' {
        $state = Get-PortState -PortNumber $Port -Root $ProjectRoot
        Write-Output "STATUS=$($state.Status)"
        Write-Output "PID=$($state.Pid)"
        Write-Output "NAME=$($state.Name)"
        Write-Output "OWNED=$($state.Owned)"
        break
    }
    'stop' {
        $result = Stop-PortOwner -PortNumber $Port -Root $ProjectRoot
        Write-Output "STATUS=$($result.Status)"
        Write-Output "KILLED=$($result.Killed)"
        break
    }
    'pick' {
        $freePort = Find-FreePort -StartPort $Port -Limit $SearchLimit
        if ($freePort -gt 0) {
            Write-Output 'STATUS=FOUND'
            Write-Output "PORT=$freePort"
        }
        else {
            Write-Output 'STATUS=NONE'
            Write-Output 'PORT='
        }
        break
    }
}

exit 0
