$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$sourcePath = Join-Path $repoRoot "docs\design\mocks\karma-quest-flow.png"
$outputDirectory = Join-Path $repoRoot "games\karma-quest\public\images\mock-extracts"
$outputPath = Join-Path $outputDirectory "kq-approved-avatar-visible.png"

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

# The approved home mock contains only this circular 52 x 52 portrait.
# Preserve every source RGB value inside the visible circle and make only the
# pixels outside that circle transparent. No hidden body or face is generated.
$source = [System.Drawing.Bitmap]::FromFile($sourcePath)
$output = [System.Drawing.Bitmap]::new(
  52,
  52,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)

try {
  for ($y = 0; $y -lt 52; $y++) {
    for ($x = 0; $x -lt 52; $x++) {
      $dx = $x - 25.5
      $dy = $y - 25.5
      if (($dx * $dx + $dy * $dy) -le 650.25) {
        $output.SetPixel($x, $y, $source.GetPixel(13 + $x, 230 + $y))
      }
    }
  }
  $output.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $output.Dispose()
  $source.Dispose()
}

Write-Output $outputPath
