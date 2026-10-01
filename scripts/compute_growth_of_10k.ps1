$ErrorActionPreference = "Stop"

# Growth of $10,000: $10,000 split equally across each group's tickers at the start of the
# panel and left alone (no rebalancing, no dividends, no costs). Each ticker is indexed to
# 1.0 at its first available close; a ticker with a later first week (all still >= 240 weekly
# returns) sits at 1.0 until it starts trading, and a missing week carries the last value
# forward. The last row therefore equals 10,000 x (1 + average cumulative return), the same
# averages reported in the report's Finding 7.
$csv = Import-Csv "C:\Users\andre\stock-analysis\data\sp500_nasdaq100_weekly_prices.csv"
$byTicker = $csv | Group-Object ticker
$MinWeeks = 240
$dates = $csv.date | Sort-Object -Unique

$spTop = (Import-Csv "C:\Users\andre\stock-analysis\data\sp500_top25_consistent_gainers.csv").Ticker
$ndxTop = (Import-Csv "C:\Users\andre\stock-analysis\data\nasdaq100_top25_consistent_gainers.csv").Ticker

# Per eligible ticker: its index (first close = 1.0) on every date of the panel.
$curves = @{}
$membership = @{}
foreach ($g in $byTicker) {
  $rows = $g.Group | Sort-Object date
  $returns = @($rows.weekly_return | Where-Object { $_ -ne $null -and $_ -ne '' })
  if ($returns.Count -lt $MinWeeks) { continue }
  $first = [double]$rows[0].close
  $closeByDate = @{}
  foreach ($r in $rows) { $closeByDate[$r.date] = [double]$r.close / $first }
  $last = 1.0
  $curve = foreach ($d in $dates) {
    if ($closeByDate.ContainsKey($d)) { $last = $closeByDate[$d] }
    $last
  }
  $curves[$g.Name] = @($curve)
  $membership[$g.Name] = $rows[0].index_membership
}

function Select-Eligible($names) { $names | Where-Object { $curves.ContainsKey($_) } }
# Note: use GetEnumerator, not .Keys - the ticker KEYS (Keysight) would shadow the hashtable property.
$spAll = $membership.GetEnumerator() | Where-Object { $_.Value -in @("S&P 500", "Both") } | ForEach-Object { $_.Key }
$ndxAll = $membership.GetEnumerator() | Where-Object { $_.Value -in @("Nasdaq 100", "Both") } | ForEach-Object { $_.Key }

function Get-Series($names) {
  $names = @(Select-Eligible $names)
  for ($i = 0; $i -lt $dates.Count; $i++) {
    $sum = 0.0
    foreach ($n in $names) { $sum += $curves[$n][$i] }
    [Math]::Round(10000 * $sum / $names.Count, 0)
  }
}

$sp25 = @(Get-Series $spTop); $spA = @(Get-Series $spAll)
$nq25 = @(Get-Series $ndxTop); $nqA = @(Get-Series $ndxAll)

$out = for ($i = 0; $i -lt $dates.Count; $i++) {
  [pscustomobject]@{ date = $dates[$i]; sp500_top25 = $sp25[$i]; sp500_all = $spA[$i]; nasdaq100_top25 = $nq25[$i]; nasdaq100_all = $nqA[$i] }
}
$out | Export-Csv "C:\Users\andre\stock-analysis\data\growth_of_10k.csv" -NoTypeInformation

Write-Output "Pools: S&P all=$(@($spAll).Count) top25=$(@(Select-Eligible $spTop).Count); Nasdaq all=$(@($ndxAll).Count) top25=$(@(Select-Eligible $ndxTop).Count)"
Write-Output "Final values: $($out[-1] | Format-List | Out-String)"
