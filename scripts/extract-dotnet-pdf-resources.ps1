param(
  [Parameter(Mandatory = $true)][string]$SourceExe,
  [Parameter(Mandatory = $true)][string]$OutputDir
)

$resolvedExe = (Resolve-Path -LiteralPath $SourceExe).Path
$resolvedOutput = [IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

$assembly = [Reflection.Assembly]::LoadFrom($resolvedExe)
$resourceName = $assembly.GetManifestResourceNames() |
  Where-Object { $_ -eq 'Matematika_Test_Print.Properties.Resources.resources' } |
  Select-Object -First 1

if (-not $resourceName) {
  throw "Matematika Test Print resource bundle was not found in $resolvedExe"
}

$stream = $assembly.GetManifestResourceStream($resourceName)
$reader = [Resources.ResourceReader]::new($stream)
$enumerator = $reader.GetEnumerator()
$written = 0

try {
  while ($enumerator.MoveNext()) {
    $value = $enumerator.Value
    if ($value -isnot [byte[]] -or $value.Length -lt 5) { continue }
    if ([Text.Encoding]::ASCII.GetString($value, 0, 5) -ne '%PDF-') { continue }

    $safeName = ($enumerator.Key -replace '[^A-Za-z0-9_.-]', '_') + '.pdf'
    [IO.File]::WriteAllBytes((Join-Path $resolvedOutput $safeName), $value)
    $written++
  }
}
finally {
  $reader.Close()
}

if ($written -ne 33) {
  throw "Expected 33 embedded PDFs, extracted $written"
}

Write-Output "Extracted $written embedded PDFs to $resolvedOutput"
