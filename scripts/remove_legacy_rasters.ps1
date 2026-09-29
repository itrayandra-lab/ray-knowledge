$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$assetRoots = @(
  (Join-Path $workspace "public\assets\brands"),
  (Join-Path $workspace "public\assets\products"),
  (Join-Path $workspace "public\assets\collaborators")
)
$legacyExtensions = @(".jpg", ".jpeg", ".png")
$targets = @()

foreach ($assetRoot in $assetRoots) {
  $resolvedRoot = (Resolve-Path -LiteralPath $assetRoot).Path
  if (-not $resolvedRoot.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar)) {
    throw "Unsafe asset root: $resolvedRoot"
  }
  foreach ($file in Get-ChildItem -LiteralPath $resolvedRoot -Recurse -File) {
    if ($legacyExtensions -notcontains $file.Extension.ToLowerInvariant()) { continue }
    $webp = Join-Path $file.DirectoryName ($file.BaseName + ".webp")
    if (-not (Test-Path -LiteralPath $webp -PathType Leaf)) {
      throw "Refusing deletion; WebP counterpart is missing: $($file.FullName)"
    }
    $targets += $file
  }
}

foreach ($file in $targets) {
  Remove-Item -LiteralPath $file.FullName -Force
}

Write-Output "Removed $($targets.Count) legacy JPG/JPEG/PNG files after counterpart validation."
