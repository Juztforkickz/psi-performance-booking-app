$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'Start-PSIWorkshopUploader.ps1'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Menu script has syntax errors.' }
$definition = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Enter-PSIUploaderLock' }, $true)
Invoke-Expression $definition.Extent.Text
Add-Type @'
using System;
using System.Threading;
public class PSIHandshakeTestOwner : IDisposable {
  public ManualResetEvent Ready = new ManualResetEvent(false);
  public ManualResetEvent Release = new ManualResetEvent(false);
  private Thread thread;
  public PSIHandshakeTestOwner(string name, int delay) {
    thread = new Thread(() => {
      using (var mutex = new Mutex(false, name)) {
        mutex.WaitOne(); Ready.Set(); Release.WaitOne(delay); mutex.ReleaseMutex();
      }
    });
    thread.Start();
    if (!Ready.WaitOne(5000)) throw new Exception("Test lock failed");
  }
  public void Dispose() { Release.Set(); thread.Join(); Ready.Dispose(); Release.Dispose(); }
}
'@
$script:StopFile = Join-Path ([IO.Path]::GetTempPath()) ('psi-pause-' + [Guid]::NewGuid().ToString('N') + '.stop')
try {
  foreach ($testCase in @('finishes', 'timeout')) {
    $name = 'Local\PSIPauseTest' + [Guid]::NewGuid().ToString('N')
    $owner = New-Object PSIHandshakeTestOwner($name, $(if ($testCase -eq 'finishes') { 1600 } else { 10000 }))
    $script:WatcherMutex = $null
    $script:WatcherLockHeld = $false
    $script:RestartWatcher = $false
    try {
      if ($testCase -eq 'finishes') {
        Enter-PSIUploaderLock -MaxWaitSeconds 5 -MutexName $name
        if (-not $script:WatcherLockHeld) { throw 'The menu failed to acquire the paused watcher lock.' }
        if (Test-Path -LiteralPath $script:StopFile) { throw 'Pause request was not cleared for the manual job.' }
      } else {
        $failed = $false
        try { Enter-PSIUploaderLock -MaxWaitSeconds 1 -MutexName $name }
        catch { $failed = $_.Exception.Message -match 'still finishing safely' }
        if (-not $failed) { throw 'Timeout was not reported safely.' }
        if ($script:WatcherLockHeld -or $null -ne $script:WatcherMutex) { throw 'Timeout left a held lock.' }
      }
      if (-not $script:RestartWatcher) { throw 'Watcher restart was not scheduled.' }
    } finally {
      if ($script:WatcherLockHeld) { $script:WatcherMutex.ReleaseMutex() }
      if ($script:WatcherMutex) { $script:WatcherMutex.Dispose() }
      $owner.Dispose()
    }
  }
  Write-Output 'Menu handover tests passed: delayed file completion and safe timeout recovery.'
} finally {
  if (Test-Path -LiteralPath $script:StopFile) { Remove-Item -LiteralPath $script:StopFile -Force }
}
