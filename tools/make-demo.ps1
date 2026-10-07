# Builds dist\Partnership Review - DEMO.html: the real tool, opened on a made-up
# team with two weeks of made-up exports already loaded. Safe to show anyone.
# Run build.ps1 first.
#   .\tools\make-demo.ps1
#   .\tools\make-demo.ps1 -Screenshots    also saves pictures of each screen to dist\screens

param([switch]$Screenshots)

$here = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$utf8 = New-Object System.Text.UTF8Encoding($false)
$tool = Join-Path $here "dist\Partnership Review.html"
if (-not (Test-Path $tool)) { Write-Output "Run build.ps1 first."; exit 1 }

$html = [IO.File]::ReadAllText($tool, $utf8)
$fixtures = [IO.File]::ReadAllText((Join-Path $here "tests\fixtures.js"), $utf8)
$demo = [IO.File]::ReadAllText((Join-Path $here "tools\demo-data.js"), $utf8)
$inject = "<script>`n" + $fixtures + "`n" + $demo + "`n</script>`n"
$at = $html.LastIndexOf("</body>")
$out = Join-Path $here "dist\Partnership Review - DEMO.html"
[IO.File]::WriteAllText($out, $html.Substring(0, $at) + $inject + $html.Substring($at), $utf8)
Write-Output "Built $out"

if ($Screenshots) {
  $edge = @("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            "C:\Program Files\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  $shots = Join-Path $here "dist\screens"
  New-Item -ItemType Directory -Force $shots | Out-Null
  $profile = Join-Path $env:TEMP "partnership-review-demo-profile"
  $url = "file:///" + $out.Replace("\", "/").Replace(" ", "%20")
  $views = @(@("team", "", 4300), @("controls", "#controls", 7400), @("presenter", "#present", 3900),
             @("preview", "#preview", 1100), @("home", "#home", 900), @("details", "#details", 900), @("newuser", "#newuser", 900))
  foreach ($v in $views) {
    $png = Join-Path $shots ($v[0] + ".png")
    & $edge --headless=new --disable-gpu --no-first-run --hide-scrollbars "--user-data-dir=$profile" `
      "--window-size=1240,$($v[2])" --virtual-time-budget=30000 "--screenshot=$png" ($url + $v[1]) 2>$null | Out-Null
    if (Test-Path $png) { Write-Output "  $png" } else { Write-Output "  (no screenshot for $($v[0]))" }
  }
}
