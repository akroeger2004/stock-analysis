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
| `index.html` | The report page: title, byline, a summary, 5 headline numbers, 11 findings with charts (plus a money calculator, an animated top-25 race and a sector heatmap), a sticky section index, a light/dark theme toggle, and a closing data-methodology section. Its ticker tape links directly into the dashboard's Stock Explorer for that ticker. |
| `dashboard.html` | The interactive dashboard, split into two tabs so no single view is overloaded: **Overview** (shared filters — year range, sector, ticker search, view, measure, breakdown — 4 combined S&P-vs-Nasdaq charts/lists, a sortable table, and a reset button) and **Stock Explorer** (a Top-25 symbol list per index — searchable across all 517 tickers, showing each one's true consistency rank even outside the top 25 — a TradingView-style focus price chart with a 6M/1Y/2Y/5Y range toggle, big-move markers, biggest-gain/decline lists, and an optional second ticker overlaid — both indexed to 100 at the start of the range — to compare growth rates directly). Both pages' ticker tape is clickable, jumping straight to that ticker in Stock Explorer. | 
| `css/style.css` | Shared dark finance-themed styling (nav bar, ticker tape, cards, filters, tables, ranked lists, Stock Explorer) for both pages. |
| `js/data.js` | Loads and parses `data/sp500_nasdaq100_weekly_prices.csv` in the browser and computes per-ticker consistency stats on demand. Used only by `dashboard.html`. |
| `js/dashboard.js` | All dashboard interactivity: the Overview tab's filters/charts/table, and the Stock Explorer tab's symbol list, focus chart, and stats. |
| `js/report.js` | Builds the report page's 10 interactive charts (hover tooltips, price-range buttons, click-through to the dashboard) from pre-computed numbers (see the scripts below for how each number was derived). |
| `js/report-extras.js` | Report-page extras: reading-progress bar, section index, scroll reveal, count-up headline tiles, hover-link between Finding 5's text and its scatter, the "what would your money have become" calculator, and the animated top-25 race (Finding 10). |
| `js/report-heatmap.js` | The sector heatmap (Finding 11): a treemap of sectors sized by ticker count and colored by average 5-year return, with an S&P 500 / Nasdaq 100 toggle and per-sector details. |
| `js/theme.js` | The light/dark theme toggle shared by the report and the dashboard: saves one choice that both pages (and any other open tab) follow, and re-colors the Chart.js charts. The light palette itself is in `css/style.css`; dark is the default. |
| `data/sp500_nasdaq100_weekly_prices.csv` | The panel dataset: 133,557 rows, one per ticker per week (2021-09 to 2026-09), with sector/index-membership flags and OHLCV + weekly-return numbers. Fetched directly by `dashboard.html`. |
| `data/sp500_top25_consistent_gainers.csv` | The 25 most consistent S&P 500 gainers by risk-adjusted score, with their stats. |
| `data/nasdaq100_top25_consistent_gainers.csv` | The 25 most consistent Nasdaq 100 gainers by risk-adjusted score, with their stats. |
| `data/growth_of_10k.csv` | Weekly value of $10,000 split equally across each group (S&P 500 top 25, S&P 500 all eligible, Nasdaq 100 top 25, Nasdaq 100 all eligible), buy-and-hold with no rebalancing; feeds the "growth of $10,000" chart in Finding 7. |
| `data/top25_growth_curves.csv` | Value of $10,000 put into each of the 45 stocks on either top-25 list in Sep 2021, one column per ticker and one row per week; feeds the calculator and the race. |
| `data/sector_summary.csv` | Per index pool and sector: eligible ticker count, equal-weighted average cumulative return / weekly volatility / risk-adjusted score, and the five highest-scoring tickers; feeds the heatmap. |
| `scripts/fetch_weekly_prices.ps1` | Builds the S&P 500 + Nasdaq 100 ticker universe and fetches 5 years of weekly OHLCV for all 517 tickers from Yahoo Finance, producing the main panel CSV. |
| `scripts/fix_sector_taxonomy.ps1` | One-time correction of the 14 Nasdaq-only tickers' mismatched sector labels to standard GICS sectors. |
| `scripts/rank_consistent_gainers.ps1` | Computes the risk-adjusted consistency score for every ticker and writes the two top-25 CSVs. |
| `scripts/compute_report_stats.ps1` | Computes the additional statistics (sector breakdowns, volatility comparisons, excluded-ticker list, extreme single-week moves) used to write the report's findings. |
| `scripts/compute_growth_of_10k.ps1` | Builds `data/growth_of_10k.csv` and `data/top25_growth_curves.csv` from the panel and the two top-25 lists. The last row equals $10,000 x (1 + average cumulative return) for each group. |
| `scripts/compute_sector_summary.ps1` | Builds `data/sector_summary.csv` from the panel. |
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

# 5. Compute the growth-of-$10,000 series for the report chart:
pwsh scripts/compute_growth_of_10k.ps1

# 6. Compute the sector summary behind the heatmap:
pwsh scripts/compute_sector_summary.ps1
```
