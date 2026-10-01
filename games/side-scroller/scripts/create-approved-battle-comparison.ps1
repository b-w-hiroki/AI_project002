$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$mockPath = Join-Path $repoRoot "docs\design\mocks\side-scroller-flow.png"
$runPath = Join-Path $repoRoot "games\side-scroller\e2e\screenshots\side-approved-hero-run-v3-800x600.png"
$contactPath = Join-Path $repoRoot "games\side-scroller\e2e\screenshots\side-approved-boss-melee-contact-v2-800x600.png"
$outputPath = Join-Path $repoRoot "games\side-scroller\e2e\screenshots\side-approved-boss-battle-v2-comparison.png"

$mock = [Drawing.Bitmap]::new($mockPath)
$run = [Drawing.Bitmap]::new($runPath)
$contact = [Drawing.Bitmap]::new($contactPath)
$headerHeight = 32
$panelWidth = 680
$panelHeight = 382
$rowHeight = $headerHeight + $panelHeight
$output = [Drawing.Bitmap]::new($panelWidth * 2, $rowHeight * 2)
$graphics = [Drawing.Graphics]::FromImage($output)
$font = [Drawing.Font]::new("Arial", 14, [Drawing.FontStyle]::Bold)

function Draw-Label([string]$text, [int]$x, [int]$y) {
  $graphics.DrawString($text, $font, [Drawing.Brushes]::White, $x + 12, $y + 6)
}

function Draw-Panel([Drawing.Bitmap]$image, [Drawing.Rectangle]$source, [int]$x, [int]$y) {
  $target = [Drawing.Rectangle]::new($x, $y + $headerHeight, $panelWidth, $panelHeight)
  $graphics.DrawImage($image, $target, $source, [Drawing.GraphicsUnit]::Pixel)
}

try {
  $graphics.Clear([Drawing.Color]::FromArgb(11, 25, 35))
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  Draw-Label "APPROVED MOCK — NORMAL BATTLE" 0 0
  Draw-Panel $mock ([Drawing.Rectangle]::new(724, 218, 710, 338)) 0 0
  Draw-Label "LIVE BUILD — RUN POSE + FOREGROUND" $panelWidth 0
  Draw-Panel $run ([Drawing.Rectangle]::new(0, 0, $run.Width, $run.Height)) $panelWidth 0

  Draw-Label "APPROVED MOCK — BOSS BATTLE" 0 $rowHeight
  Draw-Panel $mock ([Drawing.Rectangle]::new(17, 612, 696, 361)) 0 $rowHeight
  Draw-Label "LIVE BUILD — ATTACK CONTACT + BOSS" $panelWidth $rowHeight
  Draw-Panel $contact ([Drawing.Rectangle]::new(0, 0, $contact.Width, $contact.Height)) $panelWidth $rowHeight
} finally {
  $font.Dispose()
  $graphics.Dispose()
  $mock.Dispose()
  $run.Dispose()
  $contact.Dispose()
}

try { $output.Save($outputPath, [Drawing.Imaging.ImageFormat]::Png) }
finally { $output.Dispose() }

Get-Item $outputPath | Select-Object FullName, Length
