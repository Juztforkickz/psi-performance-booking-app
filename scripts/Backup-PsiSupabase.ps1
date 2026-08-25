param(
    [Parameter(Mandatory = $true)]
    [string]$BackupDirectory,
    [string]$SupabaseCli = 'supabase'
)

$ErrorActionPreference = 'Stop'
$projectRef = 'lslhfrujyuqcavsnugfx'
$databaseUrl = $env:PSI_SUPABASE_DATABASE_URL

if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    throw 'Set PSI_SUPABASE_DATABASE_URL for this PowerShell session only. Never save the database password in this repository or script.'
}
if ($databaseUrl -notmatch [regex]::Escape($projectRef)) {
    throw 'The supplied connection string does not match the PSI Performance App project.'
}

$cli = Get-Command $SupabaseCli -ErrorAction Stop
$resolvedBackupRoot = [System.IO.Path]::GetFullPath($BackupDirectory)
$repositoryRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
if ($resolvedBackupRoot.StartsWith($repositoryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Choose an encrypted backup location outside the repository.'
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$destination = Join-Path $resolvedBackupRoot "psi-supabase-$stamp"
New-Item -ItemType Directory -Path $destination | Out-Null

& $cli.Source db dump --db-url $databaseUrl --file (Join-Path $destination 'roles.sql') --role-only
if ($LASTEXITCODE -ne 0) { throw 'Supabase role export failed.' }
& $cli.Source db dump --db-url $databaseUrl --file (Join-Path $destination 'schema.sql')
if ($LASTEXITCODE -ne 0) { throw 'Supabase schema export failed.' }
& $cli.Source db dump --db-url $databaseUrl --file (Join-Path $destination 'data.sql') --use-copy --data-only -x 'storage.buckets_vectors' -x 'storage.vector_indexes'
if ($LASTEXITCODE -ne 0) { throw 'Supabase data export failed.' }

$hashes = Get-ChildItem -LiteralPath $destination -File | Get-FileHash -Algorithm SHA256
$hashes | ForEach-Object { "{0}  {1}" -f $_.Hash, (Split-Path -Leaf $_.Path) } | Set-Content -LiteralPath (Join-Path $destination 'SHA256SUMS.txt')

Write-Output "Backup created at $destination"
Write-Output 'Store this folder on an encrypted drive with access limited to Matt. Storage objects require a separate export.'
