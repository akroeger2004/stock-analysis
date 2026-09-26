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
  const charts = {};
  let allSectors = [];
  let allDates = [];

  function $(id) { return document.getElementById(id); }
  function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

  // ---------------- Tabs ----------------

  function initTabs() {
    document.querySelectorAll(".dash-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".dash-tab").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".dash-view").forEach(v => v.classList.remove("active"));
        btn.classList.add("active");
        $("view-" + btn.dataset.view).classList.add("active");
      });
    });
  }

  // ---------------- Overview ----------------

  function cacheEls() {
    ["fromYear","toYear","sectorFilter","viewFilter","tickerSearch","measureSelect","breakdownSelect",
     "resetBtn","loadingBanner"].forEach(id => els[id] = $(id));
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
    renderOverview();
  }

  function isSpMember(m) { return m === "S&P 500" || m === "Both"; }
  function isNdxMember(m) { return m === "Nasdaq 100" || m === "Both"; }

  // Build one combined view: all 517 tickers (filtered), split into the two
  // index pools, plus a de-duplicated combined "view" set (Both counts once).
  function buildCombined(f) {
    const { stats } = SD.computeStats({
      yearFrom: f.yearFrom, yearTo: f.yearTo, sector: f.sector, searchTicker: f.search
    });

    const spPool = stats.filter(s => s.eligible && isSpMember(s.indexMembership))
      .sort((a,b) => b.riskAdjustedScore - a.riskAdjustedScore);
    const ndxPool = stats.filter(s => s.eligible && isNdxMember(s.indexMembership))
      .sort((a,b) => b.riskAdjustedScore - a.riskAdjustedScore);

    const spTop25 = spPool.slice(0, 25);
    const ndxTop25 = ndxPool.slice(0, 25);

    let viewMap = new Map();
    if (f.view === "top25") {
      [...spTop25, ...ndxTop25].forEach(s => viewMap.set(s.ticker, s));
    } else if (f.view === "eligible") {
      [...spPool, ...ndxPool].forEach(s => viewMap.set(s.ticker, s));
    } else {
      stats.forEach(s => viewMap.set(s.ticker, s));
    }
    const view = Array.from(viewMap.values());
    const viewEligible = view.filter(s => s.eligible);
    // Per-side chart data must come from each side's OWN ranked pool/top25 —
    // never re-derived from the de-duplicated combined `view`, since a "Both"
    // ticker that only made the *other* index's top 25 would otherwise get
    // wrongly counted on this side too.
    const spViewEligible = f.view === "top25" ? spTop25 : spPool;
    const ndxViewEligible = f.view === "top25" ? ndxTop25 : ndxPool;

    const overlapTop25 = spTop25.filter(s => ndxTop25.some(n => n.ticker === s.ticker)).length;

    return { stats, spPool, ndxPool, spTop25, ndxTop25, view, viewEligible, spViewEligible, ndxViewEligible, overlapTop25 };
  }

  function renderStatTiles(pool) {
    const wrap = $("ov-stats");
    const e = pool.viewEligible;
    if (e.length === 0) {
      wrap.innerHTML = `<div class="stat-tile"><div class="label">No matches</div><div class="value">—</div></div>`;
      return;
    }
    const avgReturn = e.reduce((a,b) => a + b.meanWeeklyReturn, 0) / e.length;
    const avgScore = e.reduce((a,b) => a + b.riskAdjustedScore, 0) / e.length;
    wrap.innerHTML = `
      <div class="stat-tile"><div class="label">Tickers in view</div><div class="value">${SD.fmtInt(pool.view.length)}</div></div>
      <div class="stat-tile"><div class="label">Avg weekly return</div><div class="value ${avgReturn>=0?'up':'down'}">${SD.fmtPct(avgReturn)}</div></div>
      <div class="stat-tile"><div class="label">Avg consistency score</div><div class="value">${SD.fmtNum(avgScore)}</div></div>
      <div class="stat-tile"><div class="label">Overlap (S&amp;P ∩ Nasdaq Top 25)</div><div class="value">${pool.overlapTop25} <span style="font-size:12px;color:var(--text-muted)">of 25</span></div></div>
    `;
  }

  function renderLeaderboard(pool, f) {
    destroyChart("chart-leaderboard");
    const key = f.measure;
    const measureInfo = MEASURES[key];
    const canvas = $("chart-leaderboard");

    if (f.breakdown === "sector") {
      const sectors = Array.from(new Set([...pool.spPool, ...pool.ndxPool].map(s => s.sector))).sort();
      const spAvg = sectors.map(sec => {
        const vals = pool.spPool.filter(s => s.sector === sec).map(s => s[key]);
        return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
      });
      const ndxAvg = sectors.map(sec => {
        const vals = pool.ndxPool.filter(s => s.sector === sec).map(s => s[key]);
        return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
      });
      charts["chart-leaderboard"] = new Chart(canvas, {
        type: "bar",
        data: { labels: sectors, datasets: [
          { label: "S&P 500", data: spAvg, backgroundColor: COLORS.sp.line, borderRadius: 3 },
          { label: "Nasdaq 100", data: ndxAvg, backgroundColor: COLORS.ndx.line, borderRadius: 3 }
        ]},
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: "top", labels: { color: COLORS.text, boxWidth: 12, font: { size: 11 } } },
            tooltip: { callbacks: { label: ctx => `${ctx.dataset.label} ${ctx.label}: ${measureInfo.fmt(ctx.raw)}` } }
          },
          scales: {
            x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.axis, font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 10.5 } } }
          }
        }
      });
    } else {
      const spTop = pool.spPool.slice().sort((a,b) => b[key]-a[key]).slice(0, 10);
      const ndxTop = pool.ndxPool.slice().sort((a,b) => b[key]-a[key]).slice(0, 10);
      const rows = [...spTop.map(s => ({...s, side:"sp"})), ...ndxTop.map(s => ({...s, side:"ndx"}))];
      charts["chart-leaderboard"] = new Chart(canvas, {
        type: "bar",
        data: {
          labels: rows.map(r => r.ticker),
          datasets: [{ data: rows.map(r => r[key]), backgroundColor: rows.map(r => COLORS[r.side].line), borderRadius: 4, barThickness: 12 }]
        },
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `${rows[ctx.dataIndex].ticker} — ${rows[ctx.dataIndex].company}: ${measureInfo.fmt(rows[ctx.dataIndex][key])}` } }
          },
          scales: {
            x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.axis, font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 10, family: "monospace" } } }
          },
          onClick: (evt, elements) => {
            if (!elements.length) return;
            const r = rows[elements[0].index];
            switchToExplorer(r.side, r.ticker);
          }
        }
      });
    }
  }

  function renderScatter(pool) {
    destroyChart("chart-scatter");
    charts["chart-scatter"] = new Chart($("chart-scatter"), {
      type: "scatter",
      data: { datasets: [
        { label: "S&P 500", data: pool.spViewEligible.map(s => ({x:s.stdevWeeklyReturn,y:s.meanWeeklyReturn,ticker:s.ticker,company:s.company})),
          backgroundColor: COLORS.sp.soft, borderColor: COLORS.sp.line, borderWidth: 1, radius: 4, hoverRadius: 7 },
        { label: "Nasdaq 100", data: pool.ndxViewEligible.map(s => ({x:s.stdevWeeklyReturn,y:s.meanWeeklyReturn,ticker:s.ticker,company:s.company})),
          backgroundColor: COLORS.ndx.soft, borderColor: COLORS.ndx.line, borderWidth: 1, radius: 4, hoverRadius: 7 }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top", labels: { color: COLORS.text, boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.raw.ticker} — ${ctx.raw.company}: return ${SD.fmtPct(ctx.raw.y)}, volatility ${SD.fmtPct(ctx.raw.x)}` } }
        },
        scales: {
          x: { title: { display: true, text: "Volatility (weekly)", color: COLORS.axis, font: { size: 10 } },
               grid: { color: COLORS.grid }, ticks: { color: COLORS.axis, font: { size: 9 }, callback: v => (v*100).toFixed(0)+"%" } },
          y: { title: { display: true, text: "Avg weekly return", color: COLORS.axis, font: { size: 10 } },
               grid: { color: COLORS.grid }, ticks: { color: COLORS.axis, font: { size: 9 }, callback: v => (v*100).toFixed(1)+"%" } }
        },
        onClick: (evt, elements) => {
          if (!elements.length) return;
          const el = elements[0];
          const side = el.datasetIndex === 0 ? "sp" : "ndx";
          const p = (side === "sp" ? pool.spViewEligible : pool.ndxViewEligible)[el.index];
          switchToExplorer(side, p.ticker);
        }
      }
    });
  }

  function renderSectorComp(pool) {
    destroyChart("chart-sectorcomp");
    const sectors = Array.from(new Set([...pool.spViewEligible, ...pool.ndxViewEligible].map(s => s.sector))).sort();
    const spCounts = sectors.map(sec => pool.spViewEligible.filter(s => s.sector === sec).length);
    const ndxCounts = sectors.map(sec => pool.ndxViewEligible.filter(s => s.sector === sec).length);

    charts["chart-sectorcomp"] = new Chart($("chart-sectorcomp"), {
      type: "bar",
      data: { labels: sectors, datasets: [
        { label: "S&P 500", data: spCounts, backgroundColor: COLORS.sp.line, borderRadius: 3 },
        { label: "Nasdaq 100", data: ndxCounts, backgroundColor: COLORS.ndx.line, borderRadius: 3 }
      ]},
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top", labels: { color: COLORS.text, boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label} ${ctx.label}: ${ctx.raw} tickers` } }
        },
        scales: {
          x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.axis, font: { size: 9 } } },
          y: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 10.5 } } }
        },
        onClick: (evt, elements) => {
          if (!elements.length) return;
          els.sectorFilter.value = sectors[elements[0].index];
          renderOverview();
        }
      }
    });
  }

  function renderTable(pool, f) {
    const wrap = $("ov-table-wrap");
    if (!wrap.dataset.sortKey) { wrap.dataset.sortKey = "riskAdjustedScore"; wrap.dataset.sortDir = "desc"; }

    function draw() {
      const sortKey = wrap.dataset.sortKey;
      const dir = wrap.dataset.sortDir === "asc" ? 1 : -1;
      const sorted = pool.view.slice().sort((a,b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av === undefined || av === null) return 1;
        if (bv === undefined || bv === null) return -1;
        if (typeof av === "string") return av.localeCompare(bv) * dir;
        return (av - bv) * dir;
      });
      const body = sorted.map(s => {
        const cls = v => v === undefined || v === null ? "" : (v >= 0 ? "up" : "down");
        const side = isSpMember(s.indexMembership) ? "sp" : "ndx";
        return `<tr data-ticker="${s.ticker}" data-side="${side}">
          <td class="ticker-link">${s.ticker}</td>
          <td class="company-cell">${s.company || ""}</td>
          <td class="company-cell">${s.indexMembership}</td>
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
            <th data-key="ticker">Ticker</th><th data-key="company">Company</th>
            <th data-key="indexMembership">Index</th><th data-key="sector">Sector</th>
            <th data-key="weeks">Weeks</th><th data-key="meanWeeklyReturn">Avg Return</th>
            <th data-key="stdevWeeklyReturn">Volatility</th><th data-key="riskAdjustedScore">Score</th>
            <th data-key="cumulativeReturn">Cum. Return</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>`;

      wrap.querySelectorAll("thead th").forEach(th => th.addEventListener("click", () => {
        const k = th.dataset.key;
        wrap.dataset.sortDir = (wrap.dataset.sortKey === k && wrap.dataset.sortDir === "desc") ? "asc" : "desc";
        wrap.dataset.sortKey = k;
        draw();
      }));
      wrap.querySelectorAll("tbody tr").forEach(tr => tr.addEventListener("click", () =>
        switchToExplorer(tr.dataset.side, tr.dataset.ticker)));
    }
    draw();
  }

  function renderOverview() {
    const f = getFilters();
    const pool = buildCombined(f);
    renderStatTiles(pool);
    renderLeaderboard(pool, f);
    renderScatter(pool);
    renderSectorComp(pool);
    renderTable(pool, f);
  }

  // ---------------- Stock Explorer ----------------

  const explorer = { side: "sp", ticker: null, rangeWeeks: 262 };

  function explorerPool(side) {
    const { stats } = SD.computeStats({ tickerFilter: m => side === "sp" ? isSpMember(m.indexMembership) : isNdxMember(m.indexMembership) });
    return stats.filter(s => s.eligible).sort((a,b) => b.riskAdjustedScore - a.riskAdjustedScore).slice(0, 25);
  }

  function renderSymbolList() {
    const pool = explorerPool(explorer.side);
    const q = $("explorerSearch").value.trim().toUpperCase();
    const filtered = q ? pool.filter(s => s.ticker.includes(q) || (s.company||"").toUpperCase().includes(q)) : pool;

    if (!explorer.ticker || !filtered.some(s => s.ticker === explorer.ticker)) {
      explorer.ticker = filtered.length ? filtered[0].ticker : null;
    }

    $("symbolList").innerHTML = filtered.map((s, i) => `
      <div class="symbol-row ${s.ticker === explorer.ticker ? 'selected' : ''}" data-ticker="${s.ticker}">
        <span><span class="t">${s.ticker}</span><br><span class="c">${s.company}</span></span>
        <span class="r">#${i+1}</span>
      </div>`).join("");

    $("symbolList").querySelectorAll(".symbol-row").forEach(row => {
      row.addEventListener("click", () => { explorer.ticker = row.dataset.ticker; renderSymbolList(); renderExplorerDetail(); });
    });

    renderExplorerDetail();
  }

  function switchToExplorer(side, ticker) {
    document.querySelectorAll(".dash-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".dash-view").forEach(v => v.classList.remove("active"));
    document.querySelector('.dash-tab[data-view="explorer"]').classList.add("active");
    $("view-explorer").classList.add("active");

    explorer.side = side;
    document.querySelectorAll(".index-toggle button").forEach(b => b.classList.toggle("active", b.dataset.side === side));
    explorer.ticker = ticker;
    renderSymbolList();
  }

  function renderExplorerDetail() {
    const ticker = explorer.ticker;
    if (!ticker) return;
    const meta = SD.getMeta(ticker);
    const fullSeries = SD.getSeries(ticker);
    const series = fullSeries.slice(-explorer.rangeWeeks);
    const returns = series.map(r => r.weeklyReturn).filter(v => v !== null);

    const m = returns.reduce((a,b)=>a+b,0) / returns.length;
    const variance = returns.reduce((a,b)=>a+Math.pow(b-m,2),0) / returns.length;
    const stdev = Math.sqrt(variance);
    const score = stdev === 0 ? 0 : m / stdev;
    const cum = (series[series.length-1].close - series[0].close) / series[0].close;

    const pills = [];
    if (isSpMember(meta.indexMembership)) pills.push(["sp","S&P 500"]);
    if (isNdxMember(meta.indexMembership)) pills.push(["ndx","Nasdaq 100"]);

    $("ex-ticker").textContent = ticker;
    $("ex-company").textContent = meta.company || "";
    $("ex-sub").innerHTML = pills.map(([c,l]) => `<span class="pill ${c}">${l}</span>`).join("") +
      `${meta.sector} · ${meta.subIndustry || ""}`;

    const pool = explorerPool(explorer.side);
    const rank = pool.findIndex(s => s.ticker === ticker) + 1;

    $("ex-stats").innerHTML = `
      <div class="stat-tile"><div class="label">Weeks shown</div><div class="value">${SD.fmtInt(series.length)}</div></div>
      <div class="stat-tile"><div class="label">Return (range)</div><div class="value ${cum>=0?'up':'down'}">${SD.fmtPct(cum,1)}</div></div>
      <div class="stat-tile"><div class="label">Consistency score</div><div class="value">${SD.fmtNum(score)}</div></div>
      <div class="stat-tile"><div class="label">Top-25 rank</div><div class="value">${rank ? "#"+rank : "—"} <span style="font-size:12px;color:var(--text-muted)">of 25</span></div></div>
    `;

    const dated = series.map(r => ({ x: r.date, y: r.close, ret: r.weeklyReturn }));
    const movesSorted = series.filter(r => r.weeklyReturn !== null).slice().sort((a,b) => b.weeklyReturn - a.weeklyReturn);
    const topGains = movesSorted.slice(0, 5);
    const topDeclines = movesSorted.slice(-5).reverse();
    const bigMoveDates = new Set([...topGains, ...topDeclines].map(r => r.date));

    destroyChart("ex-chart");
    charts["ex-chart"] = new Chart($("ex-chart"), {
      type: "line",
      data: { labels: dated.map(d => d.x), datasets: [{
        data: dated.map(d => d.y),
        borderColor: COLORS[explorer.side].line, backgroundColor: COLORS[explorer.side].fill, fill: true,
        pointRadius: dated.map(d => bigMoveDates.has(d.x) ? 4 : 0), pointHoverRadius: 6,
        pointBackgroundColor: dated.map(d => d.ret !== null && d.ret >= 0 ? COLORS.good : COLORS.critical),
        borderWidth: 1.75, tension: 0.15
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => {
            const d = dated[ctx.dataIndex];
            const retStr = d.ret === null ? "" : `  (${d.ret>=0?"+":""}${(d.ret*100).toFixed(1)}%)`;
            return `Close: ${SD.fmtMoney(d.y)}${retStr}`;
          } } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: COLORS.axis, maxTicksLimit: 8, font: { size: 9 } } },
          y: { grid: { color: COLORS.grid }, ticks: { color: COLORS.axis, font: { size: 9 } } }
        }
      }
    });

    $("ex-gains").innerHTML = topGains.map(r => `<li><span>${r.date}</span><span class="up">+${(r.weeklyReturn*100).toFixed(1)}%</span></li>`).join("");
    $("ex-declines").innerHTML = topDeclines.map(r => `<li><span>${r.date}</span><span class="down">${(r.weeklyReturn*100).toFixed(1)}%</span></li>`).join("");
  }

  function initExplorer() {
    document.querySelectorAll(".index-toggle button").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".index-toggle button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        explorer.side = btn.dataset.side;
        explorer.ticker = null;
        renderSymbolList();
      });
    });
    $("explorerSearch").addEventListener("input", renderSymbolList);
    document.querySelectorAll(".range-toggle button").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".range-toggle button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        explorer.rangeWeeks = parseInt(btn.dataset.range, 10);
        renderExplorerDetail();
      });
    });
    renderSymbolList();
  }

  // ---------------- Ticker tape ----------------

  function renderTape() {
    const { stats } = SD.computeStats({});
    const eligible = stats.filter(s => s.eligible);
    const sample = eligible.slice().sort((a,b) => Math.abs(b.meanWeeklyReturn) - Math.abs(a.meanWeeklyReturn)).slice(0, 24);
    const html = sample.map(s => {
      const cls = s.cumulativeReturn >= 0 ? "up" : "down";
      const arrow = s.cumulativeReturn >= 0 ? "▲" : "▼";
      return `<span class="ticker-tape__item ${cls}"><b>${s.ticker}</b>${arrow} ${SD.fmtPct(s.cumulativeReturn,1)}</span>`;
    }).join("");
    $("tape-track").innerHTML = html + html;
  }

  // ---------------- Init ----------------

  document.addEventListener("DOMContentLoaded", () => {
    cacheEls();
    initTabs();
    ["fromYear","toYear","sectorFilter","viewFilter","measureSelect","breakdownSelect"].forEach(id => {
      els[id].addEventListener("change", renderOverview);
    });
    let searchTimer;
    els.tickerSearch.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderOverview, 220); });
    els.resetBtn.addEventListener("click", resetFilters);

    els.loadingBanner.style.display = "flex";
    SD.load().then(() => {
      els.loadingBanner.style.display = "none";
      populateControls();
      renderTape();
      renderOverview();
      initExplorer();
    }).catch(err => {
      els.loadingBanner.innerHTML = `<span style="color:#e66767">Failed to load data: ${err.message || err}</span>`;
    });
  });
})();
