$ErrorActionPreference = "Stop"

$csv = Import-Csv "C:\Users\andre\stock-analysis\data\sp500_nasdaq100_weekly_prices.csv"
$byTicker = $csv | Group-Object ticker
$MinWeeks = 240

$stats = foreach ($g in $byTicker) {
  $rows = $g.Group | Sort-Object date
  $returns = $rows.weekly_return | Where-Object { $_ -ne $null -and $_ -ne '' } | ForEach-Object { [double]$_ }
  $weekCount = $rows.Count
  $eligible = $returns.Count -ge $MinWeeks

  $firstClose = [double]$rows[0].close
  $lastClose = [double]($rows | Select-Object -Last 1).close
  $cumulativeReturn = ($lastClose - $firstClose) / $firstClose

  $obj = [pscustomobject]@{
    Ticker = $g.Name; Company = $rows[0].company; Sector = $rows[0].sector
    IndexMembership = $rows[0].index_membership; Weeks = $weekCount
    Eligible = $eligible; CumulativeReturn = $cumulativeReturn
    MeanWeeklyReturn = $null; StdevWeeklyReturn = $null; RiskAdjustedScore = $null
  }
  if ($eligible) {
    $mean = ($returns | Measure-Object -Average).Average
    $variance = ($returns | ForEach-Object { [Math]::Pow(($_ - $mean),2) } | Measure-Object -Average).Average
    $stdev = [Math]::Sqrt($variance)
    $obj.MeanWeeklyReturn = $mean
    $obj.StdevWeeklyReturn = $stdev
    $obj.RiskAdjustedScore = if ($stdev -eq 0) { 0 } else { $mean / $stdev }
  }
  $obj
}

Write-Output "=== EXCLUDED (insufficient history) ==="
$excluded = $stats | Where-Object { -not $_.Eligible }
Write-Output "Count: $($excluded.Count)"
$excluded | Select-Object Ticker, Company, Weeks | Sort-Object Weeks | Format-Table -AutoSize

function PoolFor($side) {
  if ($side -eq "sp") { $stats | Where-Object { $_.Eligible -and ($_.IndexMembership -eq "S&P 500" -or $_.IndexMembership -eq "Both") } }
  else { $stats | Where-Object { $_.Eligible -and ($_.IndexMembership -eq "Nasdaq 100" -or $_.IndexMembership -eq "Both") } }
}

foreach ($side in @("sp","ndx")) {
  $pool = PoolFor $side
  $top25 = $pool | Sort-Object RiskAdjustedScore -Descending | Select-Object -First 25

  Write-Output ""
  Write-Output "=== $side pool ==="
  Write-Output "Eligible pool size: $($pool.Count)"
  $avgVolAll = ($pool.StdevWeeklyReturn | Measure-Object -Average).Average
  $avgCumAll = ($pool.CumulativeReturn | Measure-Object -Average).Average
  $avgVolTop = ($top25.StdevWeeklyReturn | Measure-Object -Average).Average
  $avgCumTop = ($top25.CumulativeReturn | Measure-Object -Average).Average
  Write-Output ("Avg weekly volatility (stdev) - all eligible: {0:P3}" -f $avgVolAll)
  Write-Output ("Avg weekly volatility (stdev) - top25: {0:P3}" -f $avgVolTop)
  Write-Output ("Avg cumulative return - all eligible: {0:P1}" -f $avgCumAll)
  Write-Output ("Avg cumulative return - top25: {0:P1}" -f $avgCumTop)

  Write-Output "Sector counts in top25:"
  $top25 | Group-Object Sector | Sort-Object Count -Descending | Select-Object Name, Count | Format-Table -AutoSize

  $highestCumOverall = $pool | Sort-Object CumulativeReturn -Descending | Select-Object -First 1
  $highestCumRank = ($pool | Sort-Object RiskAdjustedScore -Descending | Select-Object Ticker).Ticker.IndexOf($highestCumOverall.Ticker) + 1
  Write-Output ("Highest cumulative-return ticker overall: {0} ({1}), cum return {2:P0}, but consistency rank #{3} of {4} (score {5:N3})" -f `
    $highestCumOverall.Ticker, $highestCumOverall.Company, $highestCumOverall.CumulativeReturn, $highestCumRank, $pool.Count, $highestCumOverall.RiskAdjustedScore)
}

Write-Output ""
Write-Output "=== Single biggest weekly moves (entire dataset) ==="
$allReturnsRows = $csv | Where-Object { $_.weekly_return -ne $null -and $_.weekly_return -ne '' } | ForEach-Object {
  [pscustomobject]@{ Ticker=$_.ticker; Company=$_.company; Date=$_.date; Ret=[double]$_.weekly_return }
}
$biggestGain = $allReturnsRows | Sort-Object Ret -Descending | Select-Object -First 1
$biggestDecline = $allReturnsRows | Sort-Object Ret | Select-Object -First 1
Write-Output ("Biggest single-week gain: {0} ({1}) on {2}: {3:P0}" -f $biggestGain.Ticker,$biggestGain.Company,$biggestGain.Date,$biggestGain.Ret)
Write-Output ("Biggest single-week decline: {0} ({1}) on {2}: {3:P0}" -f $biggestDecline.Ticker,$biggestDecline.Company,$biggestDecline.Date,$biggestDecline.Ret)

Write-Output ""
Write-Output "=== Dataset-wide headline stats ==="
$totalRows = $csv.Count
$totalTickers = $byTicker.Count
$eligibleTotal = ($stats | Where-Object Eligible).Count
$overallAvgReturn = (($stats | Where-Object Eligible).MeanWeeklyReturn | Measure-Object -Average).Average
Write-Output "Total rows: $totalRows"
Write-Output "Total tickers: $totalTickers"
Write-Output "Eligible tickers: $eligibleTotal"
Write-Output ("Overall avg weekly return across eligible universe: {0:P3}" -f $overallAvgReturn)
