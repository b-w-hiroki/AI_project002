$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$mockPath = Join-Path $repoRoot "docs\design\mocks\side-scroller-flow.png"
$capturePath = Join-Path $repoRoot "games\side-scroller\e2e\screenshots\side-approved-boss-battle-v2-844x390.png"
$outputPath = Join-Path $repoRoot "games\side-scroller\e2e\screenshots\side-approved-boss-battle-v2-comparison.png"

$capture = [Drawing.Bitmap]::new($capturePath)
$mock = [Drawing.Bitmap]::new($mockPath)
$headerHeight = 32
$panelWidth = $capture.Width
$panelHeight = $capture.Height
$output = [Drawing.Bitmap]::new($panelWidth * 2, $panelHeight + $headerHeight)
$graphics = [Drawing.Graphics]::FromImage($output)
try {
  $graphics.Clear([Drawing.Color]::FromArgb(11, 25, 35))
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawString("APPROVED MOCK (boss panel)", [Drawing.Font]::new("Arial", 14, [Drawing.FontStyle]::Bold), [Drawing.Brushes]::White, 12, 6)
  $graphics.DrawString("LIVE BUILD (native browser capture)", [Drawing.Font]::new("Arial", 14, [Drawing.FontStyle]::Bold), [Drawing.Brushes]::White, $panelWidth + 12, 6)

  # Approved flow sheet boss battle panel: x=17..713, y=612..973.
  $mockSource = [Drawing.Rectangle]::new(17, 612, 696, 361)
  $mockTarget = [Drawing.Rectangle]::new(0, $headerHeight, $panelWidth, $panelHeight)
  $graphics.DrawImage($mock, $mockTarget, $mockSource, [Drawing.GraphicsUnit]::Pixel)
  $graphics.DrawImage($capture, $panelWidth, $headerHeight, $panelWidth, $panelHeight)
} finally {
  $graphics.Dispose()
  $mock.Dispose()
  $capture.Dispose()
}

try { $output.Save($outputPath, [Drawing.Imaging.ImageFormat]::Png) }
finally { $output.Dispose() }

Get-Item $outputPath | Select-Object FullName, Length
