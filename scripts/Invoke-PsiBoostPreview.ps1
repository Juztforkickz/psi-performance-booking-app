# Private preview tooling only. No App Store submission or public update target.
param(
  [ValidateSet('Validate','Export','Update')][string]$Action = 'Validate',
  [string]$Message = 'Private Boost preview update'
)
$ErrorActionPreference = 'Stop'
$boostRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$boostMobile = Join-Path $boostRoot 'mobile'
$boostProfiles = (Get-Content -LiteralPath (Join-Path $boostMobile 'eas.json') -Raw | ConvertFrom-Json).build
$boostEnvironment = @{}
foreach ($boostProfile in @($boostProfiles.'apple-review', $boostProfiles.'boost-preview')) {
  foreach ($boostEntry in $boostProfile.env.PSObject.Properties) { $boostEnvironment[$boostEntry.Name] = $boostEntry.Value }
}
if ($boostProfiles.'boost-preview'.extends -ne 'apple-review' -or $boostProfiles.'boost-preview'.channel -ne 'boost-preview' -or $boostProfiles.'boost-preview'.ios.distribution -ne 'internal') { throw 'Private internal profile required.' }
$boostSaved = @{}
try {
  foreach ($boostEntry in Get-ChildItem Env: | Where-Object Name -like 'EXPO_PUBLIC_*') {
    $boostSaved[$boostEntry.Name] = $boostEntry.Value
    [Environment]::SetEnvironmentVariable($boostEntry.Name, $null, 'Process')
  }
  $boostEnvironment.EXPO_NO_DOTENV = '1'
  $boostEnvironment.EAS_BUILD_PROFILE = 'boost-preview'
  $boostEnvironment.EAS_BUILD_PLATFORM = 'ios'
  foreach ($boostEntry in $boostEnvironment.GetEnumerator()) {
    if (-not $boostSaved.ContainsKey($boostEntry.Key)) { $boostSaved[$boostEntry.Key] = [Environment]::GetEnvironmentVariable($boostEntry.Key, 'Process') }
    [Environment]::SetEnvironmentVariable($boostEntry.Key, $boostEntry.Value, 'Process')
  }
  Push-Location -LiteralPath $boostMobile
  try {
    & node -e "const c=require('./app.config.js')({config:require('./app.json').expo}); if(c.name!=='PSI Boost Preview'||c.ios.bundleIdentifier!=='au.com.psiperformance.garage.boostpreview'||c.runtimeVersion!=='1.0.0-boost-preview-1'||c.extra.psiBoostPreview!==true)throw Error('Preview isolation missing'); console.log('Boost preview identity, sandbox and runtime verified');"
    if ($LASTEXITCODE -ne 0) { throw 'Private configuration validation failed.' }
    if ($Action -eq 'Export') {
      & pnpm exec expo export --platform ios --output-dir '../artifacts/boost-preview/ios'
    } elseif ($Action -eq 'Update') {
      & pnpm dlx eas-cli update --channel boost-preview --platform ios --environment preview --message $Message --non-interactive
    }
    if ($LASTEXITCODE -ne 0) { throw 'Private preview operation failed.' }
  } finally { Pop-Location }
} finally {
  foreach ($boostEntry in $boostSaved.GetEnumerator()) { [Environment]::SetEnvironmentVariable($boostEntry.Key, $boostEntry.Value, 'Process') }
}
