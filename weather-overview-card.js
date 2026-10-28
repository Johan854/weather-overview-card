{ // bloc isolé : aucune variable ne fuit vers les autres cartes
/*
 * Weather Overview Card (FR)
 * Carte Home Assistant météo : conditions actuelles avec icône animée, alerte, prévisions par jour,
 * mesures (humidité, vent, UV…), risques (pluie, gel, neige) et informations. Style verre, thème
 * clair/sombre automatique, éditeur visuel, textes en français. Fonctionne avec toute entité « weather ».
 */

const CARD_VERSION = "1.1.0";

/* === NUANCE COMMUNE v2 (cartes Johan854) ===
 * Bloc identique dans toutes les cartes. Options : nuance, nuance_perso, intensite.
 * nuance "theme" (par défaut) : suit la variable carte-nuance du thème Home Assistant ;
 * si elle n'existe pas, la carte garde ses couleurs d'origine. Intensité : 0 = neutre, 1 = normal, 2 = très coloré. */
const GV_NUANCES = [["braise", "Braise (rouge)", "#e0524f"], ["ocean", "Océan (bleu)", "#2f8fd8"], ["lagon", "Lagon (turquoise)", "#1fb5a8"], ["foret", "Forêt (vert)", "#3fae5a"], ["lavande", "Lavande (violet)", "#8a63d8"], ["framboise", "Framboise (rose)", "#e05597"], ["ambre", "Ambre (orange)", "#e8902c"], ["ardoise", "Ardoise (neutre)", "#7d8595"]];
const GV_DEFAULTS = { nuance: "theme", intensite: 1 };
const gvAccent = (c) => {
  const p = c && c.nuance_perso;
  if (c && c.nuance === "perso") {
    if (Array.isArray(p) && p.length === 3) return "#" + p.map((v) => Math.max(0, Math.min(255, Math.round(+v || 0))).toString(16).padStart(2, "0")).join("");
    if (typeof p === "string" && /^#?[0-9a-f]{6}$/i.test(p.trim())) return "#" + p.trim().replace("#", "");
  }
  const n = GV_NUANCES.find((x) => x[0] === (c && c.nuance));
  return n ? n[2] : "var(--carte-nuance)";
};
/* Variables posées sur <ha-card> : --g-bg-x (fond dégradé teinté) et --acc-ui-x (couleur d'accent).
 * Sans nuance (thème sans carte-nuance), elles sont invalides : chaque carte retombe alors sur ses couleurs d'origine. */
const gvStyle = (c, dark) => {
  const i = Number(c && c.intensite), ai = Number.isFinite(i) ? Math.max(0, Math.min(2, i)) : 1;
  const m = (pct, base) => `color-mix(in srgb,var(--acc-ui) ${+(pct * ai).toFixed(1)}%,${base})`;
  const bg = dark ? `linear-gradient(160deg,${m(5, "#1b1e32")} 0%,${m(11, "#1f1b2c")} 55%,${m(22, "#1c1620")} 100%)`
    : `linear-gradient(160deg,${m(2, "#f8f9fd")} 0%,${m(5, "#eef1f8")} 55%,${m(11, "#f8f8fa")} 100%)`;
  return `--acc-ui:${gvAccent(c)};--g-bg-x:${bg};--acc-ui-x:color-mix(in srgb,var(--acc-ui) ${dark ? "80%,#fff" : "82%,#000"})`;
};
const GV_FIELDS = [
  { name: "nuance", selector: { select: { mode: "dropdown", options: [{ value: "theme", label: "Selon le thème (couleurs d'origine)" }, ...GV_NUANCES.map((n) => ({ value: n[0], label: n[1] })), { value: "perso", label: "Personnalisée" }] } } },
  { name: "nuance_perso", selector: { color_rgb: {} } },
  { name: "intensite", selector: { number: { min: 0, max: 2, step: 0.1, mode: "slider" } } }];
const GV_LABELS = { nuance: "Nuance de couleur", nuance_perso: "Couleur personnalisée (nuance « Personnalisée »)", intensite: "Intensité de la nuance" };
/* === FIN NUANCE COMMUNE === */

const DEFAULTS = {
  title: "",
  theme: "auto", nuance: "theme", intensite: 1, // auto | light | dark
  weather_entity: "",
  temperature_entity: "", // capteur de température à afficher à la place de celle de la météo (facultatif)
  condition_entity: "", // capteur de texte de condition (facultatif)
  alert_entity: "", // capteur d'alerte météo : affiché quand l'état n'est pas 0
  forecast_days: 5,
  show_forecast: true,
  metrics: [], // { entity, name, icon }
  risks: [], // { entity, name, yellow, red }
  infos: [], // { entity, name }
};

const COND = {
  "clear-night": ["Nuit dégagée", "mdi:weather-night"], cloudy: ["Nuageux", "mdi:weather-cloudy"], exceptional: ["Exceptionnel", "mdi:alert-circle-outline"],
  fog: ["Brouillard", "mdi:weather-fog"], hail: ["Grêle", "mdi:weather-hail"], lightning: ["Orageux", "mdi:weather-lightning"],
  "lightning-rainy": ["Orage et pluie", "mdi:weather-lightning-rainy"], partlycloudy: ["Éclaircies", "mdi:weather-partly-cloudy"],
  pouring: ["Fortes pluies", "mdi:weather-pouring"], rainy: ["Pluvieux", "mdi:weather-rainy"], snowy: ["Neigeux", "mdi:weather-snowy"],
  "snowy-rainy": ["Pluie et neige", "mdi:weather-snowy-rainy"], sunny: ["Ensoleillé", "mdi:weather-sunny"], windy: ["Venteux", "mdi:weather-windy"],
  "windy-variant": ["Venteux", "mdi:weather-windy-variant"],
};
const DC_ICON = {
  temperature: "mdi:thermometer", humidity: "mdi:water-percent", pressure: "mdi:gauge", wind_speed: "mdi:weather-windy", precipitation: "mdi:weather-rainy",
  illuminance: "mdi:brightness-5", irradiance: "mdi:solar-power", atmospheric_pressure: "mdi:gauge",
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isNum = (v) => v !== undefined && v !== null && v !== "" && !isNaN(Number(v));
const gone = (st) => !st || st.state === "unavailable" || st.state === "unknown";

// Scène animée de la condition actuelle
function sceneSvg(cond, night) {
  const sun = cond === "sunny" || cond === "windy" || cond === "partlycloudy";
  const moon = cond === "clear-night" || (night && cond === "partlycloudy");
  const cloud = ["cloudy", "partlycloudy", "rainy", "pouring", "snowy", "snowy-rainy", "lightning", "lightning-rainy", "hail", "fog", "windy-variant"].includes(cond);
  const rain = ["rainy", "pouring", "lightning-rainy", "snowy-rainy", "hail"].includes(cond);
  const snow = ["snowy", "snowy-rainy"].includes(cond);
  const bolt = ["lightning", "lightning-rainy"].includes(cond);
  const fog = cond === "fog";
  const showSun = sun && !night;
  const drops = rain ? [0, 1, 2, 3, 4].map((i) => `<line class="drop d${i}" x1="${26 + i * 9}" y1="52" x2="${23 + i * 9}" y2="60" stroke="#5ab4ff" stroke-width="2.4" stroke-linecap="round"/>`).join("") : "";
  const flakes = snow ? [0, 1, 2, 3].map((i) => `<circle class="flake f${i}" cx="${28 + i * 10}" cy="54" r="2.2" fill="#dff2ff"/>`).join("") : "";
  const cl = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="22" cy="38" r="10" class="cl"/><circle cx="34" cy="32" r="13" class="cl"/><circle cx="47" cy="39" r="9" class="cl"/><rect x="22" y="38" width="25" height="10" class="cl"/></g>`;
  return `
<svg viewBox="0 0 80 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="scene">
  ${showSun ? `<g class="sun" style="transform-origin:${cloud ? "26px 24px" : "40px 34px"}"><circle cx="${cloud ? 26 : 40}" cy="${cloud ? 24 : 34}" r="${cloud ? 10 : 14}" fill="#ffc83d"/>
    ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="${cloud ? 26 : 40}" y1="${(cloud ? 24 : 34) - (cloud ? 15 : 20)}" x2="${cloud ? 26 : 40}" y2="${(cloud ? 24 : 34) - (cloud ? 19 : 26)}" stroke="#ffc83d" stroke-width="2.6" stroke-linecap="round" transform="rotate(${a} ${cloud ? 26 : 40} ${cloud ? 24 : 34})"/>`).join("")}</g>` : ""}
  ${moon ? `<path class="moon" d="M${cloud ? 28 : 44} ${cloud ? 12 : 18} a${cloud ? 12 : 16} ${cloud ? 12 : 16} 0 1 0 ${cloud ? 14 : 18} ${cloud ? 16 : 20} a${cloud ? 10 : 13} ${cloud ? 10 : 13} 0 1 1 ${cloud ? -14 : -18} ${cloud ? -16 : -20}z" fill="#f3e7a6"/>` : ""}
  ${cloud ? `<g class="drift">${cl(cond === "cloudy" || rain || snow || bolt ? 4 : 10, cond === "cloudy" || rain || snow || bolt ? -4 : 0, 1)}</g>` : ""}
  ${drops}${flakes}
  ${bolt ? `<polygon class="bolt" points="38,40 30,56 37,56 33,68 47,50 40,50 45,40" fill="#ffd23d"/>` : ""}
  ${fog ? [0, 1, 2].map((i) => `<line class="fogl l${i}" x1="14" y1="${52 + i * 6}" x2="66" y2="${52 + i * 6}" stroke="var(--wx-muted)" stroke-width="3" stroke-linecap="round"/>`).join("") : ""}
</svg>`;
}

class WeatherOverviewCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("weather-overview-card-editor");
  }

  static getStubConfig(hass) {
    const w = Object.keys((hass && hass.states) || {}).find((e) => e.startsWith("weather.")) || "";
    return { ...DEFAULTS, weather_entity: w };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._sig = "";
    this._fc = null;
    this._fcAt = 0;
    this._loading = false;
  }

  setConfig(config) {
    if (!config) throw new Error("Configuration invalide");
    this._config = { ...DEFAULTS, ...config };
    ["metrics", "risks", "infos"].forEach((k) => { if (!Array.isArray(this._config[k])) this._config[k] = []; });
    this._fc = null; this._fcAt = 0; this._sig = "";
    if (this._hass) { this._render(); this._loadForecast(); }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const sig = this._ids().map((e) => { const s = hass.states[e]; return s ? s.state + (e === this._config.weather_entity ? JSON.stringify(s.attributes.temperature) : "") : "x"; }).join("|")
      + "#" + (this._isDark() ? "d" : "l") + "#" + (this._night() ? "n" : "j");
    if (sig !== this._sig) { this._sig = sig; this._render(); }
    if (this._config.show_forecast && Date.now() - this._fcAt > 30 * 60 * 1000) this._loadForecast();
  }

  getCardSize() { return 8; }

  _ids() {
    const c = this._config;
    return [c.weather_entity, c.temperature_entity, c.condition_entity, c.alert_entity, "sun.sun",
      ...c.metrics.map((m) => m.entity), ...c.risks.map((m) => m.entity), ...c.infos.map((m) => m.entity)].filter(Boolean);
  }

  _isDark() {
    const t = this._config && this._config.theme;
    if (t === "dark") return true;
    if (t === "light") return false;
    const dm = this._hass && this._hass.themes && this._hass.themes.darkMode;
    if (typeof dm === "boolean") return dm;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  _night() {
    const s = this._hass && this._hass.states["sun.sun"];
    return !!s && s.state === "below_horizon";
  }

  _lang() { return (this._hass && this._hass.locale && this._hass.locale.language) || "fr"; }

  _fmt(n, d) {
    return new Intl.NumberFormat(this._lang(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n));
  }

  _more(id) {
    if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: id } }));
  }

  async _loadForecast() {
    const c = this._config;
    if (this._loading || !c.show_forecast || !c.weather_entity || !this._hass || !this._hass.callWS) return;
    this._loading = true;
    this._fcAt = Date.now();
    try {
      const res = await this._hass.callWS({
        type: "call_service", domain: "weather", service: "get_forecasts",
        service_data: { type: "daily" }, target: { entity_id: c.weather_entity }, return_response: true,
      });
      const r = res && (res.response || res);
      const f = r && r[c.weather_entity] && r[c.weather_entity].forecast;
      if (Array.isArray(f)) { this._fc = f; this._sig = ""; this._render(); }
    } catch (e) {
      this._fcAt = Date.now() - 25 * 60 * 1000; // nouvel essai dans ~5 min
    } finally {
      this._loading = false;
    }
  }

  _val(item) {
    const s = this._hass.states[item.entity];
    if (gone(s)) return "—";
    if (!isNum(s.state)) return String(s.state);
    const u = s.attributes.unit_of_measurement || "";
    return this._fmt(s.state, Number.isInteger(Number(s.state)) ? 0 : 1) + (u ? " " + u : "");
  }

  _render() {
    const c = this._config, h = this._hass;
    if (!c || !h) return;
    const dark = this._isDark();
    const ws = h.states[c.weather_entity];
    const wa = (ws && ws.attributes) || {};
    const night = this._night();
    const cond = ws && !gone(ws) ? ws.state : "";
    const name = c.title || wa.friendly_name || "Météo";
    const tU = (h.config && h.config.unit_system && h.config.unit_system.temperature) || "°C";
    let temp = wa.temperature;
    if (c.temperature_entity) { const ts = h.states[c.temperature_entity]; if (ts && isNum(ts.state)) temp = ts.state; }
    const label = (c.condition_entity && !gone(h.states[c.condition_entity])) ? h.states[c.condition_entity].state : (COND[cond] ? COND[cond][0] : cond || "Indisponible");

    // alerte
    const as = c.alert_entity ? h.states[c.alert_entity] : null;
    const alert = as && !gone(as) && String(as.state) !== "0" && String(as.state).toLowerCase() !== "none" && as.state !== "off"
      ? `<button class="alert" data-more="${esc(c.alert_entity)}"><ha-icon icon="mdi:alert"></ha-icon><span><b>Alerte météo</b><small>${esc(isNum(as.state) ? "Niveau " + as.state : as.state)}</small></span></button>` : "";

    // prévisions
    let fcHtml = "";
    if (c.show_forecast) {
      const raw = this._fc || (Array.isArray(wa.forecast) ? wa.forecast : []);
      const days = raw.slice(0, Math.max(1, Math.min(7, Number(c.forecast_days) || 5)));
      const wd = new Intl.DateTimeFormat(this._lang(), { weekday: "short" });
      fcHtml = days.length ? `<div class="fc">${days.map((d, i) => {
        const dt = new Date(d.datetime);
        const day = i === 0 && dt.toDateString() === new Date().toDateString() ? "Auj." : wd.format(dt).replace(".", "");
        const ic = (COND[d.condition] || ["", "mdi:weather-partly-cloudy"])[1];
        const hi = isNum(d.temperature) ? Math.round(d.temperature) + "°" : "—";
        const lo = isNum(d.templow) ? Math.round(d.templow) + "°" : "";
        const pp = isNum(d.precipitation_probability) ? d.precipitation_probability : (isNum(d.precipitation) && Number(d.precipitation) > 0 ? null : null);
        return `<div class="fd" title="${esc((COND[d.condition] || [d.condition || ""])[0])}"><span class="dn">${esc(day)}</span><ha-icon icon="${ic}"></ha-icon>
          <span class="hi">${hi}</span><span class="lo">${lo}</span>${pp !== null && Number(pp) > 0 ? `<span class="pp"><ha-icon icon="mdi:water"></ha-icon>${Math.round(pp)}%</span>` : `<span class="pp"></span>`}</div>`;
      }).join("")}</div>` : "";
    }

    const tiles = c.metrics.filter((m) => m.entity).map((m) => {
      const s = h.states[m.entity];
      const icon = m.icon || (s && (s.attributes.icon || DC_ICON[s.attributes.device_class])) || "mdi:information-outline";
      const lab = m.name || (s && s.attributes.friendly_name) || m.entity;
      return `<button class="tile" data-more="${esc(m.entity)}"><ha-icon icon="${esc(icon)}"></ha-icon><span class="tv">${esc(this._val(m))}</span><span class="tl">${esc(lab)}</span></button>`;
    }).join("");

    const risks = c.risks.filter((r) => r.entity).map((r) => {
      const s = h.states[r.entity];
      const v = !gone(s) && isNum(s.state) ? Number(s.state) : null;
      const y = isNum(r.yellow) ? Number(r.yellow) : 40, rd = isNum(r.red) ? Number(r.red) : 70;
      const tone = v === null ? "na" : v >= rd ? "err" : v >= y ? "warn" : "ok";
      const lab = r.name || (s && s.attributes.friendly_name) || r.entity;
      return `<button class="risk ${tone}" data-more="${esc(r.entity)}"><span class="rl"><span>${esc(lab)}</span><b>${v === null ? "—" : Math.round(v) + " %"}</b></span><i class="bar"><u style="width:${v === null ? 0 : Math.max(0, Math.min(100, v))}%"></u></i></button>`;
    }).join("");

    const infos = c.infos.filter((i) => i.entity).map((i) => {
      const s = h.states[i.entity];
      const lab = i.name || (s && s.attributes.friendly_name) || i.entity;
      let v = this._val(i);
      if (s && s.attributes.device_class === "timestamp" && !gone(s)) {
        const d = new Date(s.state);
        if (!isNaN(d)) v = new Intl.DateTimeFormat(this._lang(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
      }
      return `<button class="inf" data-more="${esc(i.entity)}"><span>${esc(lab)}</span><b>${esc(v)}</b></button>`;
    }).join("");

    this.shadowRoot.innerHTML = `
      <style>
        * { box-sizing:border-box; }
        ha-card.dark {
          --wx-text:#f4f6fb; --wx-muted:#a9afc0; --wx-bg:var(--g-bg-x,linear-gradient(160deg,#1b1e32 0%,#241a2a 55%,#2d1519 100%));
          --wx-border:rgba(255,255,255,.14); --wx-shadow:0 .6em 2em rgba(0,0,0,.35);
          --wx-glass:rgba(255,255,255,.07); --wx-glass-b:rgba(255,255,255,.13); --wx-fill:rgba(255,255,255,.09); --wx-fill-b:rgba(255,255,255,.16);
          --wx-ok:#3ddc84; --wx-warn:#ffb86b; --wx-err:#ff5a5f; --wx-cloud:#d7deee; --wx-acc:var(--acc-ui-x,#5ab4ff);
        }
        ha-card.light {
          --wx-text:#1c2030; --wx-muted:#5d6477; --wx-bg:var(--g-bg-x,linear-gradient(160deg,#f8f9fd 0%,#eef1f8 55%,#f8eff0 100%));
          --wx-border:rgba(20,24,40,.12); --wx-shadow:0 .4em 1.4em rgba(20,24,40,.12);
          --wx-glass:rgba(255,255,255,.7); --wx-glass-b:rgba(20,24,40,.1); --wx-fill:rgba(20,24,40,.06); --wx-fill-b:rgba(20,24,40,.14);
          --wx-ok:#1a9d55; --wx-warn:#c77a14; --wx-err:#d32f35; --wx-cloud:#b9c3d9; --wx-acc:var(--acc-ui-x,#1a76d2);
        }
        ha-card { container-type:inline-size; display:flex; flex-direction:column; gap:12px; padding:16px; overflow:hidden; color:var(--wx-text);
          border-radius:24px; border:1px solid var(--wx-border); background:var(--wx-bg); box-shadow:var(--wx-shadow); }
        ha-icon { --mdc-icon-size:1.25em; flex:none; }
        button { font:inherit; color:inherit; cursor:pointer; border:0; background:none; padding:0; text-align:left; -webkit-tap-highlight-color:transparent; }
        .glass { background:var(--wx-glass); border:1px solid var(--wx-glass-b); -webkit-backdrop-filter:blur(18px) saturate(140%); backdrop-filter:blur(18px) saturate(140%); }
        .now { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px; border-radius:20px; }
        .now .nm { font-size:.9em; color:var(--wx-muted); font-weight:600; }
        .now .t { font-size:3.2em; font-weight:750; line-height:1; margin:.1em 0; font-variant-numeric:tabular-nums; }
        .now .t small { font-size:.4em; font-weight:600; color:var(--wx-muted); margin-left:.1em; }
        .now .cd { font-size:1em; font-weight:650; }
        .scene { width:6.5em; height:auto; flex:none; }
        .scene .cl { fill:var(--wx-cloud); }
        .sun { animation:wx-spin 24s linear infinite; } @keyframes wx-spin { to { transform:rotate(360deg); } }
        .drift { animation:wx-drift 6s ease-in-out infinite alternate; } @keyframes wx-drift { to { transform:translateX(4px); } }
        .drop { animation:wx-drop 1s linear infinite; } .d1 { animation-delay:.2s; } .d2 { animation-delay:.4s; } .d3 { animation-delay:.6s; } .d4 { animation-delay:.8s; }
        @keyframes wx-drop { 0% { transform:translateY(-4px); opacity:0; } 30% { opacity:1; } 100% { transform:translateY(8px); opacity:0; } }
        .flake { animation:wx-snow 2s linear infinite; } .f1 { animation-delay:.5s; } .f2 { animation-delay:1s; } .f3 { animation-delay:1.5s; }
        @keyframes wx-snow { 0% { transform:translateY(-4px); opacity:0; } 30% { opacity:1; } 100% { transform:translateY(10px); opacity:0; } }
        .bolt { animation:wx-bolt 2.2s ease-in-out infinite; } @keyframes wx-bolt { 0%,60%,100% { opacity:.25; } 65%,75% { opacity:1; } }
        .fogl { animation:wx-fog 4s ease-in-out infinite alternate; } .l1 { animation-delay:1s; } .l2 { animation-delay:2s; } @keyframes wx-fog { to { transform:translateX(5px); } }
        .alert { display:flex; align-items:center; gap:.7em; padding:.7em .9em; border-radius:1em; background:color-mix(in srgb, var(--wx-err) 16%, transparent); border:1px solid var(--wx-err); color:var(--wx-err); }
        .alert span { display:flex; flex-direction:column; } .alert b { font-size:.9em; } .alert small { font-size:.76em; opacity:.9; }
        .fc { display:grid; grid-template-columns:repeat(auto-fit,minmax(3.6em,1fr)); gap:6px; padding:10px; border-radius:18px; background:var(--wx-glass); border:1px solid var(--wx-glass-b); }
        .fd { display:flex; flex-direction:column; align-items:center; gap:.25em; padding:.3em .1em; }
        .fd .dn { font-size:.76em; font-weight:650; color:var(--wx-muted); text-transform:capitalize; }
        .fd ha-icon { --mdc-icon-size:1.9em; color:var(--wx-acc); }
        .fd .hi { font-size:.98em; font-weight:700; } .fd .lo { font-size:.8em; color:var(--wx-muted); min-height:1.1em; }
        .fd .pp { font-size:.7em; color:var(--wx-acc); display:flex; align-items:center; gap:.1em; min-height:1.2em; } .fd .pp ha-icon { --mdc-icon-size:1.2em; }
        .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(5.6em,1fr)); gap:8px; }
        .tile { display:flex; flex-direction:column; align-items:center; gap:.2em; padding:.7em .3em; border-radius:1em; text-align:center; min-width:0;
          background:var(--wx-glass); border:1px solid var(--wx-glass-b); }
        .tile ha-icon { color:var(--wx-acc); --mdc-icon-size:1.45em; }
        .tile .tv { font-size:1.02em; font-weight:700; font-variant-numeric:tabular-nums; } .tile .tl { font-size:.7em; color:var(--wx-muted); }
        .risks { display:grid; grid-template-columns:repeat(auto-fit,minmax(8em,1fr)); gap:8px; }
        .risk { display:flex; flex-direction:column; gap:.4em; padding:.6em .75em; border-radius:1em; background:var(--wx-glass); border:1px solid var(--wx-glass-b); }
        .rl { display:flex; justify-content:space-between; font-size:.76em; color:var(--wx-muted); } .rl b { color:var(--wx-text); }
        .bar { display:block; height:.45em; border-radius:.3em; background:var(--wx-fill-b); overflow:hidden; }
        .bar u { display:block; height:100%; border-radius:inherit; background:var(--wx-ok); text-decoration:none; transition:width .4s; }
        .risk.warn .bar u { background:var(--wx-warn); } .risk.err .bar u { background:var(--wx-err); } .risk.na .bar u { background:transparent; }
        .infos { display:flex; flex-direction:column; border-radius:18px; padding:2px 12px; background:var(--wx-glass); border:1px solid var(--wx-glass-b); }
        .inf { display:flex; justify-content:space-between; gap:10px; padding:.6em 0; font-size:.86em; border-top:1px solid var(--wx-glass-b); width:100%; }
        .inf:first-child { border-top:0; } .inf span { color:var(--wx-muted); } .inf b { text-align:right; }
        @media (prefers-reduced-motion: reduce) { .sun, .drift, .drop, .flake, .bolt, .fogl { animation:none; } }
      </style>
      <ha-card class="${dark ? "dark" : "light"}" style="${gvStyle(this._config, dark)}">
        <div class="now glass">
          <div><div class="nm">${esc(name)}</div>
            <button class="t" data-more="${esc(c.temperature_entity || c.weather_entity)}">${isNum(temp) ? this._fmt(temp, 1) : "—"}<small>${esc(tU)}</small></button>
            <div class="cd">${esc(label)}</div></div>
          ${sceneSvg(cond, night)}
        </div>
        ${alert}
        ${fcHtml}
        ${tiles ? `<div class="tiles">${tiles}</div>` : ""}
        ${risks ? `<div class="risks">${risks}</div>` : ""}
        ${infos ? `<div class="infos">${infos}</div>` : ""}
      </ha-card>`;

    this.shadowRoot.querySelectorAll("[data-more]").forEach((el) => el.addEventListener("click", () => this._more(el.dataset.more)));
  }
}

/* ---------- Éditeur visuel ---------- */
const LABELS = { ...GV_LABELS,
  title: "Titre (nom du lieu, facultatif)", theme: "Thème", weather_entity: "Entité météo (weather)", temperature_entity: "Capteur de température (facultatif)",
  condition_entity: "Capteur de condition en texte (facultatif)", alert_entity: "Capteur d'alerte météo (affiché si différent de 0)",
  forecast_days: "Jours de prévision (1 à 7)", show_forecast: "Afficher les prévisions",
  entity: "Entité", name: "Nom (facultatif)", icon: "Icône", yellow: "Orange à partir de (%)", red: "Rouge à partir de (%)",
};
const MAIN_SCHEMA = [
  { name: "weather_entity", required: true, selector: { entity: { domain: "weather" } } },
  { name: "title", selector: { text: {} } },
  { type: "grid", name: "", schema: [
    { name: "theme", selector: { select: { mode: "dropdown", options: [
      { value: "auto", label: "Automatique (thème de Home Assistant)" }, { value: "light", label: "Clair" }, { value: "dark", label: "Sombre" } ] } } }, ...GV_FIELDS,
    { name: "forecast_days", selector: { number: { min: 1, max: 7, mode: "box" } } },
  ] },
  { name: "show_forecast", selector: { boolean: {} } },
  { type: "expandable", title: "Capteurs facultatifs", name: "", schema: [
    { name: "temperature_entity", selector: { entity: { domain: "sensor" } } },
    { name: "condition_entity", selector: { entity: { domain: "sensor" } } },
    { name: "alert_entity", selector: { entity: { domain: "sensor" } } },
  ] },
];
const LISTS = [
  { key: "metrics", title: "Mesures (humidité, vent, UV…)", one: "Mesure", add: "+ Ajouter une mesure",
    schema: [{ name: "entity", selector: { entity: { domain: "sensor" } } }, { type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "icon", selector: { icon: {} } }] }] },
  { key: "risks", title: "Risques en % (pluie, gel, neige…)", one: "Risque", add: "+ Ajouter un risque",
    schema: [{ name: "entity", selector: { entity: { domain: "sensor" } } }, { name: "name", selector: { text: {} } },
      { type: "grid", name: "", schema: [{ name: "yellow", selector: { number: { min: 0, max: 100, mode: "box" } } }, { name: "red", selector: { number: { min: 0, max: 100, mode: "box" } } }] }] },
  { key: "infos", title: "Informations (lignes de texte)", one: "Information", add: "+ Ajouter une information",
    schema: [{ name: "entity", selector: { entity: {} } }, { name: "name", selector: { text: {} } }] },
];

