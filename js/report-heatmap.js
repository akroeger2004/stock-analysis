/* Sector heatmap (Finding 11): a treemap where tile area = number of eligible tickers in the sector and
   tile color = the sector's average 5-year cumulative return. Data: data/sector_summary.csv, built by
   scripts/compute_sector_summary.ps1. Hover or click a tile for its details; toggle S&P 500 / Nasdaq 100. */
(function () {
  const root = document.getElementById("heatmap");
  if (!root) return;
  const map = root.querySelector(".hm__map"), detail = root.querySelector(".hm__detail");
  const buttons = Array.from(root.querySelectorAll(".hm__pool button"));
  const pct = (v, d) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toLocaleString("en-US", { maximumFractionDigits: d == null ? 0 : d }) + "%";
  const NEUTRAL = [58, 63, 77], LOSS = [230, 103, 103], GAIN = [23, 163, 74];
  const mix = (a, b, t) => "rgb(" + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",") + ")";
  // Gray at 0%, toward red for losses (full red at -50%), toward green for gains (full green at +250%, sqrt-scaled).
  const colorFor = v => v < 0 ? mix(NEUTRAL, LOSS, Math.min(1, -v / 0.5)) : mix(NEUTRAL, GAIN, Math.sqrt(Math.min(1, v / 2.5)));

  // Squarified treemap layout (Bruls, Huizing, van Wijk).
  function squarify(items, x, y, w, h) {
    const total = items.reduce((s, i) => s + i.value, 0), k = w * h / total;
    let rest = items.map(i => Object.assign({}, i, { area: i.value * k })), rects = [];
    const worst = (row, side) => {
      const s = row.reduce((a, r) => a + r.area, 0), mx = Math.max(...row.map(r => r.area)), mn = Math.min(...row.map(r => r.area));
      return Math.max(side * side * mx / (s * s), (s * s) / (side * side * mn));
    };
    while (rest.length) {
      const side = Math.min(w, h);
      let row = [rest[0]], n = 1;
      while (n < rest.length && worst(row.concat(rest[n]), side) <= worst(row, side)) { row.push(rest[n]); n++; }
      rest = rest.slice(row.length);
      const area = row.reduce((a, r) => a + r.area, 0);
      if (w >= h) {
        const cw = area / h; let cy = y;
        row.forEach(r => { const ih = r.area / cw; rects.push({ item: r, x, y: cy, w: cw, h: ih }); cy += ih; });
        x += cw; w -= cw;
      } else {
        const rh = area / w; let cx = x;
        row.forEach(r => { const iw = r.area / rh; rects.push({ item: r, x: cx, y, w: iw, h: rh }); cx += iw; });
        y += rh; h -= rh;
      }
    }
    return rects;
  }

  let rows = [], pool = "S&P 500", selected = null;

  function showDetail(r) {
    selected = r.sector;
    Array.from(map.children).forEach(t => t.classList.toggle("sel", t.dataset.sector === r.sector));
    const links = r.top5.map(t => `<a href="dashboard.html?ticker=${encodeURIComponent(t)}">${t}</a>`).join(", ");
    detail.innerHTML = `
      <div class="hm__dname">${r.sector} <span>${r.tickers} ${r.tickers === 1 ? "stock" : "stocks"} in the ${pool} pool</span></div>
      <div class="hm__dgrid">
        <div><em>Avg 5-yr return</em><b style="color:${r.cum >= 0 ? "var(--good)" : "var(--critical)"}">${pct(r.cum)}</b></div>
        <div><em>Avg weekly volatility</em><b>${(r.vol * 100).toFixed(2)}%</b></div>
        <div><em>Avg consistency score</em><b>${r.score.toFixed(4)}</b></div>
        <div><em>Most consistent</em><b class="hm__links">${links}</b></div>
      </div>`;
  }

  function render() {
    const data = rows.filter(r => r.pool === pool).sort((a, b) => b.tickers - a.tickers);
    const W = map.clientWidth, H = map.clientHeight;
    if (!W || !H || !data.length) return;
    map.innerHTML = "";
    squarify(data.map(d => Object.assign({ value: d.tickers }, d)), 0, 0, W, H).forEach(rc => {
      const d = rc.item, t = document.createElement("button");
      t.type = "button"; t.className = "hm__tile"; t.dataset.sector = d.sector;
      t.style.cssText = `left:${rc.x}px;top:${rc.y}px;width:${rc.w}px;height:${rc.h}px;background:${colorFor(d.cum)}`;
      const big = rc.w > 120 && rc.h > 62, mid = rc.w > 70 && rc.h > 40;
      t.innerHTML = `<span class="hm__sec">${d.sector}</span>` + (mid ? `<span class="hm__ret">${pct(d.cum)}</span>` : "") + (big ? `<span class="hm__n">${d.tickers} stocks</span>` : "");
      t.title = `${d.sector}: ${d.tickers} stocks, avg ${pct(d.cum)}`;
      t.addEventListener("mouseenter", () => showDetail(d));
      t.addEventListener("click", () => showDetail(d));
      t.addEventListener("focus", () => showDetail(d));
      map.appendChild(t);
    });
    const keep = data.find(d => d.sector === selected) || data.slice().sort((a, b) => b.cum - a.cum)[0];
    showDetail(keep);
  }

  buttons.forEach(b => b.addEventListener("click", () => {
    pool = b.dataset.pool; selected = null;
    buttons.forEach(x => x.classList.toggle("active", x === b));
    render();
  }));
  if (window.ResizeObserver) new ResizeObserver(() => render()).observe(map); else window.addEventListener("resize", render);

  fetch("data/sector_summary.csv").then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }).then(text => {
    const lines = text.trim().split(/\r?\n/).map(l => l.replace(/"/g, "").split(","));
    rows = lines.slice(1).map(c => ({
      pool: c[0], sector: c[1], tickers: +c[2], cum: +c[3], vol: +c[4], score: +c[5], top5: c[6].split("|")
    }));
    render();
  }).catch(err => { map.innerHTML = '<p class="hm__err">Couldn’t load the sector data (' + err.message + ').</p>'; });
})();
