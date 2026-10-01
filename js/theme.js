/* Light/dark theme toggle for the report page. The theme is an attribute on <html> (data-theme="light");
   dark is the default and the attribute is removed for it. css/style.css holds the light palette and an
   inline script in index.html applies the saved choice before first paint. Here we handle the button,
   save the choice, and re-color the Chart.js charts (their axis/legend/grid colors are set per chart). */
(function () {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const root = document.documentElement;

  const PALETTES = {
    dark:  { text: "#c3c2b7", axis: "#898781", grid: "#2c2c2a", cross: "rgba(255,255,255,0.35)" },
    light: { text: "#3a3f50", axis: "#6a7082", grid: "#e1e5ee", cross: "rgba(20,30,60,0.35)" }
  };

  // Replace any option color that matches the old palette with the new one, anywhere in a chart's options.
  function recolor(obj, from, to) {
    if (!obj || typeof obj !== "object") return;
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (typeof v === "string") {
        for (const key of Object.keys(from)) if (v === from[key]) { obj[k] = to[key]; break; }
      } else if (v && typeof v === "object" && !Array.isArray(v)) recolor(v, from, to);
    });
  }

  let current = root.getAttribute("data-theme") === "light" ? "light" : "dark";

  function apply(theme, save) {
    const from = PALETTES[current], to = PALETTES[theme];
    if (theme === "light") root.setAttribute("data-theme", "light"); else root.removeAttribute("data-theme");
    if (window.REPORT_COLORS) Object.assign(window.REPORT_COLORS, to);
    if (window.Chart) {
      Object.values(Chart.instances).forEach(c => { recolor(c.config.options, from, to); c.update("none"); });
    }
    current = theme;
    btn.firstElementChild.textContent = theme === "light" ? "☾" : "☀";
    btn.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
    btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    if (save) { try { localStorage.setItem("report-theme", theme); } catch (e) {} }
  }

  // The charts were built with dark colors; if the saved theme is light, convert them once on load.
  if (current === "light") { current = "dark"; apply("light", false); } else apply("dark", false);
  btn.addEventListener("click", () => apply(current === "light" ? "dark" : "light", true));
})();
