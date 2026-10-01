/* Dashboard "Calculator" tab: what would an amount invested on Sep 27, 2021 be worth in any later week?
   Four group lines (S&P 500 / Nasdaq 100 top 25, and every eligible ticker in each index) come from
   data/growth_of_10k.csv; single stocks (the 45 on either top-25 list) come from data/top25_growth_curves.csv.
   Both are written by scripts/compute_growth_of_10k.ps1: equal-weighted, buy-and-hold, per $10,000. */
(function () {
  const root = document.getElementById("calc");
  if (!root) return;
  const amount = document.getElementById("calc-amount"), slider = document.getElementById("calc-week");
  const stockSel = document.getElementById("calc-stock"), out = document.getElementById("calc-out"), dateLabel = document.getElementById("calc-date");
  const usd = v => "$" + Math.round(v).toLocaleString("en-US");
  const fmtPct = r => (r >= 0 ? "+" : "−") + Math.abs(r * 100).toLocaleString("en-US", { maximumFractionDigits: 0 }) + "%";
  const SP = "#3987e5", NDX = "#d95926", BOTH = "#9085e9";

  // Company name and index group for the 45 tickers on either top-25 list (from data/*_top25_consistent_gainers.csv).
  const META = {CEG:["Constellation Energy","both"],AAPL:["Apple Inc.","both"],MAR:["Marriott International","both"],HWM:["Howmet Aerospace","sp"],APP:["AppLovin","both"],MCK:["McKesson Corporation","sp"],JBL:["Jabil","sp"],GILD:["Gilead Sciences","both"],FIX:["Comfort Systems USA","sp"],LLY:["Lilly (Eli)","sp"],VLO:["Valero Energy","sp"],VRTX:["Vertex Pharmaceuticals","both"],AMAT:["Applied Materials","both"],STX:["Seagate Technology","both"],WMT:["Walmart","both"],AVGO:["Broadcom","both"],GE:["GE Aerospace","sp"],TRGP:["Targa Resources","sp"],GOOG:["Alphabet Inc. (Class C)","both"],AMD:["Advanced Micro Devices","both"],CRWD:["CrowdStrike","both"],CTAS:["Cintas","both"],GOOGL:["Alphabet Inc. (Class A)","both"],MU:["Micron Technology","both"],MPC:["Marathon Petroleum","sp"],VST:["Vistra Corp.","sp"],PANW:["Palo Alto Networks","both"],PLTR:["Palantir Technologies","both"],APH:["Amphenol","sp"],DELL:["Dell Technologies","sp"],KLAC:["KLA Corporation","both"],FLEX:["Flex Ltd.","sp"],WDC:["Western Digital","both"],ORLY:["O'Reilly Automotive","both"],CAH:["Cardinal Health","sp"],CAT:["Caterpillar Inc.","sp"],EME:["Emcor","sp"],PWR:["Quanta Services","sp"],ANET:["Arista Networks","sp"],NVDA:["Nvidia","both"],IBKR:["Interactive Brokers","sp"],LITE:["Lumentum","sp"],LRCX:["Lam Research","both"],MRVL:["Marvell Technology","both"],COST:["Costco","both"]};
  const GROUP_COLOR = { sp: SP, ndx: NDX, both: BOTH };

  const parse = text => text.trim().split(/\r?\n/).map(l => l.replace(/"/g, "").split(","));
  const get = url => fetch(url).then(r => { if (!r.ok) throw new Error(url + " HTTP " + r.status); return r.text(); }).then(parse);

  let groups = null, dates = [], stocks = null;

  function render() {
    if (!groups) return;
    const amt = Math.max(0, parseFloat(String(amount.value).replace(/,/g, "")) || 0), i = +slider.value;
    dateLabel.textContent = dates[i];
    const cards = groups.map(g => [g.label, amt * g.values[i] / 10000, g.color]);
    if (stocks && stocks.values[stockSel.value]) {
      const t = stockSel.value;
      cards.push([t + " · " + (META[t] ? META[t][0] : t), amt * stocks.values[t][i] / 10000, GROUP_COLOR[META[t] ? META[t][1] : "both"]]);
    }
    out.innerHTML = cards.map(([label, v, color]) => `
      <div class="calc__card" style="--c:${color}">
        <div class="calc__label">${label}</div>
        <div class="calc__value">${usd(v)}</div>
        <div class="calc__gain ${v >= amt ? "up" : "down"}">${amt ? fmtPct(v / amt - 1) : "—"}</div>
      </div>`).join("");
  }
  ["input", "change"].forEach(ev => { amount.addEventListener(ev, render); slider.addEventListener(ev, render); stockSel.addEventListener(ev, render); });

  get("data/growth_of_10k.csv").then(rows => {
    dates = rows.slice(1).map(r => r[0]);
    const col = j => rows.slice(1).map(r => +r[j]);
    groups = [
      { label: "S&P 500 top 25", values: col(1), color: SP }, { label: "S&P 500, all eligible", values: col(2), color: SP },
      { label: "Nasdaq 100 top 25", values: col(3), color: NDX }, { label: "Nasdaq 100, all eligible", values: col(4), color: NDX }
    ];
    slider.max = dates.length - 1; slider.value = dates.length - 1;
    render();
  }).catch(err => { out.innerHTML = '<p class="calc__note">Couldn’t load the calculator data (' + err.message + ').</p>'; });

  get("data/top25_growth_curves.csv").then(rows => {
    const tickers = rows[0].slice(1), values = {};
    tickers.forEach((t, j) => { values[t] = rows.slice(1).map(r => +r[j + 1]); });
    stocks = { tickers, values };
    stockSel.innerHTML = tickers.slice().sort().map(t => `<option value="${t}">${t} · ${META[t] ? META[t][0] : t}</option>`).join("");
    stockSel.value = "FIX";
    render();
  }).catch(() => { stockSel.parentNode.hidden = true; });

  // Deep link from the report: dashboard.html?tab=calculator opens this tab.
  document.addEventListener("DOMContentLoaded", () => {
    if (new URLSearchParams(location.search).get("tab") === "calculator") {
      setTimeout(() => { const b = document.querySelector('.dash-tab[data-view="calculator"]'); if (b) b.click(); }, 0);
    }
  });
})();
