$ErrorActionPreference = 'Stop'
$campaignSource = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$desktopBase = 'C:\Users\PSI PERFORMANCE\Desktop\PSI APP\Organized\Branding'
$deliveryTarget = [IO.Path]::GetFullPath((Join-Path $desktopBase 'App Promo - 13 September 2026'))
if (-not (Test-Path -LiteralPath $desktopBase -PathType Container)) { throw 'The established PSI APP Branding folder was not found.' }
if (-not $deliveryTarget.StartsWith(([IO.Path]::GetFullPath($desktopBase) + '\'), [StringComparison]::OrdinalIgnoreCase)) { throw 'Delivery path is outside PSI APP Branding.' }
if (-not (Test-Path -LiteralPath $deliveryTarget)) { New-Item -ItemType Directory -Path $deliveryTarget | Out-Null }
foreach ($entry in @('social', 'website', 'START-HERE.md', 'MEDIA-VALIDATION.md', 'OPENING-REVISION.md', 'PARTNER-REVISION.md', 'DYNO-RESTORATION.md', 'OPENING-ARTWORK-PROMPTS.md', 'PSI-App-Promo-Pack-2026-09-13.zip')) {
    $sourceEntry = Join-Path $campaignSource $entry
    $sourceFiles = if (Test-Path -LiteralPath $sourceEntry -PathType Container) { Get-ChildItem -LiteralPath $sourceEntry -Recurse -File } else { Get-Item -LiteralPath $sourceEntry }
    foreach ($sourceFile in $sourceFiles) {
        $relativeFile = $sourceFile.FullName.Substring($campaignSource.Length + 1)
        $targetFile = [IO.Path]::GetFullPath((Join-Path $deliveryTarget $relativeFile))
        if (-not $targetFile.StartsWith(($deliveryTarget + '\'), [StringComparison]::OrdinalIgnoreCase)) { throw 'Copy target escaped the delivery folder.' }
        if (Test-Path -LiteralPath $targetFile) {
            if ((Get-FileHash -LiteralPath $sourceFile.FullName).Hash -ne (Get-FileHash -LiteralPath $targetFile).Hash) { throw "Existing delivery differs: $relativeFile. Preserve and inspect it." }
            continue
        }
        $targetParent = Split-Path -Parent $targetFile
        if (-not (Test-Path -LiteralPath $targetParent)) { New-Item -ItemType Directory -Path $targetParent | Out-Null }
        Copy-Item -LiteralPath $sourceFile.FullName -Destination $targetFile
    }
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
$standaloneSource = Join-Path $campaignSource 'social\PSI-Dyno-Artwork-Clean.png'
$standaloneTarget = [IO.Path]::GetFullPath('C:\Users\PSI PERFORMANCE\Desktop\PSI APP\PSI App - Dyno Artwork.png')
if (-not (Test-Path -LiteralPath $standaloneTarget)) { Copy-Item -LiteralPath $standaloneSource -Destination $standaloneTarget }
if ((Get-FileHash -LiteralPath $standaloneSource).Hash -ne (Get-FileHash -LiteralPath $standaloneTarget).Hash) { throw 'Standalone artwork copy did not match.' }
Write-Output 'Standalone dyno artwork saved directly in PSI APP; hash verified.'
