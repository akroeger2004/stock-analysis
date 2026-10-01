/* Report page charts, built from pre-computed numbers (see scripts/
   compute_report_stats.ps1 and rank_consistent_gainers.ps1 for how every
   figure below was derived from data/sp500_nasdaq100_weekly_prices.csv). */
(function () {
  const COLORS = {
    sp: "#3987e5", spSoft: "rgba(57,135,229,0.35)",
    ndx: "#d95926", ndxSoft: "rgba(217,89,38,0.35)",
    both: "#9085e9",
    good: "#0ca30c", critical: "#e66767", warning: "#fab219",
    grid: "#2c2c2a", axis: "#898781", text: "#c3c2b7"
  };

  const FIX_SERIES = [["2021-09-27",74.06],["2021-11-01",99.02],["2021-12-27",98.94],["2022-02-28",85.0],["2022-04-25",84.42],["2022-06-13",75.33],["2022-07-25",105.66],["2022-09-26",97.33],["2022-10-24",121.5],["2022-11-28",126.0],["2022-12-26",115.08],["2023-01-30",122.33],["2023-02-27",151.04],["2023-03-27",145.96],["2023-04-24",149.49],["2023-05-29",154.86],["2023-06-26",164.2],["2023-07-31",177.51],["2023-08-28",185.96],["2023-09-25",170.41],["2023-10-30",187.81],["2023-11-27",196.61],["2023-12-25",205.67],["2024-01-29",231.29],["2024-02-26",314.43],["2024-03-25",317.71],["2024-04-29",315.03],["2024-05-27",327.34],["2024-06-24",304.12],["2024-07-29",306.18],["2024-08-26",353.52],["2024-09-30",402.53],["2024-10-28",392.31],["2024-11-25",493.27],["2024-12-30",448.55],["2025-01-27",436.75],["2025-02-24",363.33],["2025-03-31",296.51],["2025-04-28",432.10],["2025-05-26",478.23],["2025-06-30",540.98],["2025-07-28",695.30],["2025-08-25",703.38],["2025-09-29",818.01],["2025-10-27",965.58],["2025-11-24",976.94],["2025-12-29",1003.64],["2026-01-26",1142.10],["2026-02-23",1429.37],["2026-03-30",1417.19],["2026-04-27",1867.02],["2026-05-25",1828.21],["2026-06-29",1741.30],["2026-07-27",1729.69],["2026-08-31",1610.34],["2026-09-25",1658.91]];

  const MU_SERIES = [["2021-09-27",70.99],["2021-11-08",77.30],["2021-12-27",93.15],["2022-02-14",90.80],["2022-04-04",72.14],["2022-05-30",69.94],["2022-07-25",61.86],["2022-09-19",50.10],["2022-11-14",58.58],["2023-01-09",56.93],["2023-03-06",54.93],["2023-04-24",64.36],["2023-06-19",65.28],["2023-08-14",63.59],["2023-10-16",67.22],["2023-12-11",81.41],["2024-02-05",85.56],["2024-03-18",110.21],["2024-04-29",114.70],["2024-06-10",141.36],["2024-07-29",92.70],["2024-09-16",90.90],["2024-11-11",96.34],["2024-12-30",89.87],["2025-02-24",93.63],["2025-03-31",64.72],["2025-05-19",93.37],["2025-06-30",122.29],["2025-08-25",119.01],["2025-09-29",187.83],["2025-11-10",246.83],["2025-12-29",315.42],["2026-01-26",414.88],["2026-02-23",412.37],["2026-03-30",366.24],["2026-05-04",746.81],["2026-06-15",1133.99],["2026-07-13",848.95],["2026-08-24",932.86],["2026-09-25",1082.28]];

  const BE_SERIES = [["2021-09-27",18.47],["2021-11-08",34.15],["2021-12-27",21.93],["2022-02-14",18.35],["2022-04-04",22.55],["2022-05-30",18.22],["2022-07-25",20.23],["2022-09-19",21.36],["2022-11-14",21.06],["2023-01-09",23.17],["2023-03-06",20.12],["2023-04-24",16.65],["2023-06-19",15.44],["2023-08-14",14.49],["2023-10-16",11.31],["2023-12-11",14.20],["2024-02-05",11.53],["2024-03-18",9.87],["2024-04-29",11.80],["2024-06-10",14.33],["2024-07-29",11.79],["2024-09-16",10.91],["2024-11-11",21.14],["2024-12-30",24.32],["2025-02-24",24.02],["2025-03-31",16.60],["2025-05-19",19.48],["2025-06-30",24.24],["2025-08-25",52.94],["2025-09-29",90.29],["2025-11-10",111.89],["2025-12-29",98.69],["2026-01-26",151.37],["2026-02-23",155.67],["2026-03-30",135.63],["2026-05-04",261.03],["2026-06-15",328.91],["2026-07-13",214.96],["2026-08-24",210.77],["2026-09-25",288.70]];

  function baseOpts(extra) {
    return Object.assign({
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }, extra);
  }
  function axisColor(scaleExtra) {
    return Object.assign({ grid: { color: COLORS.grid }, ticks: { color: COLORS.axis, font: { size: 10 } } }, scaleExtra || {});
  }

  function lineChart(id, series, color, label) {
    new Chart(document.getElementById(id), {
      type: "line",
      data: {
        labels: series.map(p => p[0]),
        datasets: [{ data: series.map(p => p[1]), borderColor: color, backgroundColor: color + "22",
          fill: true, borderWidth: 2, pointRadius: 0, tension: 0.2 }]
      },
      options: baseOpts({
        plugins: { legend: { display: false }, tooltip: { callbacks: {
          label: ctx => `${label}: $${ctx.raw.toFixed(2)}`
        } } },
        scales: { x: { ticks: { color: COLORS.axis, maxTicksLimit: 7, font: { size: 9 } }, grid: { display: false } },
                  y: { ...axisColor(), ticks: { color: COLORS.axis, font: { size: 9 }, callback: v => "$" + v } } }
      })
    });
  }

  // Writes each bar's value at its tip, so readers don't have to read it off the axis.
  // Enabled per chart with options.plugins.valueLabels = { fmt: value => text }.
  Chart.register({
    id: "valueLabels",
    afterDatasetsDraw(chart, args, opts) {
      if (!opts || !opts.fmt) return;
      const ctx = chart.ctx;
      const horizontal = chart.options.indexAxis === "y";
      ctx.save();
      ctx.font = "700 12px 'JetBrains Mono', monospace";
      ctx.fillStyle = COLORS.text;
      chart.data.datasets.forEach((ds, di) => {
        chart.getDatasetMeta(di).data.forEach((bar, i) => {
          const v = ds.data[i];
          if (v === null || v === undefined) return;
          const text = opts.fmt(v);
          if (horizontal) {
            ctx.textAlign = "left"; ctx.textBaseline = "middle";
            ctx.fillText(text, bar.x + 8, bar.y);
          } else {
            ctx.textAlign = "center"; ctx.textBaseline = v < 0 ? "top" : "bottom";
            ctx.fillText(text, bar.x, bar.y + (v < 0 ? 6 : -6));
          }
        });
      });
      ctx.restore();
    }
  });

  // 1. Overlap between the two Top-25 lists
  new Chart(document.getElementById("chart-overlap"), {
    type: "bar",
    data: {
      labels: ["Unique to S&P 500 Top 25", "Unique to Nasdaq 100 Top 25", "On Both Top 25 Lists"],
      datasets: [{ data: [20, 20, 5], backgroundColor: [COLORS.sp, COLORS.ndx, COLORS.both], borderRadius: 4 }]
    },
    options: baseOpts({
      indexAxis: "y",
      plugins: { legend: { display: false }, valueLabels: { fmt: v => v + " tickers" } },
      scales: { x: axisColor({ max: 24, ticks: { color: COLORS.axis, font: { size: 10 }, stepSize: 5 } }),
                y: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 12 } } } }
    })
  });

  // 2 & 3. Case studies
  lineChart("chart-fix", FIX_SERIES, COLORS.sp, "FIX");
  lineChart("chart-mu", MU_SERIES, COLORS.ndx, "MU");

  // 4. Sector composition of each Top 25
  new Chart(document.getElementById("chart-sector"), {
    type: "bar",
    data: {
      labels: ["Information Technology", "Industrials", "Energy", "Health Care", "Communication Services", "Consumer Discretionary", "Consumer Staples", "Utilities", "Financials"],
      datasets: [
        { label: "S&P 500 Top 25", data: [11, 6, 3, 3, 0, 0, 0, 1, 1], backgroundColor: COLORS.sp, borderRadius: 3 },
        { label: "Nasdaq 100 Top 25", data: [14, 1, 0, 2, 3, 2, 2, 1, 0], backgroundColor: COLORS.ndx, borderRadius: 3 }
      ]
    },
    options: baseOpts({
      indexAxis: "y",
      plugins: { legend: { display: true, position: "top", labels: { color: COLORS.text, boxWidth: 12, font: { size: 11 } } } },
      scales: { x: axisColor({ stacked: false }), y: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 10.5 } } } }
    })
  });

  // 5. Consistency vs. raw gains scatter (labeled points)
  const spPoints = [
    { x: 5.9, y: 2140, tick: "FIX", side: "right", label: "FIX  +2,140%  ·  #1 S&P consistency" },
    { x: 12.3, y: 1463, tick: "BE", side: "left", label: "BE  +1,463%  ·  #29 (misses top 25)" },
    { x: 12.9, y: 1058, tick: "SMCI", side: "left", label: "SMCI  +1,058%  ·  #36 (misses top 25)" }
  ];
  const ndxPoints = [
    { x: 7.7, y: 1425, tick: "MU", side: "right", label: "MU  +1,425%  ·  #1 Nasdaq consistency" },
    { x: 6.6, y: 986, tick: "STX", side: "right", label: "STX  +986%  ·  #2 Nasdaq consistency" }
  ];
  // Draws each point's ticker next to its marker so readers can tell the dots apart.
  const pointLabels = {
    id: "pointLabels",
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = "700 12px 'JetBrains Mono', monospace";
      ctx.fillStyle = COLORS.text;
      ctx.textBaseline = "middle";
      chart.data.datasets.forEach((ds, di) => {
        chart.getDatasetMeta(di).data.forEach((el, i) => {
          const p = ds.data[i];
          ctx.textAlign = p.side === "left" ? "right" : "left";
          ctx.fillText(p.tick, el.x + (p.side === "left" ? -12 : 12), el.y);
        });
      });
      ctx.restore();
    }
  };
  new Chart(document.getElementById("chart-consistency-scatter"), {
    type: "scatter",
    plugins: [pointLabels],
    data: { datasets: [
      { label: "S&P 500 names", data: spPoints, backgroundColor: COLORS.spSoft, borderColor: COLORS.sp, borderWidth: 1.5, radius: 6, hoverRadius: 8 },
      { label: "Nasdaq 100 names", data: ndxPoints, backgroundColor: COLORS.ndxSoft, borderColor: COLORS.ndx, borderWidth: 1.5, radius: 6, hoverRadius: 8 }
    ] },
    options: baseOpts({
      plugins: { legend: { display: true, position: "top", labels: { color: COLORS.text, boxWidth: 12, font: { size: 11 } } },
                 tooltip: { callbacks: { label: ctx => ctx.raw.label } } },
      scales: {
        x: axisColor({ min: 5, max: 14, title: { display: true, text: "Weekly volatility (std. dev.)", color: COLORS.axis, font: { size: 10 } },
                        ticks: { color: COLORS.axis, font: { size: 9 }, callback: v => v + "%" } }),
        y: axisColor({ title: { display: true, text: "5-year cumulative return", color: COLORS.axis, font: { size: 10 } },
                        ticks: { color: COLORS.axis, font: { size: 9 }, callback: v => v + "%" } })
      }
    })
  });

  // 6. Average volatility, S&P vs Nasdaq eligible pools
  new Chart(document.getElementById("chart-volatility"), {
    type: "bar",
    data: { labels: ["S&P 500", "Nasdaq 100"],
      datasets: [
        { label: "All eligible tickers (493 S&P 500, 98 Nasdaq 100)", data: [4.46, 5.31], backgroundColor: [COLORS.spSoft, COLORS.ndxSoft], borderRadius: 4 },
        { label: "Top 25 most consistent", data: [5.48, 5.82], backgroundColor: [COLORS.sp, COLORS.ndx], borderRadius: 4 }
      ] },
    options: baseOpts({
      plugins: { legend: { display: true, position: "top", labels: { color: COLORS.text, boxWidth: 12, font: { size: 11 } } },
                 valueLabels: { fmt: v => v.toFixed(2) + "%" },
                 tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw.toFixed(2)}%` } } },
      scales: { x: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 12 } } },
                y: axisColor({ min: 0, max: 7, ticks: { color: COLORS.axis, font: { size: 10 }, stepSize: 1, callback: v => v + "%" } }) }
    })
  });

  // 7. Top 25 outperformance vs the full eligible pool
  new Chart(document.getElementById("chart-outperformance"), {
    type: "bar",
    data: {
      labels: ["S&P 500", "Nasdaq 100"],
      datasets: [
        { label: "Top 25 Consistent (avg)", data: [697.1, 420.4], backgroundColor: [COLORS.sp, COLORS.ndx], borderRadius: 4 },
        { label: "Full Eligible Pool (avg)", data: [87.9, 135.5], backgroundColor: [COLORS.spSoft, COLORS.ndxSoft], borderRadius: 4 }
      ]
    },
    options: baseOpts({
      plugins: { legend: { display: true, position: "top", labels: { color: COLORS.text, boxWidth: 12, font: { size: 11 } } },
                 valueLabels: { fmt: v => "+" + Math.round(v) + "%" } },
      scales: { x: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 12 } } },
                y: axisColor({ max: 800, ticks: { color: COLORS.axis, font: { size: 10 }, callback: v => v + "%" } }) }
    })
  });

  // 8. Excluded tickers — weeks of history available
  new Chart(document.getElementById("chart-excluded"), {
    type: "bar",
    data: {
      labels: ["EA", "HONA", "FDXF", "Q", "SNDK", "SOLV", "GEV", "RDDT", "VLTO", "ARM", "KVUE", "GEHC"],
      datasets: [{ data: [1, 16, 19, 49, 86, 132, 132, 133, 157, 160, 179, 199], backgroundColor: COLORS.warning, borderRadius: 3, barThickness: 16 }]
    },
    options: baseOpts({
      indexAxis: "y",
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw} of 262 weeks (${(ctx.raw/262*100).toFixed(0)}%)` } } },
      scales: { x: axisColor({ title: { display: true, text: "Weeks of history out of 262 possible", color: COLORS.axis, font: { size: 10 } } }),
                y: { grid: { display: false }, ticks: { autoSkip: false, color: COLORS.text, font: { size: 11, family: "monospace" } } } }
    })
  });

  // 9. Most extreme single weeks in the dataset
  new Chart(document.getElementById("chart-extremes"), {
    type: "bar",
    data: {
      labels: ["INSM — Insmed, 2024-05-27", "FISV — Fiserv, 2025-10-27"],
      datasets: [{ data: [150, -47], backgroundColor: [COLORS.good, COLORS.critical], borderRadius: 6, barThickness: 70 }]
    },
    options: baseOpts({
      plugins: { legend: { display: false }, valueLabels: { fmt: v => (v > 0 ? "+" : "−") + Math.abs(v) + "%" } },
      scales: { x: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 11.5 } } },
                y: axisColor({ min: -100, max: 200, ticks: { color: COLORS.axis, font: { size: 10 }, stepSize: 50, callback: v => v + "%" } }) }
    })
  });
})();
