// Gym Heatmap for Scriptable
// Logs gym visits and shows a GitHub-style heatmap widget.
//
//  - Shortcuts automation runs this script         -> logs today ("remove" in Texts removes today)
//  - As a widget                                   -> shows the heatmap
//  - Opened in Scriptable (or tap the widget)      -> interactive full-year view

const FILE_NAME = "gym-visits.json";
const COLORS = {
  bg: new Color("#0d1117"),
  empty: new Color("#21262d"),
  visit: new Color("#39d353"),
  todayOutline: new Color("#8b949e"),
  future: new Color("#161b22"),
  missed: new Color("#f85149", 0.5),
  divider: new Color("#ffffff", 0.2),
  text: new Color("#e6edf3"),
  sub: new Color("#8b949e"),
};

// ---------- storage ----------
let fm;
try {
  fm = FileManager.iCloud();
  fm.documentsDirectory();
} catch (e) {
  fm = FileManager.local();
}
const path = fm.joinPath(fm.documentsDirectory(), FILE_NAME);

async function loadVisits() {
  if (!fm.fileExists(path)) return new Set();
  try {
    if (fm.isFileStoredIniCloud(path)) await fm.downloadFileFromiCloud(path);
  } catch (e) {}
  try {
    return new Set(JSON.parse(fm.readString(path)));
  } catch (e) {
    return new Set();
  }
}

function saveVisits(visits) {
  fm.writeString(path, JSON.stringify([...visits].sort()));
}

// Days you set by hand: "missed" (always red) and "rest" (never red).
const statusPath = fm.joinPath(fm.documentsDirectory(), "gym-status.json");
let STATUS = { missed: [], rest: [] };

async function loadStatus() {
  if (!fm.fileExists(statusPath)) return;
  try {
    if (fm.isFileStoredIniCloud(statusPath)) await fm.downloadFileFromiCloud(statusPath);
  } catch (e) {}
  try {
    const s = JSON.parse(fm.readString(statusPath));
    STATUS = { missed: s.missed || [], rest: s.rest || [] };
  } catch (e) {}
}

function saveStatus() {
  fm.writeString(statusPath, JSON.stringify({
    missed: [...new Set(STATUS.missed)].sort(),
    rest: [...new Set(STATUS.rest)].sort(),
  }));
}

