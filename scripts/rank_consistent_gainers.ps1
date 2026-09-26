$ErrorActionPreference = "Stop"

$csv = Import-Csv "C:\Users\andre\stock-analysis\data\sp500_nasdaq100_weekly_prices.csv"
$byTicker = $csv | Group-Object ticker

$MinWeeks = 240  # ~92% of the max 262 weeks; excludes tickers without a near-complete 5yr history

$stats = foreach ($g in $byTicker) {
  $rows = $g.Group | Sort-Object date
  $returns = $rows.weekly_return | Where-Object { $_ -ne $null -and $_ -ne '' } | ForEach-Object { [double]$_ }
  $weekCount = $rows.Count

  if ($returns.Count -lt $MinWeeks) { continue }

  $mean = ($returns | Measure-Object -Average).Average
  $variance = ($returns | ForEach-Object { [Math]::Pow(($_ - $mean), 2) } | Measure-Object -Average).Average
  $stdev = [Math]::Sqrt($variance)
  if ($stdev -eq 0) { continue }

  $riskAdjustedScore = $mean / $stdev

  $firstClose = [double]$rows[0].close
  $lastClose = [double]($rows | Select-Object -Last 1).close
  $cumulativeReturn = ($lastClose - $firstClose) / $firstClose

  [pscustomobject]@{
    Ticker           = $g.Name
    Company          = $rows[0].company
    Sector           = $rows[0].sector
    IndexMembership  = $rows[0].index_membership
    Weeks            = $weekCount
    MeanWeeklyReturn = [Math]::Round($mean, 5)
    StdevWeeklyReturn= [Math]::Round($stdev, 5)
    RiskAdjustedScore= [Math]::Round($riskAdjustedScore, 4)
    CumulativeReturn = [Math]::Round($cumulativeReturn, 4)
  }
}

Write-Output "Tickers eligible (>= $MinWeeks weeks of data): $($stats.Count) of $($byTicker.Count)"

$spPool = $stats | Where-Object { $_.IndexMembership -eq "S&P 500" -or $_.IndexMembership -eq "Both" }
$ndxPool = $stats | Where-Object { $_.IndexMembership -eq "Nasdaq 100" -or $_.IndexMembership -eq "Both" }

Write-Output "S&P 500 eligible pool: $($spPool.Count) tickers"
Write-Output "Nasdaq 100 eligible pool: $($ndxPool.Count) tickers"

$spTop25 = $spPool | Sort-Object RiskAdjustedScore -Descending | Select-Object -First 25
$ndxTop25 = $ndxPool | Sort-Object RiskAdjustedScore -Descending | Select-Object -First 25

$overlap = $spTop25.Ticker | Where-Object { $ndxTop25.Ticker -contains $_ }
Write-Output "Overlap between the two top-25 lists: $($overlap.Count) tickers ($($overlap -join ', '))"

$spTop25 | Export-Csv "C:\Users\andre\stock-analysis\data\sp500_top25_consistent_gainers.csv" -NoTypeInformation
$ndxTop25 | Export-Csv "C:\Users\andre\stock-analysis\data\nasdaq100_top25_consistent_gainers.csv" -NoTypeInformation

Write-Output ""
Write-Output "=== S&P 500 Top 25 (risk-adjusted score) ==="
$spTop25 | Select-Object Ticker, Company, Sector, RiskAdjustedScore, CumulativeReturn | Format-Table -AutoSize

Write-Output "=== Nasdaq 100 Top 25 (risk-adjusted score) ==="
$ndxTop25 | Select-Object Ticker, Company, Sector, RiskAdjustedScore, CumulativeReturn | Format-Table -AutoSize