class WeatherOverviewCardEditor extends HTMLElement {
  _sig(c) { return LISTS.map((l) => c[l.key].length).join(","); }

  setConfig(config) {
    const next = { ...DEFAULTS, ...config };
    LISTS.forEach((l) => { next[l.key] = (config[l.key] || []).map((x) => ({ ...x })); });
    const same = this._config && this._built && this._sig(next) === this._sig(this._config);
    this._config = next;
    if (!same) return this._build();
    this._forms.forEach((f) => { f.el.data = f.get(this._config); });
  }

  set hass(hass) {
    this._hass = hass;
    (this._forms || []).forEach((f) => (f.el.hass = hass));
  }

  _emit() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
  }

  _form(schema, get, set, parent) {
    const el = document.createElement("ha-form");
    el.hass = this._hass;
    el.data = get(this._config);
    el.computeLabel = (s) => LABELS[s.name] || s.name;
    el.schema = schema;
    el.addEventListener("value-changed", (ev) => { ev.stopPropagation(); set(this._config, ev.detail.value); this._emit(); });
    this._forms.push({ el, get });
    parent.appendChild(el);
  }

  _build() {
    this._built = true;
    this._forms = [];
    this.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = `.bx{border:1px solid var(--divider-color);border-radius:12px;padding:10px;margin:12px 0}
      .h{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-weight:600}
      .bx button,.add{cursor:pointer;border:1px solid var(--divider-color);background:var(--secondary-background-color);color:var(--primary-text-color);border-radius:8px;padding:6px 10px}
      .add{width:100%;margin:4px 0 12px}`;
    this.appendChild(style);
    const keep = () => { const k = {}; LISTS.forEach((l) => { k[l.key] = this._config[l.key]; }); return k; };
    this._form(MAIN_SCHEMA, (c) => c, (c, v) => { const k = keep(); Object.assign(c, v, k); }, this);

    LISTS.forEach((l) => {
      const t = document.createElement("h3"); t.textContent = l.title; this.appendChild(t);
      this._config[l.key].forEach((item, i) => {
        const box = document.createElement("div");
        box.className = "bx";
        box.innerHTML = `<div class="h"><span>${l.one} ${i + 1}</span><span><button data-k="${l.key}" data-a="up" data-i="${i}">↑</button> <button data-k="${l.key}" data-a="down" data-i="${i}">↓</button> <button data-k="${l.key}" data-a="del" data-i="${i}">✕</button></span></div>`;
        this._form(l.schema, (c) => c[l.key][i], (c, v) => { c[l.key][i] = { ...v }; }, box);
        this.appendChild(box);
      });
      const add = document.createElement("button");
      add.className = "add"; add.textContent = l.add; add.dataset.add = l.key;
      this.appendChild(add);
    });
    this.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => this._click(b)));
  }

  _click(b) {
    const d = b.dataset, cfg = this._config;
    if (d.add) cfg[d.add].push({ entity: "" });
    else if (d.a) {
      const arr = cfg[d.k], i = Number(d.i);
      if (d.a === "del") arr.splice(i, 1);
      else { const j = i + (d.a === "up" ? -1 : 1); if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]]; }
    } else return;
    this._emit();
    this._build();
  }
}

customElements.define("weather-overview-card", WeatherOverviewCard);
customElements.define("weather-overview-card-editor", WeatherOverviewCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "weather-overview-card",
  name: "Weather Overview Card (FR)",
  description: "Météo : icône animée, alerte, prévisions, mesures, risques (pluie, gel, neige) et informations.",
  preview: true,
});

console.info(
  `%c WEATHER-OVERVIEW-CARD %c v${CARD_VERSION} `,
  "color:#fff;background:#1a76d2;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px",
  "color:#1a76d2;background:#fff;font-weight:700;border-radius:0 3px 3px 0;padding:2px 4px"
);
}