// ---------- dates ----------
function key(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function mondayOf(d) {
  return addDays(d, -((d.getDay() + 6) % 7)); // weeks start on Monday
}

const today = new Date();
const todayKey = key(today);

// ---------- widget ----------
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function stats(visits) {
  const all = [...visits].filter(k => k <= todayKey).sort();
  const weekStart = key(mondayOf(today));
  const monthPrefix = todayKey.slice(0, 7);
  const yearAgo = key(addDays(today, -365));

  // Consecutive weeks with at least one visit (this week doesn't break it yet)
  const hasVisit = ws => {
    for (let i = 0; i < 7; i++) if (visits.has(key(addDays(ws, i)))) return true;
    return false;
  };
  let ws = mondayOf(today), streak = 0;
  if (!hasVisit(ws)) ws = addDays(ws, -7);
  while (hasVisit(ws)) { streak++; ws = addDays(ws, -7); }

  let lastText = "No visits yet";
  if (all.length) {
    const p = all[all.length - 1].split("-");
    const last = new Date(+p[0], +p[1] - 1, +p[2]);
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const days = Math.round((t0 - last) / 86400000);
    lastText = days === 0 ? "Trained today 💪" : days === 1 ? "Last: yesterday" : `Last: ${days} days ago`;
  }

  return {
    week: all.filter(k => k >= weekStart).length,
    month: all.filter(k => k.startsWith(monthPrefix)).length,
    year: all.filter(k => k > yearAgo).length,
    total: all.length,
    streak,
    lastText,
  };
}

// Missed days: from the MISSED_DAYS-th day in a row without the gym onward
// (the same days that trigger a reminder). Today is never marked as missed.
function missedDays(visits) {
  const missed = new Set();
  const rest = new Set(STATUS.rest);
  const past = [...visits].filter(k => k <= todayKey).sort();
  if (past.length) {
    const p = past[0].split("-");
    let d = new Date(+p[0], +p[1] - 1, +p[2]);
    let gap = 0;
    while (key(d) < todayKey) {
      const k = key(d);
      if (visits.has(k)) gap = 0;
      else if (!rest.has(k) && ++gap >= MISSED_DAYS) missed.add(k);
      d = addDays(d, 1);
    }
  }
  STATUS.missed.forEach(k => { if (k <= todayKey && !visits.has(k)) missed.add(k); });
  return missed;
}

// Draws the heatmap to exactly fit `width` points.
function drawGrid(visits, width, step, opts) {
  const gap = Math.max(2, Math.round(step * 0.22));
  const cell = step - gap;
  const left = opts.dayLabels ? 13 : 0;
  const top = opts.monthLabels ? 13 : 0;
  const weeks = Math.max(4, Math.floor((width - left + gap) / step));
  const gridW = weeks * step - gap;

  const ctx = new DrawContext();
  ctx.size = new Size(left + gridW, top + 7 * step - gap);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  // Start at the week containing the 1st of last month; the rest is upcoming days.
  const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const start = mondayOf(firstOfLastMonth);
  const labelFont = Font.mediumSystemFont(9);

  if (opts.dayLabels) {
    ctx.setFont(labelFont);
    ctx.setTextColor(COLORS.sub);
    ["M", "T", "W", "T", "F", "S", "S"].forEach((t, r) =>
      ctx.drawText(t, new Point(0, top + r * step + (cell - 11) / 2)));
  }

  // Find where each month starts (column + row of its 1st day)
  const starts = [];
  for (let c = 0; c < weeks; c++) {
    for (let r = 0; r < 7; r++) {
      const d = addDays(start, c * 7 + r);
      if (d.getDate() === 1) starts.push({ c, r, m: d.getMonth() });
    }
  }

  if (opts.monthLabels) {
    ctx.setFont(labelFont);
    ctx.setTextColor(COLORS.sub);
    let lastX = -100;
    starts.forEach(({ c, r, m }) => {
      const col = r === 0 ? c : c + 1; // first full week of the month
      const x = left + col * step;
      if (x - lastX >= 22 && x + 18 <= left + gridW + 4) {
        ctx.drawText(MONTHS[m], new Point(x, 0));
        lastX = x;
      }
    });
  }

  const radius = Math.max(2, cell * 0.25);
  const missed = missedDays(visits);
  for (let c = 0; c < weeks; c++) {
    for (let r = 0; r < 7; r++) {
      const d = addDays(start, c * 7 + r);
      const k = key(d);
      const p = new Path();
      p.addRoundedRect(new Rect(left + c * step, top + r * step, cell, cell), radius, radius);
      ctx.addPath(p);
      if (d > today) {
        ctx.setFillColor(COLORS.future);
        ctx.fillPath();
        continue;
      }
      ctx.setFillColor(visits.has(k) ? COLORS.visit : missed.has(k) ? COLORS.missed : COLORS.empty);
      ctx.fillPath();
      if (k === todayKey && !visits.has(k)) {
        ctx.addPath(p);
        ctx.setStrokeColor(COLORS.todayOutline);
        ctx.setLineWidth(1.5);
        ctx.strokePath();
      }
    }
  }

  // Thin pink line between months
  const y0 = top - 1, y7 = top + 7 * step - gap + 1;
  starts.forEach(({ c, r }) => {
    if (c === 0 && r === 0) return;
    const xB = left + c * step - gap / 2;       // left of the 1st's column
    const xA = left + (c + 1) * step - gap / 2; // right of the 1st's column
    const yR = top + r * step - gap / 2;        // just above the 1st
    const p = new Path();
    if (r === 0) {
      p.move(new Point(xB, y0));
      p.addLine(new Point(xB, y7));
    } else {
      p.move(new Point(xA, y0));
      p.addLine(new Point(xA, yR));
      p.addLine(new Point(xB, yR));
      p.addLine(new Point(xB, y7));
    }
    ctx.addPath(p);
    ctx.setStrokeColor(COLORS.divider);
    ctx.setLineWidth(1);
    ctx.strokePath();
  });
  return ctx.getImage();
}

// ---------- Lock Screen drawing ----------
// Lock Screen widgets are shown in one tint color, so shades are done with opacity.
function drawMiniGrid(alphaFor, weeks, step) {
  const gap = 2, cell = step - gap;
  const ctx = new DrawContext();
  ctx.size = new Size(weeks * step - gap, 7 * step - gap);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const start = addDays(mondayOf(today), -(weeks - 1) * 7);
  for (let c = 0; c < weeks; c++) {
    for (let r = 0; r < 7; r++) {
      const d = addDays(start, c * 7 + r);
      if (d > today) continue;
      const k = key(d);
      const p = new Path();
      p.addRoundedRect(new Rect(c * step, r * step, cell, cell), 1.5, 1.5);
      ctx.addPath(p);
      ctx.setFillColor(new Color("#ffffff", alphaFor(k)));
      ctx.fillPath();
      if (k === todayKey) {
        ctx.addPath(p);
        ctx.setStrokeColor(Color.white());
        ctx.setLineWidth(1);
        ctx.strokePath();
      }
    }
  }
  return ctx.getImage();
}

function drawRing(value, size) {
  const lw = 5, rr = size / 2 - lw / 2 - 1, cx = size / 2, cy = size / 2;
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const arc = (from, to, color) => {
    const p = new Path();
    const steps = Math.max(2, Math.ceil((to - from) * 60));
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + 2 * Math.PI * (from + (to - from) * (i / steps));
      const pt = new Point(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
      if (i === 0) p.move(pt); else p.addLine(pt);
    }
    ctx.addPath(p);
    ctx.setStrokeColor(color);
    ctx.setLineWidth(lw);
    ctx.strokePath();
  };
  arc(0, 1, new Color("#ffffff", 0.25));
  const v = Math.max(0, Math.min(1, value));
  if (v > 0) arc(0, v, Color.white());
  return ctx.getImage();
}

function ringWidget(w, value, big, small) {
  w.addAccessoryWidgetBackground = true;
  w.backgroundImage = drawRing(value, 64);
  w.setPadding(0, 0, 0, 0);
  const v = w.addStack();
  v.layoutVertically();
  v.centerAlignContent();
  const row1 = v.addStack(); row1.addSpacer();
  const a = row1.addText(big); a.font = Font.boldRoundedSystemFont(17); a.lineLimit = 1; a.minimumScaleFactor = 0.6;
  row1.addSpacer();
  const row2 = v.addStack(); row2.addSpacer();
  const b = row2.addText(small); b.font = Font.mediumSystemFont(9); b.lineLimit = 1;
  row2.addSpacer();
  return w;
}

function widgetWidth(family) {
  const s = Device.screenSize().width;
  if (family === "small") return Math.round(s * 0.4);
  return Math.min(364, Math.round(s * 0.865));
}

function addText(stack, text, font, color) {
  const t = stack.addText(text);
  t.font = font;
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

function buildWidget(visits, family) {
  const s = stats(visits);
  const w = new ListWidget();
  w.url = URLScheme.forRunningScript();

  // Refresh just after midnight so the new day shows up
  const tomorrow = addDays(today, 1);
  w.refreshAfterDate = new Date(tomorrow.getTime() + 60 * 1000);

  // ----- Lock Screen widgets -----
  if (family === "accessoryInline") {
    w.addText(`🏋️ ${s.week}/${WEEKLY_GOAL} this week · 🔥 ${s.streak}`);
    return w;
  }
  if (family === "accessoryCircular") {
    return ringWidget(w, s.week / WEEKLY_GOAL, `${s.week}/${WEEKLY_GOAL}`, "week");
  }
  if (family === "accessoryRectangular") {
    w.setPadding(2, 2, 2, 2);
    const t = w.addText(`🏋️ ${s.week} this week · 🔥 ${s.streak}`);
    t.font = Font.boldSystemFont(11);
    t.lineLimit = 1;
    t.minimumScaleFactor = 0.7;
    w.addSpacer(3);
    const missed = missedDays(visits);
    const grid = drawMiniGrid(k => visits.has(k) ? 1 : missed.has(k) ? 0.5 : 0.2, 16, 8);
    const img = w.addImage(grid);
    img.imageSize = grid.size;
    return w;
  }

  // ----- Home Screen widgets -----
  const small = family === "small";
  const large = family === "large" || family === "extraLarge";
  const padH = 14;
  const contentW = widgetWidth(family) - padH * 2;

  w.backgroundColor = COLORS.bg;
  w.setPadding(12, padH, 12, padH);

  const header = w.addStack();
  header.centerAlignContent();
  addText(header, "🏋️ Gym", Font.boldSystemFont(14), COLORS.text);
  header.addSpacer();
  addText(header,
    small ? `🔥 ${s.streak}` : `🔥 ${s.streak} wk streak · ${s.week} this week`,
    Font.mediumSystemFont(11), COLORS.sub);

  w.addSpacer(small ? 6 : 8);

  // Size the squares so the grid fits the widget's height
  const widgetH = small ? widgetWidth(family) : Math.round(widgetWidth(family) * (large ? 1.05 : 0.47));
  const reserved = 24 + 17 + 8 + (large ? 90 : 18) + 13; // padding, header, spacing, footer, month labels
  const step = Math.max(9, Math.min(large ? 21 : 16, Math.floor((widgetH - reserved + 3) / 7)));
  const gridImg = drawGrid(visits, contentW, step, { dayLabels: !small, monthLabels: true });
  const img = w.addImage(gridImg);
  img.imageSize = gridImg.size;
  img.centerAlignImage();

  if (small) {
    w.addSpacer();
    addText(w, `${s.week} this week · ${s.month} mo`, Font.systemFont(10), COLORS.sub);
  } else if (large) {
    w.addSpacer(14);
    const row = w.addStack();
    [[s.week, "this week"], [s.month, "this month"], [s.year, "12 months"]].forEach(([n, label], i) => {
      if (i > 0) row.addSpacer();
      const col = row.addStack();
      col.layoutVertically();
      addText(col, String(n), Font.boldRoundedSystemFont(22), COLORS.text);
      addText(col, label, Font.systemFont(11), COLORS.sub);
    });
    w.addSpacer();
    addText(w, s.lastText, Font.mediumSystemFont(12), COLORS.sub);
  } else {
    w.addSpacer();
    const f = w.addStack();
    addText(f, s.lastText, Font.systemFont(11), COLORS.sub);
    f.addSpacer();
    addText(f, `${s.month} this month · ${s.total} total`, Font.systemFont(11), COLORS.sub);
  }
  return w;
}

// ---------- interactive view ----------
const PAGE = `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { --bg:#0d1117; --card:#161b22; --empty:#21262d; --visit:#39d353; --text:#e6edf3; --sub:#8b949e; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html, body { margin:0; background:var(--bg); color:var(--text);
         font-family:-apple-system, system-ui, sans-serif; -webkit-user-select:none; }
  .top { padding:20px 16px 0; }
  h1 { font-size:26px; margin:0 0 14px; }
  .stats { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:14px; }
  .stat { background:var(--card); border-radius:14px; padding:12px 14px; }
  .stat b { display:block; font-size:24px; }
  .stat span { color:var(--sub); font-size:13px; }

  .row { display:grid; grid-template-columns:44px repeat(7, 1fr); gap:5px; padding:0 16px; }
  .head { position:sticky; top:0; z-index:2; background:var(--bg);
          padding-top:10px; padding-bottom:8px; border-bottom:1px solid #21262d; }
  .head div { text-align:center; font-size:12px; font-weight:600; color:var(--sub); }
  .weeks { padding-top:6px; }
  .weeks .row { margin-bottom:5px; }
  .month { font-size:12px; font-weight:600; color:var(--sub); align-self:center; line-height:1.1; }
  .row.newmonth { border-top:1px solid #21262d; padding-top:6px; margin-top:4px; }
  .c { aspect-ratio:1; border-radius:7px; background:var(--empty);
       display:flex; align-items:center; justify-content:center;
       font-size:12px; color:var(--sub); }
  .c.v { background:var(--visit); color:#0d1117; font-weight:700; }
  .c.m { background:rgba(248,81,73,0.5); color:var(--text); }
  .c.f { background:transparent; color:#30363d; }
  .c.t { box-shadow:inset 0 0 0 2px var(--sub); color:var(--text); }
  .c.sel { box-shadow:0 0 0 2px var(--text); }

  .info { position:sticky; bottom:0; z-index:2; background:var(--bg); padding:10px 16px 24px; }
  .card { background:var(--card); border-radius:14px; padding:14px; }
  .card .d { font-weight:600; }
  .card .s { color:var(--sub); font-size:13px; margin-top:2px; }
  .seg { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:12px; }
  .seg button { border:0; border-radius:10px; padding:10px 6px; font-size:14px; font-weight:600;
                background:#21262d; color:var(--sub); white-space:nowrap; }
  .seg button.on.gym { background:var(--visit); color:#0d1117; }
  .seg button.on.missed { background:rgba(248,81,73,0.5); color:var(--text); }
  .seg button.on.rest { background:#30363d; color:var(--text); box-shadow:inset 0 0 0 1.5px var(--sub); }
  .hint { color:var(--sub); font-size:12px; margin-top:8px; text-align:center; }
</style></head>
<body>
  <div class="top">
    <h1>🏋️ Gym</h1>
    <div class="stats">
      <div class="stat"><b id="sWeek">0</b><span>this week</span></div>
      <div class="stat"><b id="sMonth">0</b><span>this month</span></div>
      <div class="stat"><b id="sStreak">0</b><span>week streak</span></div>
      <div class="stat"><b id="sYear">0</b><span>last 12 months</span></div>
    </div>
  </div>
  <div class="row head">
    <div></div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div><div>Su</div>
  </div>
  <div class="weeks" id="weeks"></div>
  <div class="info">
    <div class="card">
      <div class="d" id="iDate"></div><div class="s" id="iStatus"></div>
      <div class="seg">
        <button class="gym" data-s="gym">✅ Gym</button>
        <button class="missed" data-s="missed">❌ Missed</button>
        <button class="rest" data-s="rest">😴 Rest</button>
      </div>
    </div>
    <div class="hint">Tap a day, then choose its status. Changes save when you close.</div>
  </div>
<script>
  window.state = new Set(__DATA__);
  var ST = __STATUS__;
  window.mset = new Set(ST.missed);
  window.rset = new Set(ST.rest);
  var WEEKS = 53;
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var todayKey = key(today);
  var monday = addDays(today, -((today.getDay() + 6) % 7));
  var cells = {};
  var sel = todayKey;
  var weeksEl = document.getElementById("weeks");
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var prevMonth = -1;

  // Newest week at the top, older weeks further down.
  for (var w = 0; w < WEEKS; w++) {
    var ws = addDays(monday, -w * 7);
    var row = document.createElement("div");
    row.className = "row";
    var label = document.createElement("div");
    label.className = "month";

    // Label the week where a month starts (its 1st is in this row).
    var firstIn = null;
    for (var i = 0; i < 7; i++) {
      var dd = addDays(ws, i);
      if (dd.getDate() === 1) firstIn = dd;
    }
    if (firstIn) {
      label.textContent = MONTHS[firstIn.getMonth()] +
        (firstIn.getMonth() === 0 || prevMonth === -1 ? " '" + String(firstIn.getFullYear()).slice(2) : "");
      if (w > 0) row.className += " newmonth";
      prevMonth = firstIn.getMonth();
    }
    row.appendChild(label);

    for (var r = 0; r < 7; r++) {
      var d = addDays(ws, r);
      var k = key(d);
      var el = document.createElement("div");
      el.className = "c";
      if (d.getDate() === 1) { el.textContent = MONTHS[d.getMonth()]; el.style.fontSize = "10px"; el.style.fontWeight = "700"; }
      else el.textContent = d.getDate();
      if (d > today) { el.className += " f"; }
      else {
        el.dataset.k = k;
        el.addEventListener("click", function () { sel = this.dataset.k; render(); });
        cells[k] = el;
      }
      row.appendChild(el);
    }
    weeksEl.appendChild(row);
  }

  function fmt(k) {
    var p = k.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  }

  function weekStreak() {
    var wkStart = monday, streak = 0;
    function hasVisit(s) {
      for (var i = 0; i < 7; i++) if (state.has(key(addDays(s, i)))) return true;
      return false;
    }
    if (!hasVisit(wkStart)) wkStart = addDays(wkStart, -7); // current week not broken yet
    while (hasVisit(wkStart)) { streak++; wkStart = addDays(wkStart, -7); }
    return streak;
  }

  function missedDays() {
    var missed = {};
    var past = Array.from(state).filter(function (k) { return k <= todayKey; }).sort();
    var p = (past[0] || todayKey).split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]), gap = 0;
    while (key(d) < todayKey) {
      var k = key(d);
      if (state.has(k)) gap = 0;
      else if (!rset.has(k) && ++gap >= __MISSED__) missed[k] = true;
      d = addDays(d, 1);
    }
    mset.forEach(function (k) { if (k <= todayKey && !state.has(k)) missed[k] = true; });
    return missed;
  }

  function render() {
    var missed = missedDays();
    for (var k in cells) {
      var cls = "c";
      if (state.has(k)) cls += " v";
      else if (missed[k]) cls += " m";
      if (k === todayKey && !state.has(k)) cls += " t";
      if (k === sel) cls += " sel";
      cells[k].className = cls;
    }
    var all = Array.from(state);
    var mondayKey = key(monday), monthPrefix = todayKey.slice(0, 7), yearAgo = key(addDays(today, -365));
    document.getElementById("sWeek").textContent = all.filter(function (k) { return k >= mondayKey && k <= todayKey; }).length;
    document.getElementById("sMonth").textContent = all.filter(function (k) { return k.indexOf(monthPrefix) === 0; }).length;
    document.getElementById("sYear").textContent = all.filter(function (k) { return k > yearAgo && k <= todayKey; }).length;
    document.getElementById("sStreak").textContent = weekStreak();
    var current = state.has(sel) ? "gym" : missed[sel] ? "missed" : "rest";
    document.getElementById("iDate").textContent = fmt(sel) + (sel === todayKey ? " (today)" : "");
    document.getElementById("iStatus").textContent =
      current === "gym" ? "Gym day ✅" : current === "missed" ? "Missed day ❌" : "Rest day 😴";
    Array.prototype.forEach.call(document.querySelectorAll(".seg button"), function (b) {
      b.className = b.dataset.s + (b.dataset.s === current ? " on" : "");
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll(".seg button"), function (b) {
    b.addEventListener("click", function () {
      state.delete(sel); mset.delete(sel); rset.delete(sel);
      if (b.dataset.s === "gym") state.add(sel);
      else if (b.dataset.s === "missed") mset.add(sel);
      else rset.add(sel);
      render();
    });
  });

  render();
</script>
</body></html>`;

async function showInteractive(visits) {
  const before = JSON.stringify([...visits].sort());
  const statusBefore = JSON.stringify({ missed: [...STATUS.missed].sort(), rest: [...STATUS.rest].sort() });
  const wv = new WebView();
  await wv.loadHTML(PAGE
    .replace("__DATA__", before)
    .replace("__STATUS__", statusBefore)
    .replace("__MISSED__", String(MISSED_DAYS)));
  await wv.present(true);
  try {
    const out = JSON.parse(await wv.evaluateJavaScript(
      "JSON.stringify({v: Array.from(window.state).sort(), m: Array.from(window.mset).sort(), r: Array.from(window.rset).sort()})"));
    const statusAfter = JSON.stringify({ missed: out.m, rest: out.r });
    if (statusAfter !== statusBefore) {
      STATUS = { missed: out.m, rest: out.r };
      saveStatus();
    }
    if (JSON.stringify(out.v) !== before) {
      const updated = new Set(out.v);
      saveVisits(updated);
      return updated;
    }
  } catch (e) {
    console.error("Could not save changes: " + e);
  }
  return visits;
}

// ---------- notification ----------
async function notifyLogged(visits) {
  try {
    const s = stats(visits);
    const n = new Notification();
    n.title = "🏋️ Gym day registered";
    const week = s.week === 1 ? "1st visit this week" : `${s.week} visits this week`;
    n.body = s.streak > 1
      ? `${week} · 🔥 ${s.streak}-week streak. Have a good session!`
      : `${week}. Have a good session!`;
    n.sound = "default";
    n.openURL = URLScheme.forRunningScript();
    await n.schedule();
  } catch (e) {
    console.error("Notification failed: " + e);
  }
}

// ---------- missed-day reminders ----------
// After MISSED_DAYS days without a visit, send a reminder every night at
// REMINDER_HOUR until the next visit. Reminders are scheduled ahead of time
// and re-planned whenever the script runs (visit logged, widget refresh, app opened).
const MISSED_DAYS = 3;
const WEEKLY_GOAL = 3;     // gym visits per week for the Lock Screen ring
const REMINDER_HOUR = 22; // 10 pm
const REMINDER_PREFIX = "gym-reminder-";
const PLAN_AHEAD_DAYS = 30;

const REMINDER_LINES = [
  "Today you didn't go. Go tomorrow! 💪",
  "Your squares are going grey… tomorrow is a new chance 🏋️",
  "You missed your gym day again. Tomorrow, no excuses 😤",
  "The gym misses you 🥺 Pack your bag for tomorrow.",
  "Another day off. Make tomorrow green ✅",
];

async function updateReminders(visits) {
  try {
    // Cancel reminders planned earlier
    const pending = await Notification.allPending();
    const old = pending.map(n => n.identifier).filter(id => id && id.startsWith(REMINDER_PREFIX));
    if (old.length) Notification.removePending(old);

    const past = [...visits].filter(k => k <= todayKey).sort();
    if (!past.length) return; // nothing logged yet
    const p = past[past.length - 1].split("-");
    const lastVisit = new Date(+p[0], +p[1] - 1, +p[2]);
    const now = new Date();

    for (let missed = MISSED_DAYS; missed < MISSED_DAYS + PLAN_AHEAD_DAYS; missed++) {
      const day = addDays(lastVisit, missed);
      const fire = new Date(day.getFullYear(), day.getMonth(), day.getDate(), REMINDER_HOUR, 0, 0);
      if (fire <= now) continue;
      const n = new Notification();
      n.identifier = REMINDER_PREFIX + key(day);
      n.threadIdentifier = "gym-reminders";
      n.title = `😬 ${missed} days without the gym`;
      n.body = REMINDER_LINES[(missed - MISSED_DAYS) % REMINDER_LINES.length];
      n.sound = "default";
      n.openURL = URLScheme.forRunningScript();
      n.setTriggerDate(fire);
      await n.schedule();
    }
  } catch (e) {
    console.error("Could not plan reminders: " + e);
  }
}

// ---------- main ----------
const visits = await loadVisits();
await loadStatus();
const param =
  args.shortcutParameter ||
  (args.plainTexts && args.plainTexts.length ? args.plainTexts[0] : null);

if (!config.runsInWidget && (param || config.runsWithSiri || !config.runsInApp)) {
  // Called from Shortcuts
  const p = String(param || "log").trim().toLowerCase();
  if (p === "remove") {
    visits.delete(todayKey);
    Script.setShortcutOutput(`Removed ${todayKey}`);
  } else {
    const alreadyLogged = visits.has(todayKey);
    visits.add(todayKey);
    Script.setShortcutOutput(`Logged gym visit ${todayKey}`);
    if (!alreadyLogged) await notifyLogged(visits);
  }
  saveVisits(visits);
  await updateReminders(visits);
} else if (config.runsInWidget) {
  Script.setWidget(buildWidget(visits, config.widgetFamily));
  await updateReminders(visits);
} else {
  // Opened in the app or by tapping the widget
  const updated = await showInteractive(visits);
  await updateReminders(updated);
}

