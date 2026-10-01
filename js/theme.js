/* Light/dark theme toggle, shared by the report and the dashboard. The theme is an attribute on <html>
   (data-theme="light"); dark is the default and the attribute is removed for it. css/style.css holds the
   light palette, and a small inline script in each page's <head> applies the saved choice before first paint.
   The choice is saved under one localStorage key, so toggling on either page carries over to the other -
   including a second tab that is already open (the "storage" event). Chart.js charts get their axis /
   legend / grid colors per chart, so they are re-colored here when the theme changes. */
(function () {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const root = document.documentElement, KEY = "site-theme";

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
    if (window.REPORT_COLORS) Object.assign(window.REPORT_COLORS, to);   // chart code on both pages reads this
    if (window.Chart) {
      Object.values(Chart.instances).forEach(c => { recolor(c.config.options, from, to); c.update("none"); });
    }
    current = theme;
    btn.firstElementChild.textContent = theme === "light" ? "☾" : "☀";
    btn.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
    btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    if (save) { try { localStorage.setItem(KEY, theme); } catch (e) {} }
  }

  // Charts are built with dark colors; if the saved theme is light, convert them once on load.
  if (current === "light") { current = "dark"; apply("light", false); } else apply("dark", false);
  btn.addEventListener("click", () => apply(current === "light" ? "dark" : "light", true));

  // Another tab (the other page) changed the theme: follow it.
  window.addEventListener("storage", e => {
    if (e.key === KEY && (e.newValue === "light" || e.newValue === "dark") && e.newValue !== current) apply(e.newValue, false);
  });
})();
