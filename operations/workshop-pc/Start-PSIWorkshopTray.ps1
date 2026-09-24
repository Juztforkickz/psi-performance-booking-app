$ErrorActionPreference = 'Stop'
$InstallRoot = $PSScriptRoot
$ConfigPath = Join-Path $InstallRoot 'config.json'
$Watcher = Join-Path $InstallRoot 'Start-PSIWorkshopWatcher.ps1'
$Menu = Join-Path $InstallRoot 'Start-PSIWorkshopUploader.ps1'
$StopFile = Join-Path $InstallRoot 'watcher.stop'
$SessionFile = Join-Path $InstallRoot 'session.dpapi'
$ErrorLog = Join-Path $InstallRoot 'last-error.log'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:Exited = $false
$script:WatcherProcess = $null
$script:StatusTimer = New-Object System.Windows.Forms.Timer
$script:StatusTimer.Interval = 10000

function Get-PSIConfig {
  if (-not (Test-Path -LiteralPath $ConfigPath)) { return $null }
  Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
}

function Test-PSIWatcherRunning {
  if ($script:WatcherProcess -and -not $script:WatcherProcess.HasExited) { return $true }
  $localProcesses = @(Get-Process python -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like (Join-Path $InstallRoot '*')
  })
  return $localProcesses.Count -gt 0
}

function Start-PSIWatcher {
  Remove-Item -LiteralPath $StopFile -Force -ErrorAction SilentlyContinue
  if (Test-PSIWatcherRunning) { return }
  $arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $Watcher + '"'
  $script:WatcherProcess = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList $arguments -PassThru
}

function Stop-PSIWatcher {
  Set-Content -LiteralPath $StopFile -Value 'stop' -Encoding ASCII
}

function New-PSIIcon([System.Drawing.Color]$color) {
  $bitmap = New-Object System.Drawing.Bitmap 16, 16
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $brush = New-Object System.Drawing.SolidBrush $color
  $graphics.FillEllipse($brush, 1, 1, 14, 14)
  $font = New-Object System.Drawing.Font 'Segoe UI', 7, ([System.Drawing.FontStyle]::Bold)
  $textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Black)
  $graphics.DrawString('PSI', $font, $textBrush, -1, 3)
  $handle = $bitmap.GetHicon()
  $icon = [System.Drawing.Icon]::FromHandle($handle)
  $graphics.Dispose()
  $brush.Dispose()
  $textBrush.Dispose()
  $font.Dispose()
  return $icon
}

$RunningIcon = New-PSIIcon ([System.Drawing.Color]::FromArgb(101, 207, 248))
$StoppedIcon = New-PSIIcon ([System.Drawing.Color]::FromArgb(160, 160, 160))
$ErrorIcon = New-PSIIcon ([System.Drawing.Color]::FromArgb(255, 95, 95))

$Tray = New-Object System.Windows.Forms.NotifyIcon
$Tray.Icon = $StoppedIcon
$Tray.Visible = $true

$MenuStrip = New-Object System.Windows.Forms.ContextMenuStrip
$StatusItem = $MenuStrip.Items.Add('Checking PSI Workshop Uploads...')
$StatusItem.Enabled = $false
[void]$MenuStrip.Items.Add('-')
$OpenMenuItem = $MenuStrip.Items.Add('Open PSI Workshop Uploads')
$SyncNowItem = $MenuStrip.Items.Add('Upload and sync once')
$OpenFolderItem = $MenuStrip.Items.Add('Open upload folder')
[void]$MenuStrip.Items.Add('-')
$RestartItem = $MenuStrip.Items.Add('Restart background sync')
$StopItem = $MenuStrip.Items.Add('Stop background sync')
[void]$MenuStrip.Items.Add('-')
$ExitItem = $MenuStrip.Items.Add('Exit tray icon')
$Tray.ContextMenuStrip = $MenuStrip

function Update-PSITray {
  $config = Get-PSIConfig
  $running = Test-PSIWatcherRunning
  $stopped = Test-Path -LiteralPath $StopFile
  $hasError = Test-Path -LiteralPath $ErrorLog
  if ($hasError) {
    $Tray.Icon = $ErrorIcon
    $StatusItem.Text = 'PSI sync needs attention - open the menu'
  } elseif ($running -and -not $stopped) {
    $Tray.Icon = $RunningIcon
    $StatusItem.Text = 'PSI background sync is running'
  } elseif ($stopped) {
    $Tray.Icon = $StoppedIcon
    $StatusItem.Text = 'PSI background sync is paused'
  } else {
    $Tray.Icon = $StoppedIcon
    $StatusItem.Text = 'PSI background sync is not running'
  }
  $Tray.Text = $StatusItem.Text
  $OpenFolderItem.Enabled = $null -ne $config -and (Test-Path -LiteralPath $config.uploadRoot)
}

$OpenMenuItem.add_Click({
  Start-Process -FilePath 'powershell.exe' -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "' + $Menu + '"')
})

$SyncNowItem.add_Click({
  Start-Process -FilePath 'powershell.exe' -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "' + $Menu + '"')
})

$OpenFolderItem.add_Click({
  $config = Get-PSIConfig
  if ($config -and (Test-Path -LiteralPath $config.uploadRoot)) {
    Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + $config.uploadRoot + '"')
  }
})

$RestartItem.add_Click({
  Stop-PSIWatcher
  Start-Sleep -Seconds 3
  Start-PSIWatcher
  Update-PSITray
})

$StopItem.add_Click({
  Stop-PSIWatcher
  Update-PSITray
})

$ExitItem.add_Click({
  $script:Exited = $true
  $script:StatusTimer.Stop()
  $Tray.Visible = $false
  $Tray.Dispose()
  [System.Windows.Forms.Application]::Exit()
})

$Tray.add_DoubleClick({
  Start-Process -FilePath 'powershell.exe' -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "' + $Menu + '"')
})

$script:StatusTimer.add_Tick({ Update-PSITray })
Start-PSIWatcher
Update-PSITray
$script:StatusTimer.Start()
[System.Windows.Forms.Application]::Run()

if (-not $script:Exited) {
  $Tray.Visible = $false
  $Tray.Dispose()
}
