$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$sourceRoot = Join-Path $repoRoot "docs\design\generated-sources"
$publicRoot = Join-Path $repoRoot "games\side-scroller\public\images\generated"

function New-ResizedBitmap([string]$source, [int]$width, [int]$height, [bool]$opaque) {
  $input = [Drawing.Bitmap]::new($source)
  $format = if ($opaque) { [Drawing.Imaging.PixelFormat]::Format24bppRgb } else { [Drawing.Imaging.PixelFormat]::Format32bppArgb }
  $output = [Drawing.Bitmap]::new($width, $height, $format)
  $graphics = [Drawing.Graphics]::FromImage($output)
  try {
    $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    if (-not $opaque) { $graphics.Clear([Drawing.Color]::Transparent) }
    $graphics.DrawImage($input, 0, 0, $width, $height)
  } finally {
    $graphics.Dispose()
    $input.Dispose()
  }
  return $output
}

$backgroundDir = Join-Path $publicRoot "backgrounds"
$characterDir = Join-Path $publicRoot "characters"
New-Item -ItemType Directory -Force -Path $backgroundDir, $characterDir | Out-Null

$background = New-ResizedBitmap (Join-Path $sourceRoot "sf-approved-forest-battle-v2-source.png") 1600 900 $true
try {
  $jpegCodec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq "image/jpeg"
  $quality = [Drawing.Imaging.EncoderParameters]::new(1)
  $quality.Param[0] = [Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality, 88L)
  $background.Save((Join-Path $backgroundDir "sf-approved-forest-battle-v2.jpg"), $jpegCodec, $quality)
  $quality.Dispose()
} finally {
  $background.Dispose()
}

$hero = New-ResizedBitmap (Join-Path $sourceRoot "sf-hero-approved-lunge-v2-source.png") 640 320 $false
try { $hero.Save((Join-Path $characterDir "sf-hero-approved-lunge-v2.png"), [Drawing.Imaging.ImageFormat]::Png) }
finally { $hero.Dispose() }

@("idle", "run", "attack") | ForEach-Object {
  $pose = $_
  $poseBitmap = New-ResizedBitmap (Join-Path $sourceRoot "sf-hero-approved-$pose-v3-source.png") 640 320 $false
  try { $poseBitmap.Save((Join-Path $characterDir "sf-hero-approved-$pose-v3.png"), [Drawing.Imaging.ImageFormat]::Png) }
  finally { $poseBitmap.Dispose() }
}

$boss = New-ResizedBitmap (Join-Path $sourceRoot "sf-boss-approved-ogre-v2-source.png") 576 384 $false
try { $boss.Save((Join-Path $characterDir "sf-boss-approved-ogre-v2.png"), [Drawing.Imaging.ImageFormat]::Png) }
finally { $boss.Dispose() }

Get-Item (Join-Path $backgroundDir "sf-approved-forest-battle-v2.jpg"),
  (Join-Path $characterDir "sf-hero-approved-lunge-v2.png"),
  (Join-Path $characterDir "sf-hero-approved-idle-v3.png"),
  (Join-Path $characterDir "sf-hero-approved-run-v3.png"),
  (Join-Path $characterDir "sf-hero-approved-attack-v3.png"),
  (Join-Path $characterDir "sf-boss-approved-ogre-v2.png") |
  Select-Object FullName, Length
