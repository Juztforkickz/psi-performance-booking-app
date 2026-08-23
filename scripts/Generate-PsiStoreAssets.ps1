param(
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$FeatureBackground
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$imagesRoot = Join-Path $RepositoryRoot 'mobile\assets\images'
$packRoot = Join-Path $RepositoryRoot 'artifacts\PSI APP'
$sourceIcon = Join-Path $imagesRoot 'psi-brand-source-1024.png'
$appIcon = Join-Path $imagesRoot 'psi-app-icon-1024.png'
$adaptiveIcon = Join-Path $imagesRoot 'psi-adaptive-foreground.png'
$splashLogo = Join-Path $imagesRoot 'psi-splash-logo.png'

New-Item -ItemType Directory -Force -Path $packRoot | Out-Null

if (-not (Test-Path -LiteralPath $sourceIcon)) {
    Copy-Item -LiteralPath $appIcon -Destination $sourceIcon
}

function Open-Bitmap([string]$Path) {
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $loaded = [System.Drawing.Image]::FromStream($stream)
        try { return [System.Drawing.Bitmap]::new($loaded) }
        finally { $loaded.Dispose() }
    }
    finally { $stream.Dispose() }
}

function New-Canvas([int]$Width, [int]$Height, [System.Drawing.Color]$Background) {
    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear($Background)
    $graphics.Dispose()
    return $bitmap
}

function Set-Quality([System.Drawing.Graphics]$Graphics) {
    $Graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
}

function Save-Png([System.Drawing.Bitmap]$Bitmap, [string]$Path) {
    $directory = Split-Path -Parent $Path
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $temporary = "$Path.tmp.png"
    $Bitmap.Save($temporary, [System.Drawing.Imaging.ImageFormat]::Png)
    Move-Item -Force -LiteralPath $temporary -Destination $Path
}

function Draw-Crop(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Bitmap]$Source,
    [System.Drawing.Rectangle]$Destination,
    [System.Drawing.Rectangle]$Crop
) {
    $Graphics.DrawImage($Source, $Destination, $Crop, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-Cover(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Bitmap]$Source,
    [System.Drawing.Rectangle]$Destination
) {
    $sourceRatio = $Source.Width / $Source.Height
    $targetRatio = $Destination.Width / $Destination.Height
    if ($sourceRatio -gt $targetRatio) {
        $cropWidth = [int]($Source.Height * $targetRatio)
        $crop = [System.Drawing.Rectangle]::new([int](($Source.Width - $cropWidth) / 2), 0, $cropWidth, $Source.Height)
    }
    else {
        $cropHeight = [int]($Source.Width / $targetRatio)
        $crop = [System.Drawing.Rectangle]::new(0, [int](($Source.Height - $cropHeight) / 2), $Source.Width, $cropHeight)
    }
    Draw-Crop $Graphics $Source $Destination $crop
}

function Resize-Png([string]$SourcePath, [string]$DestinationPath, [int]$Width, [int]$Height) {
    $source = Open-Bitmap $SourcePath
    try {
        $output = New-Canvas $Width $Height ([System.Drawing.Color]::Black)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($output)
            try {
                Set-Quality $graphics
                $graphics.DrawImage($source, 0, 0, $Width, $Height)
            }
            finally { $graphics.Dispose() }
            Save-Png $output $DestinationPath
        }
        finally { $output.Dispose() }
    }
    finally { $source.Dispose() }
}

