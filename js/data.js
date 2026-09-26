/* Shared data loading + stats for the Stock Analysis site.
   Loads data/sp500_nasdaq100_weekly_prices.csv once, builds per-ticker
   series + metadata, and exposes stat computation used by both pages. */

window.StockData = (function () {
  const DATA_URL = "data/sp500_nasdaq100_weekly_prices.csv";
  const FULL_WEEKS = 262;          // max weeks in the 5yr panel
  const ELIGIBLE_FRACTION = 240 / FULL_WEEKS; // ~91.6% coverage required

  let cache = null;

  function load(onProgress) {
    if (cache) return Promise.resolve(cache);

    return new Promise((resolve, reject) => {
      Papa.parse(DATA_URL, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        step: undefined,
        complete: (results) => {
          const rows = results.data;
          const tickers = new Map();   // ticker -> meta
          const series = new Map();    // ticker -> array rows (unsorted order preserved from fetch, already chronological)

          for (const r of rows) {
            if (!r.ticker || !r.date) continue;
            if (!tickers.has(r.ticker)) {
              tickers.set(r.ticker, {
                ticker: r.ticker,
                company: r.company,
                sector: r.sector,
                subIndustry: r.sub_industry,
                indexMembership: r.index_membership
              });
              series.set(r.ticker, []);
            }
            series.get(r.ticker).push({
              date: r.date,
              open: r.open,
              high: r.high,
              low: r.low,
              close: r.close,
              volume: r.volume,
              weeklyReturn: (r.weekly_return === "" || r.weekly_return === null || r.weekly_return === undefined)
                ? null : r.weekly_return
            });
          }

          // dates are already chronological from the fetch script, but sort defensively
          for (const arr of series.values()) {
            arr.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
          }

          const allDates = Array.from(new Set(rows.map(r => r.date))).sort();

          cache = { tickers, series, allDates };
          resolve(cache);
        },
        error: (err) => reject(err)
      });
    });
  }

  // Filter a ticker's series to [yearFrom, yearTo] inclusive (by date's year)
  function sliceByYear(rowsArr, yearFrom, yearTo) {
    if (!yearFrom && !yearTo) return rowsArr;
    return rowsArr.filter(r => {
      const y = parseInt(r.date.slice(0, 4), 10);
      return (!yearFrom || y >= yearFrom) && (!yearTo || y <= yearTo);
    });
  }

  function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

  function computeStats({ tickerFilter, yearFrom, yearTo, sector, searchTicker } = {}) {
    if (!cache) throw new Error("StockData not loaded yet");
    const { tickers, series, allDates } = cache;

    const weeksInRange = yearFrom || yearTo
      ? allDates.filter(d => {
          const y = parseInt(d.slice(0, 4), 10);
          return (!yearFrom || y >= yearFrom) && (!yearTo || y <= yearTo);
        }).length
      : FULL_WEEKS;
    const minWeeksRequired = Math.max(4, Math.round(weeksInRange * ELIGIBLE_FRACTION));

    const out = [];
    for (const [ticker, meta] of tickers) {
      if (tickerFilter && !tickerFilter(meta)) continue;
      if (sector && sector !== "All" && meta.sector !== sector) continue;
      if (searchTicker && !(ticker.toUpperCase().includes(searchTicker) ||
                            (meta.company || "").toUpperCase().includes(searchTicker))) continue;

      const full = series.get(ticker);
      const sliced = sliceByYear(full, yearFrom, yearTo);
      const returns = sliced.map(r => r.weeklyReturn).filter(v => v !== null && v !== undefined);
      const weeks = sliced.length;

      if (returns.length < minWeeksRequired || returns.length < 4) {
        out.push({ ...meta, weeks, eligible: false });
        continue;
      }

      const m = mean(returns);
      const variance = mean(returns.map(v => Math.pow(v - m, 2)));
      const stdev = Math.sqrt(variance);
      const riskAdjusted = stdev === 0 ? 0 : m / stdev;

      const firstClose = sliced[0].close;
      const lastClose = sliced[sliced.length - 1].close;
      const cumulativeReturn = (lastClose - firstClose) / firstClose;

      out.push({
        ...meta,
        weeks,
        meanWeeklyReturn: m,
        stdevWeeklyReturn: stdev,
        riskAdjustedScore: riskAdjusted,
        cumulativeReturn,
        eligible: true
      });
    }
    return { stats: out, minWeeksRequired, weeksInRange };
  }

  function getSeries(ticker) {
    if (!cache) throw new Error("StockData not loaded yet");
    return cache.series.get(ticker) || [];
  }

  function getMeta(ticker) {
    if (!cache) throw new Error("StockData not loaded yet");
    return cache.tickers.get(ticker);
  }

  function allSectors() {
    if (!cache) throw new Error("StockData not loaded yet");
    return Array.from(new Set(Array.from(cache.tickers.values()).map(m => m.sector))).sort();
  }

  function allDates() {
    if (!cache) throw new Error("StockData not loaded yet");
    return cache.allDates;
  }

  function allTickers() {
    if (!cache) throw new Error("StockData not loaded yet");
    return Array.from(cache.tickers.values()).sort((a,b) => a.ticker.localeCompare(b.ticker));
  }

  // ---- formatting helpers ----
  function fmtPct(v, digits = 2) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return (v * 100).toFixed(digits) + "%";
  }
  function fmtNum(v, digits = 3) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return v.toFixed(digits);
  }
  function fmtMoney(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return "$" + v.toFixed(2);
  }
  function fmtInt(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return Math.round(v).toLocaleString();
  }

  return {
    load, computeStats, getSeries, getMeta, allSectors, allDates, allTickers,
    fmtPct, fmtNum, fmtMoney, fmtInt,
    FULL_WEEKS, ELIGIBLE_FRACTION
  };
})();
