# Runs the test page in Edge without opening a window and prints the result.
# Exit code 0 when every test passes, 1 otherwise.
#   .\run-tests.ps1            all tests
#   .\run-tests.ps1 -Failures  only the failing ones
param([switch]$Failures)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = @("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
          "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
          "C:\Program Files\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Output "Edge or Chrome was not found."; exit 1 }

$page = "file:///" + (($here -replace '\\','/') -replace ' ','%20') + "/tests/tests.html"
$profile = Join-Path $env:TEMP "partnership-review-test-profile"
$dom = & $edge --headless=new --disable-gpu --no-first-run "--user-data-dir=$profile" --virtual-time-budget=60000 --dump-dom $page | Out-String

if ($dom -notmatch '(?s)<pre id="out"[^>]*>(.*?)</pre>') { Write-Output "The test page produced no output."; exit 1 }
$text = [System.Net.WebUtility]::HtmlDecode($matches[1])
$lines = $text -split "`n"
if ($Failures) {
  $keep = $false
  $lines = $lines | Where-Object {
    if ($_ -match '^FAIL') { $keep = $true; $true }
    elseif ($_ -match '^ok ') { $keep = $false; $false }
    elseif ($_ -match '^RESULT') { $true }
    else { $keep }
  }
}
$lines | ForEach-Object { Write-Output $_ }
if ($text -match 'RESULT: PASS') { exit 0 } else { exit 1 }
