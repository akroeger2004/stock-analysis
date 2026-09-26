(function () {
  const SD = window.StockData;

  const COLORS = {
    sp: { line: "#3987e5", soft: "rgba(57,135,229,0.55)", fill: "rgba(57,135,229,0.12)" },
    ndx: { line: "#d95926", soft: "rgba(217,89,38,0.55)", fill: "rgba(217,89,38,0.12)" },
    good: "#0ca30c",
    critical: "#e66767",
    grid: "#2c2c2a",
    axis: "#898781",
    text: "#c3c2b7"
  };

  const MEASURES = {
    riskAdjustedScore: { label: "Risk-Adjusted Score (consistency)", fmt: v => SD.fmtNum(v) },
    meanWeeklyReturn: { label: "Average Weekly Return", fmt: v => SD.fmtPct(v) },
    cumulativeReturn: { label: "Cumulative Return (period)", fmt: v => SD.fmtPct(v, 1) },
    stdevWeeklyReturn: { label: "Volatility (Std Dev of weekly return)", fmt: v => SD.fmtPct(v) }
  };

  const els = {};
  const charts = {}; // keyed by chart canvas id
  let allSectors = [];
  let allDates = [];

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    ["fromYear","toYear","sectorFilter","viewFilter","tickerSearch","measureSelect","breakdownSelect",
     "resetBtn","loadingBanner","overlay","overlayClose"].forEach(id => els[id] = $(id));
  }

  function populateControls() {
    allDates = SD.allDates();
    const years = Array.from(new Set(allDates.map(d => d.slice(0,4)))).sort();
    els.fromYear.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
    els.toYear.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
    els.fromYear.value = years[0];
    els.toYear.value = years[years.length - 1];

    allSectors = SD.allSectors();
    els.sectorFilter.innerHTML = `<option value="All">All Sectors</option>` +
      allSectors.map(s => `<option value="${s}">${s}</option>`).join("");
  }

  function getFilters() {
    return {
      yearFrom: parseInt(els.fromYear.value, 10),
      yearTo: parseInt(els.toYear.value, 10),
      sector: els.sectorFilter.value,
      search: els.tickerSearch.value.trim().toUpperCase(),
      view: els.viewFilter.value,
      measure: els.measureSelect.value,
      breakdown: els.breakdownSelect.value
    };
  }

  function resetFilters() {
    els.fromYear.value = els.fromYear.options[0].value;
    els.toYear.value = els.toYear.options[els.toYear.options.length - 1].value;
    els.sectorFilter.value = "All";
    els.tickerSearch.value = "";
    els.viewFilter.value = "top25";
    els.measureSelect.value = "riskAdjustedScore";
    els.breakdownSelect.value = "ticker";
    closeOverlay();
    renderAll();
  }

  function poolFilterFor(side) {
    return meta => side === "sp"
      ? (meta.indexMembership === "S&P 500" || meta.indexMembership === "Both")
      : (meta.indexMembership === "Nasdaq 100" || meta.indexMembership === "Both");
  }

  function buildPool(side, f) {
    const { stats } = SD.computeStats({
      tickerFilter: poolFilterFor(side),
      yearFrom: f.yearFrom, yearTo: f.yearTo,
      sector: f.sector, searchTicker: f.search
    });
    const eligible = stats.filter(s => s.eligible);
    eligible.sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);

    let view;
    if (f.view === "top25") view = eligible.slice(0, 25);
    else if (f.view === "eligible") view = eligible;
    else view = stats; // all tickers, incl. ineligible

    // The subset every chart/stat/table renders against, so numbers always agree
    // with whichever View filter (Top 25 / All Eligible / All Tickers) is selected.
    const viewEligible = view.filter(s => s.eligible);

    return { all: stats, eligible, view, viewEligible };
  }

  function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  function renderStatTiles(side, pool, f) {
    const wrap = $(side + "-stats");
    const eligible = pool.viewEligible;
    if (eligible.length === 0) {
      wrap.innerHTML = `<div class="stat-tile"><div class="label">No matches</div><div class="value">—</div></div>`;
      return;
    }
    const avgReturn = eligible.reduce((a,b) => a + b.meanWeeklyReturn, 0) / eligible.length;
    const avgScore = eligible.reduce((a,b) => a + b.riskAdjustedScore, 0) / eligible.length;
    const best = eligible.slice().sort((a,b) => b.riskAdjustedScore - a.riskAdjustedScore)[0];
    const count = pool.view.length;

    wrap.innerHTML = `
      <div class="stat-tile"><div class="label">Tickers in view</div><div class="value">${SD.fmtInt(count)}</div></div>
      <div class="stat-tile"><div class="label">Avg weekly return</div><div class="value ${avgReturn>=0?'up':'down'}">${SD.fmtPct(avgReturn)}</div></div>
      <div class="stat-tile"><div class="label">Avg consistency score</div><div class="value">${SD.fmtNum(avgScore)}</div></div>
      <div class="stat-tile"><div class="label">Top ticker</div><div class="value">${best.ticker}</div></div>
    `;
  }

  function rankingData(side, pool, f) {
    const key = f.measure;
    if (f.breakdown === "sector") {
      const bySector = new Map();
      for (const s of pool.viewEligible) {
        if (!bySector.has(s.sector)) bySector.set(s.sector, []);
        bySector.get(s.sector).push(s[key]);
      }
      let rows = Array.from(bySector.entries()).map(([sector, vals]) => ({
        label: sector,
        value: vals.reduce((a,b) => a+b, 0) / vals.length,
        ticker: null
      }));
      rows.sort((a,b) => b.value - a.value);
      return rows;
    } else {
      let rows = pool.viewEligible.slice().sort((a,b) => b[key] - a[key]).slice(0, 15)
        .map(s => ({ label: s.ticker, value: s[key], ticker: s.ticker, company: s.company }));
      return rows;
    }
  }

  function renderRankingChart(side, pool, f) {
    const id = side + "-ranking";
    const canvas = $(id);
    destroyChart(id);
    const rows = rankingData(side, pool, f);
    const color = COLORS[side].line;
    const measureInfo = MEASURES[f.measure];

    charts[id] = new Chart(canvas, {
      type: "bar",
      data: {
        labels: rows.map(r => r.label),
        datasets: [{
          data: rows.map(r => r.value),
          backgroundColor: color,
          borderRadius: 4,
          barThickness: 14
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const r = rows[ctx.dataIndex];
                const name = r.company ? `${r.ticker} — ${r.company}` : r.label;
                return `${name}: ${measureInfo.fmt(r.value)}`;
              }
            }
          }
        },
        scales: {
          x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.axis, font: { size: 10 } } },
          y: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 11, family: "monospace" } } }
        },
        onClick: (evt, elements) => {
          if (!elements.length) return;
          const r = rows[elements[0].index];
          if (r.ticker) openOverlay(r.ticker, side);
        }
      }
    });
  }

  function renderScatterChart(side, pool) {
    const id = side + "-scatter";
    const canvas = $(id);
    destroyChart(id);
    const rows = pool.viewEligible;
    const color = COLORS[side].line;

    charts[id] = new Chart(canvas, {
      type: "scatter",
      data: {
        datasets: [{
          data: rows.map(s => ({ x: s.stdevWeeklyReturn, y: s.meanWeeklyReturn, ticker: s.ticker, company: s.company })),
          backgroundColor: COLORS[side].soft,
          borderColor: color,
          borderWidth: 1,
          radius: 4,
          hoverRadius: 7,
          hitRadius: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const p = ctx.raw;
                return `${p.ticker} — ${p.company}: return ${SD.fmtPct(p.y)}, volatility ${SD.fmtPct(p.x)}`;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: "Volatility (weekly)", color: COLORS.axis, font: { size: 10 } },
               grid: { color: COLORS.grid }, ticks: { color: COLORS.axis, font: { size: 9 }, callback: v => (v*100).toFixed(0)+"%" } },
          y: { title: { display: true, text: "Avg weekly return", color: COLORS.axis, font: { size: 10 } },
               grid: { color: COLORS.grid }, ticks: { color: COLORS.axis, font: { size: 9 }, callback: v => (v*100).toFixed(1)+"%" } }
        },
        onClick: (evt, elements) => {
          if (!elements.length) return;
          const p = rows[elements[0].index];
          openOverlay(p.ticker, side);
        }
      }
    });
  }

  function renderSectorChart(side, pool) {
    const id = side + "-sector";
    const canvas = $(id);
    destroyChart(id);
    const bySector = new Map();
    for (const s of pool.viewEligible) bySector.set(s.sector, (bySector.get(s.sector) || 0) + 1);
    let rows = Array.from(bySector.entries()).map(([sector, count]) => ({ sector, count }));
    rows.sort((a,b) => b.count - a.count);
    const color = COLORS[side].line;

    charts[id] = new Chart(canvas, {
      type: "bar",
      data: {
        labels: rows.map(r => r.sector),
        datasets: [{ data: rows.map(r => r.count), backgroundColor: color, borderRadius: 4, barThickness: 12 }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${rows[ctx.dataIndex].sector}: ${rows[ctx.dataIndex].count} tickers` } }
        },
        scales: {
          x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.axis, font: { size: 9 }, stepSize: 1 } },
          y: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 10 } } }
        },
        onClick: (evt, elements) => {
          if (!elements.length) return;
          els.sectorFilter.value = rows[elements[0].index].sector;
          renderAll();
        }
      }
    });
  }

  function renderTable(side, pool, f) {
    const wrap = $(side + "-table-wrap");
    const rows = pool.view;
    const key = f.measure;

    if (!wrap.dataset.sortKey) wrap.dataset.sortKey = "riskAdjustedScore";
    if (!wrap.dataset.sortDir) wrap.dataset.sortDir = "desc";

    function draw() {
      const sortKey = wrap.dataset.sortKey;
      const dir = wrap.dataset.sortDir === "asc" ? 1 : -1;
      const sorted = rows.slice().sort((a,b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av === undefined || av === null) return 1;
        if (bv === undefined || bv === null) return -1;
        if (typeof av === "string") return av.localeCompare(bv) * dir;
        return (av - bv) * dir;
      });

      const body = sorted.map(s => {
        const cls = (v) => v === undefined || v === null ? "" : (v >= 0 ? "up" : "down");
        return `<tr data-ticker="${s.ticker}">
          <td class="ticker-link">${s.ticker}</td>
          <td class="company-cell">${s.company || ""}</td>
          <td class="company-cell">${s.sector || ""}</td>
          <td>${SD.fmtInt(s.weeks)}</td>
          <td class="${cls(s.meanWeeklyReturn)}">${s.eligible ? SD.fmtPct(s.meanWeeklyReturn) : "—"}</td>
          <td>${s.eligible ? SD.fmtPct(s.stdevWeeklyReturn) : "—"}</td>
          <td>${s.eligible ? SD.fmtNum(s.riskAdjustedScore) : "—"}</td>
          <td class="${cls(s.cumulativeReturn)}">${s.eligible ? SD.fmtPct(s.cumulativeReturn, 1) : "—"}</td>
        </tr>`;
      }).join("");

      wrap.innerHTML = `
        <table class="data-table">
          <thead><tr>
            <th data-key="ticker">Ticker</th>
            <th data-key="company">Company</th>
            <th data-key="sector">Sector</th>
            <th data-key="weeks">Weeks</th>
            <th data-key="meanWeeklyReturn">Avg Return</th>
            <th data-key="stdevWeeklyReturn">Volatility</th>
            <th data-key="riskAdjustedScore">Score</th>
            <th data-key="cumulativeReturn">Cum. Return</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>`;

      wrap.querySelectorAll("thead th").forEach(th => {
        th.addEventListener("click", () => {
          const k = th.dataset.key;
          if (wrap.dataset.sortKey === k) {
            wrap.dataset.sortDir = wrap.dataset.sortDir === "asc" ? "desc" : "asc";
          } else {
            wrap.dataset.sortKey = k;
            wrap.dataset.sortDir = "desc";
          }
          draw();
        });
      });
      wrap.querySelectorAll("tbody tr").forEach(tr => {
        tr.addEventListener("click", () => openOverlay(tr.dataset.ticker, side));
      });
    }
    draw();
  }

  function renderPanel(side, f) {
    const pool = buildPool(side, f);
    $(side + "-count").textContent = `${pool.eligible.length} eligible`;
    renderStatTiles(side, pool, f);
    renderRankingChart(side, pool, f);
    renderScatterChart(side, pool);
    renderSectorChart(side, pool);
    renderTable(side, pool, f);
  }

  function renderAll() {
    const f = getFilters();
    renderPanel("sp", f);
    renderPanel("ndx", f);
  }

  // ---------------- Ticker detail overlay ----------------

  function rankWithin(ticker, side) {
    const { stats } = SD.computeStats({ tickerFilter: poolFilterFor(side) });
    const eligible = stats.filter(s => s.eligible).sort((a,b) => b.riskAdjustedScore - a.riskAdjustedScore);
    const idx = eligible.findIndex(s => s.ticker === ticker);
    return { rank: idx === -1 ? null : idx + 1, poolSize: eligible.length };
  }

  function openOverlay(ticker, side) {
    const meta = SD.getMeta(ticker);
    if (!meta) return;
    const fullSeries = SD.getSeries(ticker);
    const returns = fullSeries.map(r => r.weeklyReturn).filter(v => v !== null);
    const weeks = fullSeries.length;

    const m = returns.reduce((a,b) => a+b, 0) / returns.length;
    const variance = returns.reduce((a,b) => a + Math.pow(b - m, 2), 0) / returns.length;
    const stdev = Math.sqrt(variance);
    const score = stdev === 0 ? 0 : m / stdev;
    const cum = (fullSeries[fullSeries.length-1].close - fullSeries[0].close) / fullSeries[0].close;

    const pills = [];
    if (meta.indexMembership === "S&P 500" || meta.indexMembership === "Both") pills.push(["sp","S&P 500"]);
    if (meta.indexMembership === "Nasdaq 100" || meta.indexMembership === "Both") pills.push(["ndx","Nasdaq 100"]);

    $("overlay-ticker").textContent = ticker;
    $("overlay-company").textContent = meta.company || "";
    $("overlay-sub").innerHTML =
      pills.map(([cls,label]) => `<span class="pill ${cls}">${label}</span>`).join("") +
      `${meta.sector} · ${meta.subIndustry || ""}`;

    const rankBits = [];
    if (meta.indexMembership === "S&P 500" || meta.indexMembership === "Both") {
      const r = rankWithin(ticker, "sp");
      if (r.rank) rankBits.push(`#${r.rank} of ${r.poolSize} in S&P 500`);
    }
    if (meta.indexMembership === "Nasdaq 100" || meta.indexMembership === "Both") {
      const r = rankWithin(ticker, "ndx");
      if (r.rank) rankBits.push(`#${r.rank} of ${r.poolSize} in Nasdaq 100`);
    }

    $("overlay-stats").innerHTML = `
      <div class="stat-tile"><div class="label">Weeks tracked</div><div class="value">${SD.fmtInt(weeks)}</div></div>
      <div class="stat-tile"><div class="label">Cumulative return</div><div class="value ${cum>=0?'up':'down'}">${SD.fmtPct(cum,1)}</div></div>
      <div class="stat-tile"><div class="label">Consistency score</div><div class="value">${SD.fmtNum(score)}</div></div>
      <div class="stat-tile"><div class="label">Index rank</div><div class="value" style="font-size:13px">${rankBits.join(" · ") || "—"}</div></div>
    `;

    // Price history chart with biggest-move markers
    const dated = fullSeries.map(r => ({ x: r.date, y: r.close, ret: r.weeklyReturn }));
    const movesSorted = fullSeries.filter(r => r.weeklyReturn !== null).slice().sort((a,b) => b.weeklyReturn - a.weeklyReturn);
    const topGains = movesSorted.slice(0, 5);
    const topDeclines = movesSorted.slice(-5).reverse();
    const bigMoveDates = new Set([...topGains, ...topDeclines].map(r => r.date));

    destroyChart("overlay-chart");
    const chartSide = side || ((meta.indexMembership === "Nasdaq 100") ? "ndx" : "sp");
    charts["overlay-chart"] = new Chart($("overlay-chart"), {
      type: "line",
      data: {
        labels: dated.map(d => d.x),
        datasets: [{
          data: dated.map(d => d.y),
          borderColor: COLORS[chartSide].line,
          backgroundColor: COLORS[chartSide].fill,
          fill: true,
          pointRadius: dated.map(d => bigMoveDates.has(d.x) ? 4 : 0),
          pointHoverRadius: 6,
          pointBackgroundColor: dated.map(d => d.ret !== null && d.ret >= 0 ? COLORS.good : COLORS.critical),
          borderWidth: 1.75,
          tension: 0.15
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const d = dated[ctx.dataIndex];
                const retStr = d.ret === null ? "" : `  (${d.ret >= 0 ? "+" : ""}${(d.ret*100).toFixed(1)}%)`;
                return `Close: ${SD.fmtMoney(d.y)}${retStr}`;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: COLORS.axis, maxTicksLimit: 8, font: { size: 9 } } },
          y: { grid: { color: COLORS.grid }, ticks: { color: COLORS.axis, font: { size: 9 } } }
        }
      }
    });

    $("moves-gains").innerHTML = topGains.map(r =>
      `<li><span>${r.date}</span><span class="up">+${(r.weeklyReturn*100).toFixed(1)}%</span></li>`).join("");
    $("moves-declines").innerHTML = topDeclines.map(r =>
      `<li><span>${r.date}</span><span class="down">${(r.weeklyReturn*100).toFixed(1)}%</span></li>`).join("");

    els.overlay.classList.add("open");
  }

  function closeOverlay() {
    els.overlay.classList.remove("open");
  }

  // ---------------- Init ----------------

  function wireEvents() {
    ["fromYear","toYear","sectorFilter","viewFilter","measureSelect","breakdownSelect"].forEach(id => {
      els[id].addEventListener("change", renderAll);
    });
    let searchTimer;
    els.tickerSearch.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderAll, 220);
    });
    els.resetBtn.addEventListener("click", resetFilters);
    els.overlayClose.addEventListener("click", closeOverlay);
    els.overlay.addEventListener("click", (e) => { if (e.target === els.overlay) closeOverlay(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOverlay(); });
  }

  function renderTape() {
    const { stats } = SD.computeStats({});
    const eligible = stats.filter(s => s.eligible);
    const sample = eligible.slice().sort((a,b) => Math.abs(b.meanWeeklyReturn) - Math.abs(a.meanWeeklyReturn)).slice(0, 24);
    const track = $("tape-track");
    const html = sample.map(s => {
      const cls = s.cumulativeReturn >= 0 ? "up" : "down";
      const arrow = s.cumulativeReturn >= 0 ? "▲" : "▼";
      return `<span class="ticker-tape__item ${cls}"><b>${s.ticker}</b>${arrow} ${SD.fmtPct(s.cumulativeReturn,1)}</span>`;
    }).join("");
    track.innerHTML = html + html; // duplicate for seamless loop
  }

  document.addEventListener("DOMContentLoaded", () => {
    cacheEls();
    wireEvents();
    els.loadingBanner.style.display = "flex";
    SD.load().then(() => {
      els.loadingBanner.style.display = "none";
      populateControls();
      renderTape();
      renderAll();
    }).catch(err => {
      els.loadingBanner.innerHTML = `<span style="color:#e66767">Failed to load data: ${err.message || err}</span>`;
    });
  });
})();
