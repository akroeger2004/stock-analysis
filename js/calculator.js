/* Dashboard "Calculator" tab: what would an amount invested on Sep 27, 2021 be worth in any later week?
   - The four group lines (S&P 500 / Nasdaq 100 top 25, and every eligible ticker in each index) come from
     data/growth_of_10k.csv, written by scripts/compute_growth_of_10k.ps1 (equal-weighted, buy-and-hold, per $10,000).
   - A single stock can be ANY of the 517 tickers: once the dashboard's price panel (js/data.js) has loaded, its
     value is amount x close / first close, aligned to the same weeks (a stock that starts trading later stays at
     the amount until its first week). Until then, the 45 stocks in data/top25_growth_curves.csv are available.
   - Below the cards: a growth chart (through the chosen date) and a copyable plain-English summary. */
(function () {
  const root = document.getElementById("calc");
  if (!root) return;
  const $ = id => document.getElementById(id);
  const amount = $("calc-amount"), slider = $("calc-week"), stockIn = $("calc-stock"), stockMsg = $("calc-stock-msg");
  const out = $("calc-out"), dateLabel = $("calc-date"), list = $("calc-stock-list"), summaryEl = $("calc-summary"), copyBtn = $("calc-copy");
  const usd = v => "$" + Math.round(v).toLocaleString("en-US");
  const fmtPct = r => (r >= 0 ? "+" : "−") + Math.abs(r * 100).toLocaleString("en-US", { maximumFractionDigits: 0 }) + "%";
  const SP = "#3987e5", NDX = "#d95926", BOTH = "#9085e9";
  const GROUP_COLOR = { sp: SP, ndx: NDX, both: BOTH };
  const SD = window.StockData;

  // Company name and index group for the 45 tickers on either top-25 list (used until the full panel has loaded).
  const META = {CEG:["Constellation Energy","both"],AAPL:["Apple Inc.","both"],MAR:["Marriott International","both"],HWM:["Howmet Aerospace","sp"],APP:["AppLovin","both"],MCK:["McKesson Corporation","sp"],JBL:["Jabil","sp"],GILD:["Gilead Sciences","both"],FIX:["Comfort Systems USA","sp"],LLY:["Lilly (Eli)","sp"],VLO:["Valero Energy","sp"],VRTX:["Vertex Pharmaceuticals","both"],AMAT:["Applied Materials","both"],STX:["Seagate Technology","both"],WMT:["Walmart","both"],AVGO:["Broadcom","both"],GE:["GE Aerospace","sp"],TRGP:["Targa Resources","sp"],GOOG:["Alphabet Inc. (Class C)","both"],AMD:["Advanced Micro Devices","both"],CRWD:["CrowdStrike","both"],CTAS:["Cintas","both"],GOOGL:["Alphabet Inc. (Class A)","both"],MU:["Micron Technology","both"],MPC:["Marathon Petroleum","sp"],VST:["Vistra Corp.","sp"],PANW:["Palo Alto Networks","both"],PLTR:["Palantir Technologies","both"],APH:["Amphenol","sp"],DELL:["Dell Technologies","sp"],KLAC:["KLA Corporation","both"],FLEX:["Flex Ltd.","sp"],WDC:["Western Digital","both"],ORLY:["O'Reilly Automotive","both"],CAH:["Cardinal Health","sp"],CAT:["Caterpillar Inc.","sp"],EME:["Emcor","sp"],PWR:["Quanta Services","sp"],ANET:["Arista Networks","sp"],NVDA:["Nvidia","both"],IBKR:["Interactive Brokers","sp"],LITE:["Lumentum","sp"],LRCX:["Lam Research","both"],MRVL:["Marvell Technology","both"],COST:["Costco","both"]};

  const parse = text => text.trim().split(/\r?\n/).map(l => l.replace(/"/g, "").split(","));
  const get = url => fetch(url).then(r => { if (!r.ok) throw new Error(url + " HTTP " + r.status); return r.text(); }).then(parse);

  let groups = null, dates = [], curves = null, universe = null, panelReady = false;
  let stock = null;            // { ticker, name, group, mult[], firstDate }
  let chart = null;

  const groupOf = m => m === "S&P 500" ? "sp" : m === "Nasdaq 100" ? "ndx" : "both";

  /* ---------- stocks ---------- */

  // value-of-$1 for each week in `dates`: 1.0 until the stock's first week, then close / first close (gaps carry forward)
  function buildFromPanel(ticker) {
    const rows = SD.getSeries(ticker), meta = SD.getMeta(ticker);
    if (!rows.length) return null;
    const base = rows[0].close, byDate = new Map(rows.map(r => [r.date, r.close]));
    let last = 1;
    const mult = dates.map(d => { if (byDate.has(d)) last = byDate.get(d) / base; return last; });
    return { ticker, name: meta.company, group: groupOf(meta.indexMembership), mult, firstDate: rows[0].date };
  }
  function buildFromCurves(ticker) {
    if (!curves || !curves[ticker]) return null;
    const m = META[ticker] || [ticker, "both"];
    return { ticker, name: m[0], group: m[1], mult: curves[ticker].map(v => v / 10000), firstDate: null };
  }
  function buildStock(ticker) { return panelReady ? buildFromPanel(ticker) : buildFromCurves(ticker); }

  // Accepts a ticker ("fix") or part of a company name ("comfort"); returns the ticker or null.
  function resolve(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    const up = t.toUpperCase();
    if (universe.has(up)) return up;
    const q = t.toLowerCase();
    for (const [tk, name] of universe) if (name.toLowerCase().includes(q)) return tk;
    return null;
  }

  function setUniverse() {
    universe = new Map();
    if (panelReady) SD.allTickers().forEach(m => universe.set(m.ticker, m.company));
    else if (curves) Object.keys(curves).forEach(t => universe.set(t, (META[t] || [t])[0]));
    list.innerHTML = Array.from(universe, ([t, n]) => `<option value="${t}" label="${n.replace(/"/g, "&quot;")}"></option>`).join("");
  }

  function pickStock() {
    if (!universe) return;
    const raw = stockIn.value.trim();
    if (!raw) { stock = null; stockMsg.textContent = ""; return; }
    const t = resolve(raw);
    if (!t) { stock = null; stockMsg.className = "calc__msg"; stockMsg.textContent = "No stock matches “" + raw + "”"; return; }
    stock = buildStock(t);
    if (stock && stock.firstDate && stock.firstDate > dates[0]) {
      stockMsg.className = "calc__msg info";
      stockMsg.textContent = stock.name + " started trading " + stock.firstDate + "; your money waits as cash until then.";
    } else { stockMsg.className = "calc__msg info"; stockMsg.textContent = stock ? stock.name : ""; }
  }

  /* ---------- render ---------- */

  function render() {
    if (!groups) return;
    const amt = Math.max(0, parseFloat(String(amount.value).replace(/,/g, "")) || 0), i = +slider.value;
    dateLabel.textContent = dates[i];
    const cards = groups.map(g => [g.label, amt * g.values[i] / 10000, g.color]);
    if (stock) cards.push([stock.ticker + " · " + stock.name, amt * stock.mult[i], GROUP_COLOR[stock.group]]);
    out.innerHTML = cards.map(([label, v, color]) => `
      <div class="calc__card" style="--c:${color}">
        <div class="calc__label">${label}</div>
        <div class="calc__value">${usd(v)}</div>
        <div class="calc__gain ${v >= amt ? "up" : "down"}">${amt ? fmtPct(v / amt - 1) : "—"}</div>
      </div>`).join("");
    renderChart(amt, i);
    renderSummary(amt, i);
  }

  function renderChart(amt, i) {
    if (!window.Chart) return;
    const C = window.REPORT_COLORS || { text: "#c3c2b7", axis: "#898781", grid: "#2c2c2a" };
    const labels = dates.slice(0, i + 1);
    const line = (label, vals, color, extra) => Object.assign({ label, data: vals, borderColor: color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15, fill: false }, extra);
    const sets = groups.map((g, k) => line(g.label, g.values.slice(0, i + 1).map(v => amt * v / 10000), g.color,
      k % 2 ? { borderDash: [5, 4], borderWidth: 1.5 } : {}));
    if (stock) sets.push(line(stock.ticker, stock.mult.slice(0, i + 1).map(v => amt * v), GROUP_COLOR[stock.group] === BOTH ? BOTH : "#e377c2", { borderWidth: 3 }));
    if (!chart) {
      chart = new Chart($("calc-chart"), {
        type: "line",
        data: { labels, datasets: sets },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: true, position: "top", labels: { color: C.text, boxWidth: 18, font: { size: 11 } } },
            tooltip: { itemSort: (a, b) => b.raw - a.raw, callbacks: {
              title: items => "Week of " + items[0].label,
              label: ctx => ctx.dataset.label + ": " + usd(ctx.raw)
            } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: C.axis, maxTicksLimit: 7, font: { size: 9 } } },
            y: { beginAtZero: true, grid: { color: C.grid }, ticks: { color: C.axis, font: { size: 9 }, callback: v => "$" + v.toLocaleString("en-US") } }
          }
        }
      });
    } else {
      chart.data.labels = labels;
      chart.data.datasets = sets;
      chart.update();
    }
  }

  function renderSummary(amt, i) {
    const d0 = dates[0], d1 = dates[i], a = usd(amt);
    let s;
    if (stock) {
      const idx = stock.group === "ndx" ? 3 : 1;   // compare with all eligible tickers in the stock's index (S&P 500 unless Nasdaq-100-only)
      const base = groups[idx], baseV = amt * base.values[i] / 10000, v = amt * stock.mult[i];
      s = `${a} invested in ${stock.ticker} (${stock.name}) on ${d0} would have been worth ${usd(v)} on ${d1} (${fmtPct(amt ? v / amt - 1 : 0)}). ` +
          `Spread equally across all ${idx === 3 ? "98 eligible Nasdaq 100" : "493 eligible S&P 500"} stocks it would have been ${usd(baseV)} (${fmtPct(amt ? baseV / amt - 1 : 0)}).`;
    } else {
      const top = amt * groups[0].values[i] / 10000, all = amt * groups[1].values[i] / 10000;
      s = `${a} invested in the S&P 500's 25 most consistent gainers on ${d0} would have been worth ${usd(top)} on ${d1} (${fmtPct(amt ? top / amt - 1 : 0)}), versus ${usd(all)} (${fmtPct(amt ? all / amt - 1 : 0)}) for all 493 eligible S&P 500 stocks.`;
    }
    summaryEl.textContent = s + " (Equal-weighted, buy-and-hold; source: Consistent Gainers, S&P 500 vs Nasdaq 100.)";
  }

  copyBtn.addEventListener("click", () => {
    const text = summaryEl.textContent;
    const done = () => { copyBtn.textContent = "Copied ✓"; setTimeout(() => { copyBtn.textContent = "Copy"; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { copyBtn.textContent = "Press Ctrl+C"; }
      document.body.removeChild(ta);
    }
  });

  amount.addEventListener("input", render);
  slider.addEventListener("input", render);
  stockIn.addEventListener("input", () => { pickStock(); render(); });
  stockIn.addEventListener("change", () => { pickStock(); render(); });

  /* ---------- data ---------- */

  const groupsReady = get("data/growth_of_10k.csv").then(rows => {
    dates = rows.slice(1).map(r => r[0]);
    const col = j => rows.slice(1).map(r => +r[j]);
    groups = [
      { label: "S&P 500 top 25", values: col(1), color: SP }, { label: "S&P 500, all eligible", values: col(2), color: SP },
      { label: "Nasdaq 100 top 25", values: col(3), color: NDX }, { label: "Nasdaq 100, all eligible", values: col(4), color: NDX }
    ];
    slider.max = dates.length - 1; slider.value = dates.length - 1;
  });

  groupsReady.then(() => get("data/top25_growth_curves.csv")).then(rows => {
    curves = {};
    rows[0].slice(1).forEach((t, j) => { curves[t] = rows.slice(1).map(r => +r[j + 1]); });
    setUniverse(); pickStock(); render();
  }).catch(err => {
    groupsReady.then(render);
    if (!groups) out.innerHTML = '<p class="calc__note">Couldn’t load the calculator data (' + err.message + ').</p>';
  });

  // Once the dashboard's full price panel is loaded, any of the 517 tickers works.
  if (SD) SD.load().then(() => {
    groupsReady.then(() => { panelReady = true; setUniverse(); pickStock(); render(); });
  }).catch(() => {});

  // Deep link from the report: dashboard.html?tab=calculator opens this tab.
  document.addEventListener("DOMContentLoaded", () => {
    if (new URLSearchParams(location.search).get("tab") === "calculator") {
      setTimeout(() => { const b = document.querySelector('.dash-tab[data-view="calculator"]'); if (b) b.click(); }, 0);
    }
  });
})();
