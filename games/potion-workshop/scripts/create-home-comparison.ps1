param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$gameRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = Resolve-Path (Join-Path $gameRoot "..\..")
$mockPath = Join-Path $repoRoot "docs\design\mocks\potion-workshop-flow.png"
$livePath = Join-Path $gameRoot "e2e\screenshots\portrait-workshop.png"
if (-not $OutputPath) {
  $OutputPath = Join-Path $gameRoot "e2e\screenshots\potion-approved-home-v2-comparison.png"
}

$mock = [Drawing.Image]::FromFile($mockPath)
$live = [Drawing.Image]::FromFile($livePath)
$canvas = [Drawing.Bitmap]::new(800, 884, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [Drawing.Graphics]::FromImage($canvas)
$graphics.Clear([Drawing.Color]::FromArgb(14, 29, 38))
$graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality

$font = [Drawing.Font]::new("Segoe UI", 15, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$brush = [Drawing.SolidBrush]::new([Drawing.Color]::White)
$graphics.DrawString("APPROVED MOCK · HOME", $font, $brush, 8, 9)
$graphics.DrawString("LIVE BUILD · STIRRING HOME", $font, $brush, 410, 9)

# The approved artboard contains four columns. Crop only the first home screen,
# retaining its complete top-to-bottom visual hierarchy.
$mockSource = [Drawing.Rectangle]::new(6, 157, 361, 811)
$mockDest = [Drawing.Rectangle]::new(7, 40, 376, 844)
$liveDest = [Drawing.Rectangle]::new(410, 40, 390, 844)
$graphics.DrawImage($mock, $mockDest, $mockSource, [Drawing.GraphicsUnit]::Pixel)
$graphics.DrawImage($live, $liveDest)

$canvas.Save($OutputPath, [Drawing.Imaging.ImageFormat]::Png)
$brush.Dispose()
$font.Dispose()
$graphics.Dispose()
$canvas.Dispose()
$mock.Dispose()
$live.Dispose()

Get-Item $OutputPath | Select-Object FullName, Length
