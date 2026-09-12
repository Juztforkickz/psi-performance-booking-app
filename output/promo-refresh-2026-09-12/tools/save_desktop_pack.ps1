$ErrorActionPreference = 'Stop'
$campaignSource = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$desktopBase = 'C:\Users\PSI PERFORMANCE\Desktop\PSI APP\Organized\Branding'
$deliveryTarget = [IO.Path]::GetFullPath((Join-Path $desktopBase 'App Promo - 12 September 2026'))
if (-not (Test-Path -LiteralPath $desktopBase -PathType Container)) { throw 'The established PSI APP Branding folder was not found.' }
if (-not $deliveryTarget.StartsWith(([IO.Path]::GetFullPath($desktopBase) + '\'), [StringComparison]::OrdinalIgnoreCase)) { throw 'Delivery path is outside PSI APP Branding.' }
if (Test-Path -LiteralPath $deliveryTarget) { throw 'Delivery folder already exists; preserve it and inspect before copying.' }
New-Item -ItemType Directory -Path $deliveryTarget | Out-Null
foreach ($entry in @('social', 'website', 'START-HERE.md')) {
    Copy-Item -LiteralPath (Join-Path $campaignSource $entry) -Destination $deliveryTarget -Recurse
}
$verifiedCount = 0
foreach ($copiedFile in Get-ChildItem -LiteralPath $deliveryTarget -Recurse -File) {
    $relativeName = $copiedFile.FullName.Substring($deliveryTarget.Length + 1)
    $originalFile = Join-Path $campaignSource $relativeName
    if ((Get-FileHash -LiteralPath $copiedFile.FullName).Hash -ne (Get-FileHash -LiteralPath $originalFile).Hash) { throw "Copy verification failed for $relativeName" }
    $verifiedCount++
}
Write-Output "Saved $verifiedCount files; all copies verified."
Write-Output $deliveryTarget
