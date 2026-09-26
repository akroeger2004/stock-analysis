$ErrorActionPreference = "Continue"

# --- Load ticker universe with sector metadata ---
$spContent = (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv" -UseBasicParsing).Content
$spCsv = $spContent | ConvertFrom-Csv

$ndxContent = (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Gary-Strauss/NASDAQ100_Constituents/master/data/nasdaq100_constituents.csv" -UseBasicParsing).Content
$ndxCsv = $ndxContent | ConvertFrom-Csv

$meta = @{}
foreach ($row in $spCsv) {
  $meta[$row.Symbol] = [pscustomobject]@{
    Ticker      = $row.Symbol
    Company     = $row.Security
    Sector      = $row.'GICS Sector'
    SubIndustry = $row.'GICS Sub-Industry'
    InSP500     = $true
    InNasdaq100 = $false
  }
}
foreach ($row in $ndxCsv) {
  if ($meta.ContainsKey($row.Ticker)) {
    $meta[$row.Ticker].InNasdaq100 = $true
  } else {
    $meta[$row.Ticker] = [pscustomobject]@{
      Ticker      = $row.Ticker
      Company     = $row.Company
      Sector      = $row.GICS_Sector
      SubIndustry = $row.GICS_Sub_Industry
      InSP500     = $false
      InNasdaq100 = $true
    }
  }
}

$tickerList = $meta.Values | Sort-Object Ticker
Write-Output "Total unique tickers to fetch: $($tickerList.Count)"

# --- Fetch weekly OHLCV for each ticker ---
$allRows = [System.Collections.Generic.List[object]]::new()
$failed = [System.Collections.Generic.List[string]]::new()
$i = 0

foreach ($t in $tickerList) {
  $i++
  $yahooSymbol = $t.Ticker -replace '\.', '-'
  $indexMembership = if ($t.InSP500 -and $t.InNasdaq100) { "Both" } elseif ($t.InSP500) { "S&P 500" } else { "Nasdaq 100" }

  try {
    $resp = Invoke-WebRequest -Uri "https://query1.finance.yahoo.com/v8/finance/chart/$yahooSymbol`?range=5y&interval=1wk" -UseBasicParsing -Headers @{ "User-Agent" = "Mozilla/5.0" } -TimeoutSec 10
    $j = $resp.Content | ConvertFrom-Json
    $result = $j.chart.result[0]
    $timestamps = $result.timestamp
    $quote = $result.indicators.quote[0]

    if (-not $timestamps -or $timestamps.Count -eq 0) {
      $failed.Add($t.Ticker)
      continue
    }

    $prevClose = $null
    for ($k = 0; $k -lt $timestamps.Count; $k++) {
      $close = $quote.close[$k]
      if ($null -eq $close) { continue }
      $date = [DateTimeOffset]::FromUnixTimeSeconds($timestamps[$k]).UtcDateTime.ToString('yyyy-MM-dd')
      $weeklyReturn = if ($prevClose) { [Math]::Round((($close - $prevClose) / $prevClose), 6) } else { $null }

      $allRows.Add([pscustomobject]@{
        date            = $date
        ticker          = $t.Ticker
        company         = $t.Company
        sector          = $t.Sector
        sub_industry    = $t.SubIndustry
        index_membership= $indexMembership
        open            = $quote.open[$k]
        high            = $quote.high[$k]
        low             = $quote.low[$k]
        close           = $close
        volume          = $quote.volume[$k]
        weekly_return   = $weeklyReturn
      })
      $prevClose = $close
    }
  } catch {
    $failed.Add($t.Ticker)
  }

  if ($i % 50 -eq 0) {
    Write-Output "Processed $i / $($tickerList.Count) tickers, rows so far: $($allRows.Count), failed: $($failed.Count)"
  }
}

Write-Output "DONE. Tickers processed: $i, total rows: $($allRows.Count), failed tickers: $($failed.Count)"
if ($failed.Count -gt 0) { Write-Output "Failed: $($failed -join ', ')" }

$outPath = "C:\Users\andre\stock-analysis\data\sp500_nasdaq100_weekly_prices.csv"
$allRows | Export-Csv -Path $outPath -NoTypeInformation
Write-Output "Wrote CSV to: $outPath"
$fileInfo = Get-Item $outPath
Write-Output "File size: $([Math]::Round($fileInfo.Length / 1MB, 2)) MB"
