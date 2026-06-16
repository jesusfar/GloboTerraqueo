param(
  [string]$InputExcel = "uploads/top_200_universidades_QS_2026_con_ARG_LATAM_recomendadas.xlsx",
  [string]$TrackerExcel = "uploads/universidades_tracker_actualizado.xlsx",
  [string]$OutputJs = "universidades.js",
  [int]$TargetYear = 2025,
  [switch]$SkipTracker,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not $SkipTracker) {
  $trackerArgs = @(
    "tools/universidad_tracker/universidad_ranking_tracker.py",
    "--input", $InputExcel,
    "--output", $TrackerExcel,
    "--all-sheets",
    "--target-year", "$TargetYear"
  )

  if ($Force) {
    $trackerArgs += "--force"
  }

  python @trackerArgs
}

$sourceExcel = if (Test-Path $TrackerExcel) { $TrackerExcel } else { $InputExcel }
python tools/export_universidades_js.py --input $sourceExcel --output $OutputJs --target-year $TargetYear

Write-Host "Universidades actualizadas desde $sourceExcel -> $OutputJs"
