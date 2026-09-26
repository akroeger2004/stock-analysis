# Stock Analysis — Data Website Project

Financial Data Analytics course project: a two-page site (a scrollable report and an
interactive dashboard) built around a panel of weekly S&P 500 and Nasdaq 100 stock
prices spanning 2021 through 2026, ranking which companies gained the most
*consistently* — not just the most — and comparing the two indices' most consistent
gainers side by side.

## Data

**Source.** Constituent lists for the S&P 500 (503 tickers) and Nasdaq 100 (101
tickers) came from public GitHub datasets mirroring each index's official
membership. Weekly price history (open, high, low, close, volume) for all 517
unique tickers was fetched directly from Yahoo Finance's public historical-chart
API (`query1.finance.yahoo.com/v8/finance/chart/`) for the trailing 5 years (up to
262 weeks per ticker, through September 2026). Prices are split-adjusted as
provided by that API.

**One row** = one ticker in one calendar week, tagged with an `index_membership`
column (`S&P 500`, `Nasdaq 100`, or `Both`) so a ticker's rows count toward
whichever index ranking(s) it actually belongs to.

Rows dropped / corrected:
- No price rows are dropped from the raw fetch — all 133,557 successfully-returned
  weekly bars for all 517 tickers are kept in `data/sp500_nasdaq100_weekly_prices.csv`.
- 12 tickers are excluded from the *consistency rankings* (not from the raw data
  file) for having fewer than 240 of the possible 262 weeks of history (recent
  spinoffs, IPOs, or — in Electronic Arts' case — a 2026 going-private buyout that
  triggered delisting). See Finding 8 in the report for the full list and reasoning.
- 14 Nasdaq-100-only tickers originally carried a finer-grained, inconsistent
  sector taxonomy from their source list (e.g. "Biotechnology" instead of "Health
  Care"). These were corrected to the same 11-category GICS sector standard used
  everywhere else, so every sector-based chart/filter compares like with like.

How derived numbers are computed:
- **Weekly return** = (this week's close − last week's close) ÷ last week's close.
- **Risk-adjusted consistency score** = mean weekly return ÷ standard deviation of
  weekly return, over whichever period is in view. This rewards steady gainers over
  stocks that are merely volatile-and-lucky.
- **Cumulative return** = (last close − first close) ÷ first close, over the period
  in view.
- **"Top 25 most consistent"** = the 25 highest risk-adjusted scores among eligible
  tickers (≥240 weeks of history) within an index's membership pool (S&P 500 pool =
  `S&P 500` + `Both`; Nasdaq 100 pool = `Nasdaq 100` + `Both`).
- All averages reported are simple, equal-weighted means — no market-cap weighting
  is applied anywhere in the report or dashboard.

## Files

| File | What it does |
|---|---|
| `index.html` | The report page: title, byline, a summary, 5 headline numbers, 9 findings with charts, and a closing data-methodology section. |
| `dashboard.html` | The interactive dashboard: two side-by-side panels (S&P 500 / Nasdaq 100), shared filters (year range, sector, ticker search, view, measure, breakdown), 4 charts and a sortable table per panel, and a click-to-inspect ticker detail overlay. |
| `css/style.css` | Shared dark finance-themed styling (nav bar, ticker tape, cards, filters, tables, overlay) for both pages. |
| `js/data.js` | Loads and parses `data/sp500_nasdaq100_weekly_prices.csv` in the browser and computes per-ticker consistency stats on demand. Used only by `dashboard.html`. |
| `js/dashboard.js` | All dashboard interactivity: filtering, the two index panels' charts/tables/stat tiles, the ticker detail overlay, and the reset button. |
| `js/report.js` | Builds the report page's 9 charts from pre-computed numbers (see the scripts below for how each number was derived). |
| `data/sp500_nasdaq100_weekly_prices.csv` | The panel dataset: 133,557 rows, one per ticker per week (2021-09 to 2026-09), with sector/index-membership flags and OHLCV + weekly-return numbers. Fetched directly by `dashboard.html`. |
| `data/sp500_top25_consistent_gainers.csv` | The 25 most consistent S&P 500 gainers by risk-adjusted score, with their stats. |
| `data/nasdaq100_top25_consistent_gainers.csv` | The 25 most consistent Nasdaq 100 gainers by risk-adjusted score, with their stats. |
| `scripts/fetch_weekly_prices.ps1` | Builds the S&P 500 + Nasdaq 100 ticker universe and fetches 5 years of weekly OHLCV for all 517 tickers from Yahoo Finance, producing the main panel CSV. |
| `scripts/fix_sector_taxonomy.ps1` | One-time correction of the 14 Nasdaq-only tickers' mismatched sector labels to standard GICS sectors. |
| `scripts/rank_consistent_gainers.ps1` | Computes the risk-adjusted consistency score for every ticker and writes the two top-25 CSVs. |
| `scripts/compute_report_stats.ps1` | Computes the additional statistics (sector breakdowns, volatility comparisons, excluded-ticker list, extreme single-week moves) used to write the report's findings. |
| `scripts/dev-server.ps1` | Minimal local static file server for previewing the site (`pwsh scripts/dev-server.ps1`, then open `http://localhost:8766/`). |

## Reproducing the data

```bash
# 1. Fetch the ticker universe + 5 years of weekly prices for all 517 tickers:
pwsh scripts/fetch_weekly_prices.ps1

# 2. Correct the sector taxonomy mismatch for 14 Nasdaq-only tickers:
pwsh scripts/fix_sector_taxonomy.ps1

# 3. Compute risk-adjusted consistency scores and the two top-25 CSVs:
pwsh scripts/rank_consistent_gainers.ps1

# 4. Compute the extra statistics used in the report's findings:
pwsh scripts/compute_report_stats.ps1
```
