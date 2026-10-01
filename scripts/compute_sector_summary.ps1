$ErrorActionPreference = "Stop"

# Sector summary behind the report's sector heatmap (Finding 11). For each index pool (S&P 500 pool =
# "S&P 500" + "Both"; Nasdaq 100 pool = "Nasdaq 100" + "Both") and each sector, over the eligible tickers
# (>= 240 weekly returns, same rule as the rankings): ticker count, simple (equal-weighted) averages of
# 5-year cumulative return, weekly volatility (population std. dev. of weekly return) and the risk-adjusted
# score (mean weekly return / std. dev.), plus the five highest-scoring tickers in the sector.
$csv = Import-Csv "C:\Users\andre\stock-analysis\data\sp500_nasdaq100_weekly_prices.csv"
$byTicker = $csv | Group-Object ticker
$MinWeeks = 240

$stats = foreach ($g in $byTicker) {
  $rows = $g.Group | Sort-Object date
  $returns = @($rows.weekly_return | Where-Object { $_ -ne $null -and $_ -ne '' } | ForEach-Object { [double]$_ })
  if ($returns.Count -lt $MinWeeks) { continue }
  $mean = ($returns | Measure-Object -Average).Average
  $variance = ($returns | ForEach-Object { [Math]::Pow(($_ - $mean), 2) } | Measure-Object -Average).Average
  $stdev = [Math]::Sqrt($variance)
  if ($stdev -eq 0) { continue }
  $first = [double]$rows[0].close
  $last = [double]($rows | Select-Object -Last 1).close
  [pscustomobject]@{
    Ticker = $g.Name; Sector = $rows[0].sector; IndexMembership = $rows[0].index_membership
    Volatility = $stdev; Score = $mean / $stdev; Cumulative = ($last - $first) / $first
  }
}

$pools = @(
  @{ Name = "S&P 500";    Members = @("S&P 500", "Both") },
  @{ Name = "Nasdaq 100"; Members = @("Nasdaq 100", "Both") }
)
$out = foreach ($pool in $pools) {
  $inPool = $stats | Where-Object { $_.IndexMembership -in $pool.Members }
  foreach ($sec in ($inPool | Group-Object Sector)) {
    $items = @($sec.Group)
    [pscustomobject]@{
      pool = $pool.Name
      sector = $sec.Name
      tickers = $items.Count
      avg_cumulative_return = [Math]::Round(($items | Measure-Object Cumulative -Average).Average, 4)
      avg_weekly_volatility = [Math]::Round(($items | Measure-Object Volatility -Average).Average, 5)
      avg_risk_adjusted_score = [Math]::Round(($items | Measure-Object Score -Average).Average, 4)
      top5_by_score = (($items | Sort-Object Score -Descending | Select-Object -First 5).Ticker -join "|")
    }
  }
}
$out | Sort-Object pool, @{ Expression = "tickers"; Descending = $true } | Export-Csv "C:\Users\andre\stock-analysis\data\sector_summary.csv" -NoTypeInformation
$out | Sort-Object pool, @{ Expression = "avg_cumulative_return"; Descending = $true } | Format-Table -AutoSize
