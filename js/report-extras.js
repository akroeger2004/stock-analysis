/* Report page extras: reading aids (progress bar, section index, scroll reveal, count-up tiles),
   hover-linking between the Finding 5 text and its chart, the "what would your money have become"
   calculator, and the animated top-25 race. Runs after report.js. Data: data/growth_of_10k.csv
   (group lines, embedded in report.js) and data/top25_growth_curves.csv (per-stock lines, fetched here). */
(function () {
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const usd = v => "$" + Math.round(v).toLocaleString("en-US");
  const GROUP_COLORS = { sp: "#3987e5", ndx: "#d95926", both: "#9085e9" };

  // Company + index group for the 45 tickers on either top-25 list (from data/*_top25_consistent_gainers.csv).
  const META = {CEG:["Constellation Energy","both"],AAPL:["Apple Inc.","both"],MAR:["Marriott International","both"],HWM:["Howmet Aerospace","sp"],APP:["AppLovin","both"],MCK:["McKesson Corporation","sp"],JBL:["Jabil","sp"],GILD:["Gilead Sciences","both"],FIX:["Comfort Systems USA","sp"],LLY:["Lilly (Eli)","sp"],VLO:["Valero Energy","sp"],VRTX:["Vertex Pharmaceuticals","both"],AMAT:["Applied Materials","both"],STX:["Seagate Technology","both"],WMT:["Walmart","both"],AVGO:["Broadcom","both"],GE:["GE Aerospace","sp"],TRGP:["Targa Resources","sp"],GOOG:["Alphabet Inc. (Class C)","both"],AMD:["Advanced Micro Devices","both"],CRWD:["CrowdStrike","both"],CTAS:["Cintas","both"],GOOGL:["Alphabet Inc. (Class A)","both"],MU:["Micron Technology","both"],MPC:["Marathon Petroleum","sp"],VST:["Vistra Corp.","sp"],PANW:["Palo Alto Networks","both"],PLTR:["Palantir Technologies","both"],APH:["Amphenol","sp"],DELL:["Dell Technologies","sp"],KLAC:["KLA Corporation","both"],FLEX:["Flex Ltd.","sp"],WDC:["Western Digital","both"],ORLY:["O'Reilly Automotive","both"],CAH:["Cardinal Health","sp"],CAT:["Caterpillar Inc.","sp"],EME:["Emcor","sp"],PWR:["Quanta Services","sp"],ANET:["Arista Networks","sp"],NVDA:["Nvidia","both"],IBKR:["Interactive Brokers","sp"],LITE:["Lumentum","sp"],LRCX:["Lam Research","both"],MRVL:["Marvell Technology","both"],COST:["Costco","both"]};

  // Sector of each of the 45 tickers (from data/*_top25_consistent_gainers.csv) and the race's bar colors.
  const SECTOR = {HWM:"Industrials",WDC:"Information Technology",CAH:"Health Care",ANET:"Information Technology",APH:"Information Technology",GOOGL:"Communication Services",EME:"Industrials",LLY:"Health Care",AMD:"Information Technology",CRWD:"Information Technology",FIX:"Industrials",MCK:"Health Care",PWR:"Industrials",NVDA:"Information Technology",WMT:"Consumer Staples",GILD:"Health Care",ORLY:"Consumer Discretionary",FLEX:"Information Technology",LITE:"Information Technology",JBL:"Information Technology",MRVL:"Information Technology",CAT:"Industrials",AAPL:"Information Technology",COST:"Consumer Staples",LRCX:"Information Technology",MU:"Information Technology",TRGP:"Energy",VST:"Utilities",PLTR:"Information Technology",AMAT:"Information Technology",STX:"Information Technology",GE:"Industrials",APP:"Communication Services",VRTX:"Health Care",KLAC:"Information Technology",MAR:"Consumer Discretionary",GOOG:"Communication Services",IBKR:"Financials",VLO:"Energy",CEG:"Utilities",PANW:"Information Technology",MPC:"Energy",DELL:"Information Technology",AVGO:"Information Technology",CTAS:"Industrials"};
  const SECTOR_COLORS = {"Information Technology":"#3987e5","Industrials":"#d95926","Health Care":"#2fb36d","Energy":"#fab219","Communication Services":"#9085e9","Utilities":"#1fb5c9","Consumer Staples":"#e377c2","Consumer Discretionary":"#c9a86a","Financials":"#9ca3af"};
  /* ---------- Reading aids ---------- */

  // Thin reading-progress bar along the top edge.
  const bar = document.createElement("div");
  bar.className = "read-progress";
  document.body.appendChild(bar);
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? Math.min(100, window.scrollY / max * 100) : 0) + "%";
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Sticky section index (1..N, Data) that highlights the section in view.
  const sections = $$("section.finding");
  const closing = $(".closing");
  const nav = $(".site-nav");
  const toc = document.createElement("nav");
  toc.className = "toc";
  toc.setAttribute("aria-label", "Report sections");
  const tocLinks = [];
  const addLink = (target, id, label, title) => {
    target.id = id;
    const a = document.createElement("a");
    a.href = "#" + id; a.textContent = label; a.title = title;
    toc.appendChild(a); tocLinks.push([a, target]);
  };
  sections.forEach((s, i) => addLink(s, "finding-" + (i + 1), String(i + 1), $("h2", s).textContent));
  if (closing) addLink(closing, "about-data", "Data", "About this data");
  const page = $(".page");
  const head = $(".page-head") || $(".hero");
  const firstFindings = $(".headline-grid") || sections[0];
  firstFindings.parentNode.insertBefore(toc, firstFindings);
  const place = () => { toc.style.top = (nav ? nav.offsetHeight : 0) + "px"; };
  place(); window.addEventListener("resize", place);

  if ("IntersectionObserver" in window) {
    const visible = new Set();
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      const current = tocLinks.find(([, t]) => visible.has(t));
      tocLinks.forEach(([a]) => a.classList.toggle("active", current && a === current[0]));
    }, { rootMargin: "-30% 0px -55% 0px" });
    tocLinks.forEach(([, t]) => spy.observe(t));

    // Scroll reveal: findings fade up as they come into view (content stays visible if JS or motion is off).
    if (!reduced) {
      document.documentElement.classList.add("js-reveal");
      const reveal = new IntersectionObserver(entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("in"); reveal.unobserve(e.target); }
      }), { threshold: 0.08 });
      sections.forEach(s => { s.classList.add("reveal"); reveal.observe(s); });
    }

    // Headline tiles count up once when first seen.
    const count = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      count.unobserve(e.target);
      const node = Array.from(e.target.childNodes).find(n => n.nodeType === 3 && /\d/.test(n.nodeValue));
      if (!node || reduced) return;
      const m = node.nodeValue.match(/^(\D*)([\d,]+)(.*)$/s);
      if (!m) return;
      const target = parseInt(m[2].replace(/,/g, ""), 10), t0 = performance.now(), dur = 1100;
      const step = now => {
        const p = Math.min(1, (now - t0) / dur), v = Math.round(target * (1 - Math.pow(1 - p, 3)));
        node.nodeValue = m[1] + v.toLocaleString("en-US") + m[3];
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }), { threshold: 0.6 });
    $$(".headline-tile .value").forEach(v => count.observe(v));
  }

  /* ---------- Hover-link: tickers in the Finding 5 text highlight their scatter point ---------- */
  const scatterSection = sections.find(s => $("#chart-consistency-scatter", s));
  const scatter = window.Chart && Chart.getChart("chart-consistency-scatter");
  if (scatterSection && scatter) {
    $$("p", scatterSection).forEach(p => {
      p.innerHTML = p.innerHTML.replace(/\b(BE|SMCI|FIX|MU|STX)\b/g, '<span class="tk" data-t="$1">$1</span>');
    });
    const find = t => {
      for (let d = 0; d < scatter.data.datasets.length; d++) {
        const i = scatter.data.datasets[d].data.findIndex(p => p.tick === t);
        if (i >= 0) return [d, i];
      }
      return null;
    };
    $$(".tk", scatterSection).forEach(el => {
      const on = () => {
        const hit = find(el.dataset.t); if (!hit) return;
        const els = [{ datasetIndex: hit[0], index: hit[1] }];
        scatter.setActiveElements(els);
        scatter.tooltip.setActiveElements(els, { x: 0, y: 0 });
        scatter.update();
      };
      const off = () => {
        scatter.setActiveElements([]); scatter.tooltip.setActiveElements([], { x: 0, y: 0 }); scatter.update();
      };
      el.addEventListener("mouseenter", on); el.addEventListener("mouseleave", off);
    });
  }

  /* ---------- Per-stock curves (shared by the calculator and the race) ---------- */
  const loadCurves = fetch("data/top25_growth_curves.csv").then(r => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  }).then(text => {
    const lines = text.trim().split(/\r?\n/).map(l => l.replace(/"/g, "").split(","));
    const tickers = lines[0].slice(1);
    const dates = lines.slice(1).map(r => r[0]);
    const values = {};
    tickers.forEach((t, j) => { values[t] = lines.slice(1).map(r => +r[j + 1]); });
    return { tickers, dates, values };
  });

  /* ---------- Calculator ---------- */
  const calc = $("#calc");
  if (calc) {
    const G = window.GROWTH_10K;           // exposed by report.js
    const amount = $("#calc-amount", calc), slider = $("#calc-week", calc), stockSel = $("#calc-stock", calc);
    const out = $("#calc-out", calc), dateLabel = $("#calc-date", calc);
    const groups = [
      ["S&P 500 top 25", G && G.sp500Top25, "sp"], ["S&P 500, all eligible", G && G.sp500All, "sp"],
      ["Nasdaq 100 top 25", G && G.nasdaqTop25, "ndx"], ["Nasdaq 100, all eligible", G && G.nasdaqAll, "ndx"]
    ];
    let stocks = null;
    const fmtPct = r => (r >= 0 ? "+" : "−") + Math.abs(r * 100).toLocaleString("en-US", { maximumFractionDigits: 0 }) + "%";
    function render() {
      const amt = Math.max(0, parseFloat(String(amount.value).replace(/,/g, "")) || 0), i = +slider.value;
      dateLabel.textContent = G.dates[i];
      const cards = groups.map(([label, series, g]) => [label, amt * series[i] / 10000, g]);
      if (stocks && stocks.values[stockSel.value]) {
        const t = stockSel.value;
        cards.push([t + " · " + (META[t] ? META[t][0] : t), amt * stocks.values[t][i] / 10000, META[t] ? META[t][1] : "both"]);
      }
      out.innerHTML = cards.map(([label, v, g]) => `
        <div class="calc__card" style="--c:${GROUP_COLORS[g]}">
          <div class="calc__label">${label}</div>
          <div class="calc__value">${usd(v)}</div>
          <div class="calc__gain ${v >= amt ? "up" : "down"}">${amt ? fmtPct(v / amt - 1) : "—"}</div>
        </div>`).join("");
    }
    if (G) {
      slider.max = G.dates.length - 1; slider.value = G.dates.length - 1;
      ["input", "change"].forEach(ev => { amount.addEventListener(ev, render); slider.addEventListener(ev, render); stockSel.addEventListener(ev, render); });
      render();
      loadCurves.then(data => {
        stocks = data;
        stockSel.innerHTML = data.tickers.slice().sort().map(t => `<option value="${t}">${t} · ${META[t] ? META[t][0] : t}</option>`).join("");
        stockSel.value = "FIX";
        render();
      }).catch(() => { stockSel.parentNode.hidden = true; });
    }
  }

  /* ---------- Animated race ---------- */
  const raceBox = $("#race");
  if (raceBox) {
    const TOP = 10, ROW = 36;
    const area = $(".race__area", raceBox), dateEl = $("#race-date", raceBox), leadEl = $("#race-leader", raceBox);
    const playBtn = $("#race-play", raceBox), restartBtn = $("#race-restart", raceBox), scrub = $("#race-scrub", raceBox), speed = $("#race-speed", raceBox);
    area.style.height = (TOP * ROW) + "px";
    loadCurves.then(data => {
      const n = data.dates.length, rows = {};
      data.tickers.forEach(t => {
        const a = document.createElement("a");
        a.className = "race__row"; a.href = "dashboard.html?ticker=" + encodeURIComponent(t);
        a.title = (META[t] ? META[t][0] : t) + " - open in the dashboard";
        a.innerHTML = `<b>${t}</b><span class="race__track"><i style="background:${SECTOR_COLORS[SECTOR[t]] || "#9ca3af"}"></i></span><em></em>`;
        a.style.opacity = 0; area.appendChild(a);
        rows[t] = { el: a, fill: $("i", a), val: $("em", a) };
      });
      const legend = $("#race-legend", raceBox);
      legend.innerHTML = Object.keys(SECTOR_COLORS).map(s => `<span><i style="background:${SECTOR_COLORS[s]}"></i>${s}</span>`).join("");
      scrub.max = n - 1;
      let idx = 0, timer = null;
      function draw(i) {
        idx = i; scrub.value = i;
        const order = data.tickers.slice().sort((a, b) => data.values[b][i] - data.values[a][i]);
        const top = data.values[order[0]][i], domain = Math.max(top * 1.04, 14000);
        order.forEach((t, rank) => {
          const r = rows[t], v = data.values[t][i];
          r.el.style.transform = `translateY(${Math.min(rank, TOP) * ROW}px)`;
          r.el.style.opacity = rank < TOP ? 1 : 0;
          r.el.style.pointerEvents = rank < TOP ? "auto" : "none";
          r.el.classList.toggle("lead", rank === 0);
          r.fill.style.width = Math.max(1, v / domain * 100) + "%";
          r.val.textContent = usd(v);
        });
        dateEl.textContent = data.dates[i];
        leadEl.textContent = i === 0 ? "Everyone starts at $10,000" : order[0] + " leads at " + usd(data.values[order[0]][i]);
      }
      const stop = () => { clearInterval(timer); timer = null; playBtn.textContent = "▶ Play"; };
      const play = () => {
        if (idx >= n - 1) draw(0);
        playBtn.textContent = "❚❚ Pause";
        timer = setInterval(() => { if (idx >= n - 1) { stop(); return; } draw(idx + 1); }, +speed.value);
      };
      playBtn.addEventListener("click", () => (timer ? stop() : play()));
      restartBtn.addEventListener("click", () => { stop(); draw(0); play(); });
      scrub.addEventListener("input", () => { stop(); draw(+scrub.value); });
      speed.addEventListener("change", () => { if (timer) { stop(); play(); } });
      draw(n - 1);                                   // start on the finish so the chart is never blank
      if ("IntersectionObserver" in window && !reduced) {
        const once = new IntersectionObserver(es => {
          if (es.some(e => e.isIntersecting)) { once.disconnect(); draw(0); play(); }
        }, { threshold: 0.5 });
        once.observe(raceBox);
      }
    }).catch(err => { area.innerHTML = '<p class="race__err">Couldn’t load the race data (' + err.message + ').</p>'; });
  }
})();
