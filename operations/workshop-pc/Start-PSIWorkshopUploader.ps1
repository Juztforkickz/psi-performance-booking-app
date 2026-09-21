$ErrorActionPreference = 'Stop'
$InstallRoot = $PSScriptRoot
$ErrorLog = Join-Path $InstallRoot 'last-error.log'
$env:PSI_WORKSHOP_ERROR_LOG = $ErrorLog
$ExitCode = 0
$Python = Join-Path $InstallRoot '.venv\Scripts\python.exe'
$Uploader = Join-Path $InstallRoot 'psi_uploads.py'
$Watcher = Join-Path $InstallRoot 'Start-PSIWorkshopWatcher.ps1'
$SessionFile = Join-Path $InstallRoot 'session.dpapi'
$StopFile = Join-Path $InstallRoot 'watcher.stop'
$WatcherMutex = $null
$WatcherLockHeld = $false
$RestartWatcher = $false

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class PSIWorkshopWindow {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }

  [DllImport("kernel32.dll")]
  private static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")]
  private static extern bool GetWindowRect(IntPtr handle, out RECT rectangle);
  [DllImport("user32.dll")]
  private static extern int GetSystemMetrics(int index);
  [DllImport("user32.dll")]
  private static extern bool SetWindowPos(IntPtr handle, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

  public static void Center() {
    IntPtr handle = GetConsoleWindow();
    RECT rectangle;
    if (handle == IntPtr.Zero || !GetWindowRect(handle, out rectangle)) return;
    int width = rectangle.Right - rectangle.Left;
    int height = rectangle.Bottom - rectangle.Top;
    int x = Math.Max(0, (GetSystemMetrics(0) - width) / 2);
    int y = Math.Max(0, (GetSystemMetrics(1) - height) / 2);
    SetWindowPos(handle, IntPtr.Zero, x, y, 0, 0, 0x0015);
  }
}
'@
[PSIWorkshopWindow]::Center()

function Enter-PSIUploaderLock {
  Set-Content -LiteralPath $script:StopFile -Value 'stop' -Encoding ASCII
  $script:WatcherMutex = New-Object System.Threading.Mutex($false, 'Local\PSIWorkshopAutomaticUploader')
  for ($Attempt = 0; $Attempt -lt 40 -and -not $script:WatcherLockHeld; $Attempt++) {
    try {
      $script:WatcherLockHeld = $script:WatcherMutex.WaitOne(1000)
    } catch [System.Threading.AbandonedMutexException] {
      $script:WatcherLockHeld = $true
    }
  }
  if (-not $script:WatcherLockHeld) {
    $script:WatcherMutex.Dispose()
    $script:WatcherMutex = $null
    Remove-Item -LiteralPath $script:StopFile -Force -ErrorAction SilentlyContinue
    throw 'The automatic watcher did not pause. Wait 30 seconds and try again.'
  }
  Remove-Item -LiteralPath $script:StopFile -Force -ErrorAction SilentlyContinue
}

try {
  Remove-Item -LiteralPath $ErrorLog -Force -ErrorAction SilentlyContinue
  $Config = Get-Content -LiteralPath (Join-Path $InstallRoot 'config.json') -Raw | ConvertFrom-Json

  Write-Host ''
  Write-Host 'PSI Workshop Uploads'
  Write-Host '1. Sign in and start automatic watching'
  Write-Host '2. Create a phone / walk-in job (account optional)'
  Write-Host '3. Add a downloaded job folder file (fallback)'
  Write-Host '4. Upload and sync once'
  Write-Host '5. Forget the remembered staff sign-in'
  $Choice = Read-Host 'Choose 1, 2, 3, 4 or 5'

  if ($Choice -eq '1') {
    Enter-PSIUploaderLock
    $RestartWatcher = $true
    & $Python $Uploader --root $Config.uploadRoot --url $Config.projectUrl --key $Config.publishableKey --email $Config.staffEmail --session-file $SessionFile --stop-file $StopFile --manifest-inbox $Config.manifestInbox
    if ($LASTEXITCODE -ne 0) { throw "PSI uploader stopped with error code $LASTEXITCODE." }
    Write-Host 'Automatic watching is running in the background and will start with Windows.'
  } elseif ($Choice -eq '2') {
    Enter-PSIUploaderLock
    $RestartWatcher = $true
    & $Python $Uploader --root $Config.uploadRoot --url $Config.projectUrl --key $Config.publishableKey --email $Config.staffEmail --session-file $SessionFile --manual-job
    if ($LASTEXITCODE -ne 0) { throw "PSI uploader stopped with error code $LASTEXITCODE." }
  } elseif ($Choice -eq '3') {
    Add-Type -AssemblyName System.Windows.Forms
    $Picker = New-Object System.Windows.Forms.OpenFileDialog
    $Picker.Title = 'Choose the PSI job file downloaded from the staff portal'
    $Picker.Filter = 'PSI job files (*.json)|*.json'
    if ($Picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      & $Python $Uploader --root $Config.uploadRoot --add-job $Picker.FileName
      if ($LASTEXITCODE -ne 0) { throw "PSI uploader stopped with error code $LASTEXITCODE." }
    }
  } elseif ($Choice -eq '4') {
    Enter-PSIUploaderLock
    $RestartWatcher = $true
    & $Python $Uploader --root $Config.uploadRoot --url $Config.projectUrl --key $Config.publishableKey --email $Config.staffEmail --session-file $SessionFile --manifest-inbox $Config.manifestInbox
    if ($LASTEXITCODE -ne 0) { throw "PSI uploader stopped with error code $LASTEXITCODE." }
  } elseif ($Choice -eq '5') {
    Enter-PSIUploaderLock
    & $Python $Uploader --root $Config.uploadRoot --session-file $SessionFile --stop-file $StopFile --forget-session
    if ($LASTEXITCODE -ne 0) { throw "PSI uploader stopped with error code $LASTEXITCODE." }
  } else {
    throw 'Choose 1, 2, 3, 4 or 5.'
  }
} catch {
  $ExitCode = 1
  $Message = 'PSI Workshop Uploads error: ' + $_.Exception.Message
  Write-Host ''
  Write-Host $Message -ForegroundColor Red
  if (-not (Test-Path -LiteralPath $ErrorLog)) {
    Set-Content -LiteralPath $ErrorLog -Value $Message -Encoding UTF8
  }
  Write-Host "Diagnostic log: $ErrorLog"
} finally {
  if ($WatcherLockHeld -and $WatcherMutex) {
    $WatcherMutex.ReleaseMutex()
    $WatcherLockHeld = $false
  }
  if ($WatcherMutex) {
    $WatcherMutex.Dispose()
  }
  if ($RestartWatcher -and (Test-Path -LiteralPath $SessionFile)) {
    Remove-Item -LiteralPath $StopFile -Force -ErrorAction SilentlyContinue
    $WatcherArguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $Watcher + '"'
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList $WatcherArguments
  }
  Remove-Item Env:\PSI_WORKSHOP_ERROR_LOG -ErrorAction SilentlyContinue
  Read-Host 'Press Enter to close'
}

exit $ExitCode