$brand = Open-Bitmap $sourceIcon
try {
    # The source is the approved PSI artwork. This crop contains the PSI letterform only.
    $psiCrop = [System.Drawing.Rectangle]::new(116, 350, 792, 270)
    # This crop retains the approved PERFORMANCE GARAGE subtitle for splash/marketing use.
    $fullLogoCrop = [System.Drawing.Rectangle]::new(116, 350, 792, 330)

    $icon = New-Canvas 1024 1024 ([System.Drawing.Color]::FromArgb(255, 5, 5, 5))
    try {
        $g = [System.Drawing.Graphics]::FromImage($icon)
        try {
            Set-Quality $g
            Draw-Crop $g $brand ([System.Drawing.Rectangle]::new(96, 372, 832, 284)) $psiCrop
        }
        finally { $g.Dispose() }
        Save-Png $icon $appIcon
        Save-Png $icon (Join-Path $packRoot 'psi-app-icon-1024.png')

        $playIcon = New-Canvas 512 512 ([System.Drawing.Color]::FromArgb(255, 5, 5, 5))
        try {
            $g = [System.Drawing.Graphics]::FromImage($playIcon)
            try { Set-Quality $g; $g.DrawImage($icon, 0, 0, 512, 512) }
            finally { $g.Dispose() }
            Save-Png $playIcon (Join-Path $packRoot 'google-play-icon-512.png')
            Save-Png $playIcon (Join-Path $packRoot 'web-app-icon-512.png')
        }
        finally { $playIcon.Dispose() }

        $web192 = New-Canvas 192 192 ([System.Drawing.Color]::FromArgb(255, 5, 5, 5))
        try {
            $g = [System.Drawing.Graphics]::FromImage($web192)
            try { Set-Quality $g; $g.DrawImage($icon, 0, 0, 192, 192) }
            finally { $g.Dispose() }
            Save-Png $web192 (Join-Path $packRoot 'web-app-icon-192.png')
        }
        finally { $web192.Dispose() }
    }
    finally { $icon.Dispose() }

    $adaptive = New-Canvas 1024 1024 ([System.Drawing.Color]::Transparent)
    try {
        $g = [System.Drawing.Graphics]::FromImage($adaptive)
        try {
            Set-Quality $g
            Draw-Crop $g $brand ([System.Drawing.Rectangle]::new(188, 402, 648, 221)) $psiCrop
        }
        finally { $g.Dispose() }
        Save-Png $adaptive $adaptiveIcon
        Save-Png $adaptive (Join-Path $packRoot 'android-adaptive-foreground-1024.png')
    }
    finally { $adaptive.Dispose() }

    $splash = New-Canvas 1200 500 ([System.Drawing.Color]::Transparent)
    try {
        $g = [System.Drawing.Graphics]::FromImage($splash)
        try {
            Set-Quality $g
            Draw-Crop $g $brand ([System.Drawing.Rectangle]::new(100, 44, 1000, 417)) $fullLogoCrop
        }
        finally { $g.Dispose() }
        Save-Png $splash $splashLogo
        Save-Png $splash (Join-Path $packRoot 'psi-splash-logo-1200x500.png')
    }
    finally { $splash.Dispose() }

    $splashPreview = New-Canvas 1290 2796 ([System.Drawing.Color]::FromArgb(255, 5, 5, 5))
    try {
        $g = [System.Drawing.Graphics]::FromImage($splashPreview)
        try {
            Set-Quality $g
            Draw-Crop $g $brand ([System.Drawing.Rectangle]::new(145, 1120, 1000, 417)) $fullLogoCrop
            $goldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 217, 179, 91))
            try { $g.FillRectangle($goldBrush, 485, 1594, 320, 8) }
            finally { $goldBrush.Dispose() }
        }
        finally { $g.Dispose() }
        Save-Png $splashPreview (Join-Path $packRoot 'splash-screen-preview-1290x2796.png')
    }
    finally { $splashPreview.Dispose() }

    if ($FeatureBackground -and (Test-Path -LiteralPath $FeatureBackground)) {
        $background = Open-Bitmap $FeatureBackground
        try {
            $feature = New-Canvas 1024 500 ([System.Drawing.Color]::FromArgb(255, 5, 5, 5))
            try {
                $g = [System.Drawing.Graphics]::FromImage($feature)
                try {
                    Set-Quality $g
                    Draw-Cover $g $background ([System.Drawing.Rectangle]::new(0, 0, 1024, 500))

                    $overlay = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
                        [System.Drawing.Rectangle]::new(0, 0, 650, 500),
                        [System.Drawing.Color]::FromArgb(238, 0, 0, 0),
                        [System.Drawing.Color]::FromArgb(0, 0, 0, 0),
                        [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
                    )
                    try { $g.FillRectangle($overlay, 0, 0, 650, 500) }
                    finally { $overlay.Dispose() }

                    Draw-Crop $g $brand ([System.Drawing.Rectangle]::new(64, 118, 390, 163)) $fullLogoCrop
                    $goldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 217, 179, 91))
                    $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
                    $font = [System.Drawing.Font]::new('Arial', 17, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
                    try {
                        $g.FillRectangle($goldBrush, 64, 312, 86, 5)
                        $g.DrawString('YOUR VEHICLE. YOUR HISTORY. YOUR NEXT PLAN.', $font, $whiteBrush, 64, 337)
                    }
                    finally {
                        $font.Dispose()
                        $whiteBrush.Dispose()
                        $goldBrush.Dispose()
                    }
                }
                finally { $g.Dispose() }
                Save-Png $feature (Join-Path $packRoot 'google-play-feature-graphic-1024x500.png')
            }
            finally { $feature.Dispose() }
        }
        finally { $background.Dispose() }
    }
}
finally { $brand.Dispose() }

$screenshotsRoot = Join-Path $packRoot 'screenshots'
$storeScreenshotsRoot = Join-Path $screenshotsRoot 'store-1290x2796'
if (Test-Path -LiteralPath $screenshotsRoot) {
    New-Item -ItemType Directory -Force -Path $storeScreenshotsRoot | Out-Null
    Get-ChildItem -LiteralPath $screenshotsRoot -File -Filter '*-480x1040.png' | ForEach-Object {
        $destinationName = $_.Name.Replace('-480x1040.png', '-1290x2796.png')
        Resize-Png $_.FullName (Join-Path $storeScreenshotsRoot $destinationName) 1290 2796
    }
}

Write-Output $packRoot
