$ErrorActionPreference = "Stop"

# The Nasdaq-100-only source used a finer-grained taxonomy instead of standard
# GICS sectors for these 14 tickers. Correct `sector` to the real GICS sector
# (the original finer-grained value is preserved in `sub_industry`, which is
# where it belongs).
$sectorFix = @{
  "ALNY" = "Health Care"
  "ARM"  = "Information Technology"
  "ASML" = "Information Technology"
  "CCEP" = "Consumer Staples"
  "EA"   = "Communication Services"
  "FER"  = "Industrials"
  "INSM" = "Health Care"
  "MELI" = "Consumer Discretionary"
  "MSTR" = "Information Technology"
  "PDD"  = "Consumer Discretionary"
  "SHOP" = "Information Technology"
  "TEAM" = "Information Technology"
  "TRI"  = "Industrials"
  "ZS"   = "Information Technology"
}

$path = "C:\Users\andre\stock-analysis\data\sp500_nasdaq100_weekly_prices.csv"
$csv = Import-Csv $path
$changed = 0
foreach ($row in $csv) {
  if ($sectorFix.ContainsKey($row.ticker)) {
    $row.sector = $sectorFix[$row.ticker]
    $changed++
  }
}
Write-Output "Rows corrected: $changed"
$csv | Export-Csv -Path $path -NoTypeInformation

# Verify
$check = Import-Csv $path
$stillBad = $check | Where-Object { $sectorFix.ContainsKey($_.ticker) -and $_.sector -ne $sectorFix[$_.ticker] }
Write-Output "Rows still mismatched after fix: $($stillBad.Count)"
Write-Output "Distinct sectors now: $(($check.sector | Sort-Object -Unique) -join ', ')"
