# Folds everything in src\ into one file: dist\Partnership Review.html
# That single file is the whole tool. It needs no internet and no install.
# Also writes dist\tests.html, the test page with everything inlined.
#   .\build.ps1

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $here "src"
$dist = Join-Path $here "dist"
$utf8 = New-Object System.Text.UTF8Encoding($false)
New-Item -ItemType Directory -Force $dist | Out-Null

function Read-Source([string]$path) {
  $t = [IO.File]::ReadAllText($path, $utf8)
  if ($t.Length -gt 0 -and $t[0] -eq [char]0xFEFF) { $t = $t.Substring(1) }
  # a closing script tag inside inlined script text would end the block early
  return $t
}
function Inline([string]$template, [string]$base) {
  $rx = [regex]'/\*\{\{([^}]+)\}\}\*/'
  return $rx.Replace($template, {
    param($m)
    $file = Join-Path $base ($m.Groups[1].Value -replace '/', '\')
    if (-not (Test-Path $file)) { throw "Missing source file: $file" }
    $body = Read-Source $file
    if ($file -like "*.js") { $body = $body -replace '</script', '<\/script' }
    return $body
  })
}

# ---- the tool ----
$html = Inline (Read-Source (Join-Path $src "index.template.html")) $src
$version = "unknown"
if ((Read-Source (Join-Path $src "core.js")) -match 'var APP_VERSION="([^"]+)"') { $version = $matches[1] }
$out = Join-Path $dist "Partnership Review.html"
[IO.File]::WriteAllText($out, $html, $utf8)

# ---- the test page, self-contained ----
$tests = Read-Source (Join-Path $here "tests\tests.html")
$rxBlock = [regex]'(?s)<!--SCRIPTS-->(.*?)<!--/SCRIPTS-->'
$tests = $rxBlock.Replace($tests, {
  param($m)
  $sb = New-Object System.Text.StringBuilder
  foreach ($s in [regex]::Matches($m.Groups[1].Value, 'src="([^"]+)"')) {
    $file = [IO.Path]::GetFullPath((Join-Path (Join-Path $here "tests") ($s.Groups[1].Value -replace '/', '\')))
    if (-not (Test-Path $file)) { throw "Missing test source: $file" }
    $body = (Read-Source $file) -replace '</script', '<\/script'
    [void]$sb.Append("<script>`n").Append($body).Append("`n</script>`n")
  }
  return $sb.ToString()
})
[IO.File]::WriteAllText((Join-Path $dist "tests.html"), $tests, $utf8)

$size = [Math]::Round((Get-Item $out).Length / 1KB)
Write-Output "Built Partnership Review $version"
Write-Output "  $out  ($size KB)"
Write-Output "  $(Join-Path $dist 'tests.html')"
