$ErrorActionPreference = 'Stop'
$InstallRoot = $PSScriptRoot
$ConfigPath = Join-Path $InstallRoot 'config.json'
$Watcher = Join-Path $InstallRoot 'Start-PSIWorkshopWatcher.ps1'
$Menu = Join-Path $InstallRoot 'Start-PSIWorkshopUploader.ps1'
$StopFile = Join-Path $InstallRoot 'watcher.stop'
$SessionFile = Join-Path $InstallRoot 'session.dpapi'
$ErrorLog = Join-Path $InstallRoot 'last-error.log'
$Updater = Join-Path $InstallRoot 'Update-PSIWorkshopUploader.ps1'
$UpdateStatus = Join-Path $InstallRoot 'update-status.json'
$TrayMutex = New-Object System.Threading.Mutex($false, 'Local\PSIWorkshopTray')
$TrayLockHeld = $false

try {
  $TrayLockHeld = $TrayMutex.WaitOne(0)
} catch [System.Threading.AbandonedMutexException] {
  $TrayLockHeld = $true
}
if (-not $TrayLockHeld) {
  $TrayMutex.Dispose()
  exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:Exited = $false
$script:WatcherProcess = $null
$script:MenuProcess = $null
$script:UpdateProcess = $null
$script:LastUpdateCheck = [DateTime]::MinValue
$script:UpdateNoticeVersion = ''
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

function Open-PSIMenu([string]$choice = '') {
  if ($script:MenuProcess -and -not $script:MenuProcess.HasExited) {
    $shell = New-Object -ComObject WScript.Shell
    [void]$shell.AppActivate($script:MenuProcess.Id)
    return
  }
  $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $Menu + '"'
  if ($choice) { $arguments += ' -InitialChoice ' + $choice }
  $script:MenuProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -PassThru
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
$UpdateItem = $MenuStrip.Items.Add('Check for workshop app updates')
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

  if ($script:UpdateProcess -and $script:UpdateProcess.HasExited) {
    $script:UpdateProcess.Dispose()
    $script:UpdateProcess = $null
  }
  if (Test-Path -LiteralPath $UpdateStatus) {
    try {
      $update = Get-Content -LiteralPath $UpdateStatus -Raw | ConvertFrom-Json
      if ($update.updateAvailable) {
        $UpdateItem.Text = 'Install workshop app update ' + $update.remoteVersion
        $UpdateItem.Enabled = $true
        if ($script:UpdateNoticeVersion -ne $update.remoteVersion) {
          $script:UpdateNoticeVersion = $update.remoteVersion
          $Tray.BalloonTipTitle = 'PSI Workshop update available'
          $Tray.BalloonTipText = 'Version ' + $update.remoteVersion + ' is ready. Open the PSI tray menu to install it.'
          $Tray.ShowBalloonTip(7000)
        }
      } elseif ($update.checkedAt) {
        $UpdateItem.Text = 'Workshop app is up to date'
        $UpdateItem.Enabled = $true
      }
    } catch {
      $UpdateItem.Text = 'Check for workshop app updates'
      $UpdateItem.Enabled = $true
    }
  }

  if ((Get-Date) - $script:LastUpdateCheck -gt [TimeSpan]::FromHours(6) -and -not $script:UpdateProcess -and (Test-Path -LiteralPath $Updater)) {
    $script:LastUpdateCheck = Get-Date
    $arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $Updater + '" -CheckOnly'
    $script:UpdateProcess = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList $arguments -PassThru
  }
}

$OpenMenuItem.add_Click({
  Open-PSIMenu
})

$SyncNowItem.add_Click({
  Open-PSIMenu '4'
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

$UpdateItem.add_Click({
  $update = $null
  if (Test-Path -LiteralPath $UpdateStatus) {
    try { $update = Get-Content -LiteralPath $UpdateStatus -Raw | ConvertFrom-Json } catch { $update = $null }
  }
  if (-not $update -or -not $update.updateAvailable) {
    $script:LastUpdateCheck = [DateTime]::MinValue
    Update-PSITray
    $Tray.BalloonTipTitle = 'PSI Workshop updates'
    $Tray.BalloonTipText = 'Checking for an approved workshop app update.'
    $Tray.ShowBalloonTip(4000)
    return
  }

  $answer = [System.Windows.Forms.MessageBox]::Show(
    'Install PSI Workshop version ' + $update.remoteVersion + '? Background syncing will pause, the current app will be backed up, and syncing will restart automatically.',
    'Install PSI Workshop update',
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question
  )
  if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return }

  Stop-PSIWatcher
  $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $Updater + '" -Install -NonInteractive'
  Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments | Out-Null
  $script:Exited = $true
  $script:StatusTimer.Stop()
  $Tray.Visible = $false
  $Tray.Dispose()
  [System.Windows.Forms.Application]::Exit()
})

$ExitItem.add_Click({
  $script:Exited = $true
  $script:StatusTimer.Stop()
  $Tray.Visible = $false
  $Tray.Dispose()
  [System.Windows.Forms.Application]::Exit()
})

$Tray.add_DoubleClick({
  Open-PSIMenu
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
if ($TrayLockHeld -and $TrayMutex) {
  $TrayMutex.ReleaseMutex()
}
if ($TrayMutex) {
  $TrayMutex.Dispose()
}
