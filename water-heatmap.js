// Water Heatmap for Scriptable
// Track glasses of water per day, GitHub-style: the more you drink, the brighter the square.
//
//  - Shortcuts runs this script (Texts: "add" or "remove") -> +1 / -1 glass today
//  - As a widget                                             -> shows the heatmap
//  - Opened in Scriptable (or tap the widget)                -> interactive calendar
//  - Reminder notifications have a "+1 glass" button

// ---------- settings ----------
const GOAL = 8;                                  // glasses per day
const REMINDER_HOURS = [9, 11, 13, 15, 17, 19, 21];
const DAY_START = 8, DAY_END = 22;               // used to decide if you're "behind"

const FILE_NAME = "water-log.json";
const COLORS = {
  bg: new Color("#0d1117"),
  text: new Color("#e6edf3"),
  sub: new Color("#8b949e"),
  todayOutline: new Color("#8b949e"),
  future: new Color("#161b22"),
  divider: new Color("#ffffff", 0.2),
  levels: [
    new Color("#21262d"), // 0 glasses
    new Color("#0c2d48"), // a little
    new Color("#0e4b7a"), // about half
    new Color("#1f6feb"), // almost there
    new Color("#58a6ff"), // goal reached
  ],
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

async function loadLog() {
  if (!fm.fileExists(path)) return {};
  try {
    if (fm.isFileStoredIniCloud(path)) await fm.downloadFileFromiCloud(path);
  } catch (e) {}
  try {
    return JSON.parse(fm.readString(path)) || {};
  } catch (e) {
    return {};
  }
}

function saveLog(log) {
  const clean = {};
  Object.keys(log).sort().forEach(k => { if (log[k] > 0) clean[k] = log[k]; });
  fm.writeString(path, JSON.stringify(clean));
}

// ---------- dates & stats ----------
function key(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function mondayOf(d) {
  return addDays(d, -((d.getDay() + 6) % 7));
}

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const todayKey = key(today);
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function level(count) {
  if (!count) return 0;
  const r = count / GOAL;
  if (r >= 1) return 4;
  if (r >= 0.66) return 3;
  if (r >= 0.33) return 2;
  return 1;
}

function stats(log) {
  const t = log[todayKey] || 0;
  // Days in a row hitting the goal (today doesn't break it until it's over)
  let d = (t >= GOAL) ? today : addDays(today, -1), streak = 0;
  while ((log[key(d)] || 0) >= GOAL) { streak++; d = addDays(d, -1); }
  let week = 0;
  for (let i = 0; i < 7; i++) week += log[key(addDays(today, -i))] || 0;
  return { today: t, streak, avg7: Math.round((week / 7) * 10) / 10 };
}

// ---------- widget ----------
function drawGrid(log, width, step, opts) {
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

  // Last month + upcoming days
  const start = mondayOf(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const labelFont = Font.mediumSystemFont(9);

  if (opts.dayLabels) {
    ctx.setFont(labelFont);
    ctx.setTextColor(COLORS.sub);
    ["M", "T", "W", "T", "F", "S", "S"].forEach((t, r) =>
      ctx.drawText(t, new Point(0, top + r * step + (cell - 11) / 2)));
  }

  const starts = [];
  for (let c = 0; c < weeks; c++)
    for (let r = 0; r < 7; r++) {
      const d = addDays(start, c * 7 + r);
      if (d.getDate() === 1) starts.push({ c, r, m: d.getMonth() });
    }

  if (opts.monthLabels) {
    ctx.setFont(labelFont);
    ctx.setTextColor(COLORS.sub);
    let lastX = -100;
    starts.forEach(({ c, r, m }) => {
      const x = left + (r === 0 ? c : c + 1) * step;
      if (x - lastX >= 22 && x + 18 <= left + gridW + 4) {
        ctx.drawText(MONTHS[m], new Point(x, 0));
        lastX = x;
      }
    });
  }

  const radius = Math.max(2, cell * 0.25);
  for (let c = 0; c < weeks; c++) {
    for (let r = 0; r < 7; r++) {
      const d = addDays(start, c * 7 + r);
      const k = key(d);
      const p = new Path();
      p.addRoundedRect(new Rect(left + c * step, top + r * step, cell, cell), radius, radius);
      ctx.addPath(p);
      ctx.setFillColor(d > today ? COLORS.future : COLORS.levels[level(log[k])]);
      ctx.fillPath();
      if (k === todayKey) {
        ctx.addPath(p);
        ctx.setStrokeColor(COLORS.todayOutline);
        ctx.setLineWidth(1.5);
        ctx.strokePath();
      }
    }
  }

  const y0 = top - 1, y7 = top + 7 * step - gap + 1;
  starts.forEach(({ c, r }) => {
    if (c === 0 && r === 0) return;
    const xB = left + c * step - gap / 2;
    const xA = left + (c + 1) * step - gap / 2;
    const yR = top + r * step - gap / 2;
    const p = new Path();
    if (r === 0) {
      p.move(new Point(xB, y0)); p.addLine(new Point(xB, y7));
    } else {
      p.move(new Point(xA, y0)); p.addLine(new Point(xA, yR));
      p.addLine(new Point(xB, yR)); p.addLine(new Point(xB, y7));
    }
    ctx.addPath(p);
    ctx.setStrokeColor(COLORS.divider);
    ctx.setLineWidth(1);
    ctx.strokePath();
  });
  return ctx.getImage();
}

function drawProgress(width, value) {
  const h = 3;
  const ctx = new DrawContext();
  ctx.size = new Size(width, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const bg = new Path();
  bg.addRoundedRect(new Rect(0, 0, width, h), h / 2, h / 2);
  ctx.addPath(bg);
  ctx.setFillColor(COLORS.levels[0]);
  ctx.fillPath();
  const w = Math.max(value > 0 ? h : 0, Math.min(1, value) * width);
  if (w > 0) {
    const fg = new Path();
    fg.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2);
    ctx.addPath(fg);
    ctx.setFillColor(COLORS.levels[4]);
    ctx.fillPath();
  }
  return ctx.getImage();
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

function buildWidget(log, family) {
  const s = stats(log);
  const w = new ListWidget();
  w.url = URLScheme.forRunningScript();
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

  if (family === "accessoryInline") {
    w.addText(`💧 ${s.today}/${GOAL} glasses`);
    return w;
  }
  if (family === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const v = w.addStack();
    v.layoutVertically();
    const a = v.addText(`${s.today}/${GOAL}`);
    a.font = Font.boldRoundedSystemFont(18);
    a.centerAlignText();
    const b = v.addText("💧");
    b.font = Font.systemFont(10);
    b.centerAlignText();
    return w;
  }
  if (family === "accessoryRectangular") {
    const t = w.addText("💧 Water");
    t.font = Font.boldSystemFont(13);
    const a = w.addText(`${s.today}/${GOAL} glasses today`);
    a.font = Font.systemFont(12);
    const b = w.addText(`🔥 ${s.streak}-day goal streak`);
    b.font = Font.systemFont(12);
    return w;
  }

  const small = family === "small";
  const large = family === "large" || family === "extraLarge";
  const padH = 14;
  const contentW = widgetWidth(family) - padH * 2;

  w.backgroundColor = COLORS.bg;
  w.setPadding(12, padH, 12, padH);

  const header = w.addStack();
  header.centerAlignContent();
  addText(header, "💧 Water", Font.boldSystemFont(14), COLORS.text);
  header.addSpacer();
  addText(header, small ? `${s.today}/${GOAL}` : `${s.today}/${GOAL} today · 🔥 ${s.streak}`,
    Font.mediumSystemFont(11), COLORS.sub);

  w.addSpacer(4);
  const bar = w.addImage(drawProgress(contentW, s.today / GOAL));
  bar.imageSize = new Size(contentW, 3);
  w.addSpacer(small ? 4 : 6);

  const widgetH = small ? widgetWidth(family) : Math.round(widgetWidth(family) * (large ? 1.05 : 0.47));
  const reserved = 24 + 17 + 8 + (large ? 90 : 18) + 13; // same sizing as the gym widget
  const step = Math.max(9, Math.min(large ? 21 : 16, Math.floor((widgetH - reserved + 3) / 7)));
  const gridImg = drawGrid(log, contentW, step, { dayLabels: !small, monthLabels: true });
  const img = w.addImage(gridImg);
  img.imageSize = gridImg.size;
  img.centerAlignImage();

  w.addSpacer();
  const f = w.addStack();
  if (small) {
    addText(f, `🔥 ${s.streak} days`, Font.systemFont(10), COLORS.sub);
  } else {
    const left = s.today >= GOAL ? "Goal reached 🎉" : `${GOAL - s.today} to go today`;
    addText(f, left, Font.systemFont(11), COLORS.sub);
    f.addSpacer();
    addText(f, `avg ${s.avg7}/day (7 days)`, Font.systemFont(11), COLORS.sub);
  }
  return w;
}

// ---------- notifications ----------
const REMINDER_PREFIX = "water-reminder-";

function addGlassURL() {
  return URLScheme.forRunningScript() + "?add=1";
}

// How many glasses you "should" have by a given hour
function expectedBy(hour) {
  const f = Math.min(1, Math.max(0, (hour - DAY_START) / (DAY_END - DAY_START)));
  return Math.ceil(GOAL * f);
}

const REMINDER_LINES = [
  "Time for a glass of water 💧",
  "Quick sip break? Your body will thank you 🙌",
  "Hydration check! Grab a glass 🥤",
  "Don't forget to drink something 💦",
];

// Plans reminders for the rest of today (only where you're behind) and the next 2 days.
async function updateReminders(log) {
  try {
    const pending = await Notification.allPending();
    const old = pending.map(n => n.identifier).filter(id => id && id.startsWith(REMINDER_PREFIX));
    if (old.length) Notification.removePending(old);

    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const day = addDays(today, dayOffset);
      const count = log[key(day)] || 0;
      for (let i = 0; i < REMINDER_HOURS.length; i++) {
        const h = REMINDER_HOURS[i];
        const fire = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0);
        if (fire <= now) continue;
        const target = expectedBy(h);
        if (count >= target) continue; // already on track for that time
        const n = new Notification();
        n.identifier = `${REMINDER_PREFIX}${key(day)}-${h}`;
        n.threadIdentifier = "water-reminders";
        n.title = REMINDER_LINES[i % REMINDER_LINES.length];
        n.body = dayOffset === 0
          ? `You're at ${count}/${GOAL} today. Aim for ${target} by now.`
          : `Aim for ${target}/${GOAL} glasses by ${h}:00.`;
        n.sound = "default";
        n.openURL = URLScheme.forRunningScript();
        n.addAction("+1 glass 💧", addGlassURL());
        n.setTriggerDate(fire);
        await n.schedule();
      }
    }
  } catch (e) {
    console.error("Could not plan reminders: " + e);
  }
}

async function notifyLogged(log) {
  try {
    const c = log[todayKey] || 0;
    const n = new Notification();
    n.identifier = "water-logged";
    n.title = c >= GOAL ? `🎉 Goal reached! ${c}/${GOAL}` : `💧 Glass logged: ${c}/${GOAL}`;
    n.body = c >= GOAL ? "Nice work staying hydrated today." : `${GOAL - c} more to reach today's goal.`;
    await n.schedule();
  } catch (e) {}
}

// ---------- interactive view ----------
const PAGE = `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { --bg:#0d1117; --card:#161b22; --text:#e6edf3; --sub:#8b949e;
          --l0:#21262d; --l1:#0c2d48; --l2:#0e4b7a; --l3:#1f6feb; --l4:#58a6ff; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html, body { margin:0; background:var(--bg); color:var(--text);
         font-family:-apple-system, system-ui, sans-serif; -webkit-user-select:none; }
  .top { padding:20px 16px 0; }
  h1 { font-size:26px; margin:0 0 14px; }
  .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }
  .stat { background:var(--card); border-radius:14px; padding:12px; }
  .stat b { display:block; font-size:22px; }
  .stat span { color:var(--sub); font-size:12px; }
  .legend { display:flex; align-items:center; gap:4px; justify-content:flex-end;
            color:var(--sub); font-size:11px; margin-bottom:6px; }
  .legend i { width:12px; height:12px; border-radius:3px; display:inline-block; }

  .row { display:grid; grid-template-columns:44px repeat(7, 1fr); gap:5px; padding:0 16px; }
  .head { position:sticky; top:0; z-index:2; background:var(--bg);
          padding-top:10px; padding-bottom:8px; border-bottom:1px solid #21262d; }
  .head div { text-align:center; font-size:12px; font-weight:600; color:var(--sub); }
  .weeks { padding-top:6px; }
  .weeks .row { margin-bottom:5px; }
  .month { font-size:12px; font-weight:600; color:var(--sub); align-self:center; line-height:1.1; }
  .row.newmonth { border-top:1px solid rgba(255,255,255,0.2); padding-top:6px; margin-top:4px; }
  .c { aspect-ratio:1; border-radius:7px; background:var(--l0);
       display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--sub); }
  .c.l1 { background:var(--l1); color:var(--text); }
  .c.l2 { background:var(--l2); color:var(--text); }
  .c.l3 { background:var(--l3); color:#fff; font-weight:600; }
  .c.l4 { background:var(--l4); color:#0d1117; font-weight:700; }
  .c.f { background:transparent; color:#30363d; }
  .c.t { box-shadow:inset 0 0 0 2px var(--sub); }
  .c.sel { box-shadow:0 0 0 2px var(--text); }

  .info { position:sticky; bottom:0; z-index:2; background:var(--bg); padding:10px 16px 24px; }
  .card { background:var(--card); border-radius:14px; padding:14px; }
  .line { display:flex; align-items:baseline; justify-content:space-between; }
  .card .d { font-weight:600; }
  .card .n { font-size:28px; font-weight:700; }
  .card .n small { font-size:15px; color:var(--sub); font-weight:500; }
  .bar { height:8px; border-radius:4px; background:var(--l0); margin:10px 0 12px; overflow:hidden; }
  .bar div { height:100%; background:var(--l4); border-radius:4px; transition:width .2s; }
  .btns { display:grid; grid-template-columns:1fr 2fr; gap:8px; }
  button { border:0; border-radius:10px; padding:12px; font-size:16px; font-weight:600; }
  .minus { background:#21262d; color:var(--text); }
  .plus { background:var(--l3); color:#fff; }
  .hint { color:var(--sub); font-size:12px; margin-top:8px; text-align:center; }
</style></head>
<body>
  <div class="top">
    <h1>💧 Water</h1>
    <div class="stats">
      <div class="stat"><b id="sToday">0</b><span>today</span></div>
      <div class="stat"><b id="sStreak">0</b><span>goal streak</span></div>
      <div class="stat"><b id="sAvg">0</b><span>avg / 7 days</span></div>
    </div>
  </div>
  <div class="row head">
    <div></div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div><div>Su</div>
  </div>
  <div class="weeks" id="weeks"></div>
  <div class="info">
    <div class="legend">Less <i style="background:var(--l0)"></i><i style="background:var(--l1)"></i><i style="background:var(--l2)"></i><i style="background:var(--l3)"></i><i style="background:var(--l4)"></i> More</div>
    <div class="card">
      <div class="line"><div class="d" id="iDate"></div><div class="n" id="iCount"></div></div>
      <div class="bar"><div id="iBar"></div></div>
      <div class="btns">
        <button class="minus" id="minus">− 1</button>
        <button class="plus" id="plus">+1 glass 💧</button>
      </div>
    </div>
    <div class="hint">Tap a day to view or fix it. Changes save when you close.</div>
  </div>
<script>
  window.entries = __DATA__;
  var GOAL = __GOAL__, WEEKS = 53;
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function level(c) { if (!c) return 0; var r = c / GOAL; return r >= 1 ? 4 : r >= 0.66 ? 3 : r >= 0.33 ? 2 : 1; }
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var todayKey = key(today);
  var monday = addDays(today, -((today.getDay() + 6) % 7));
  var cells = {};
  var sel = todayKey;
  var weeksEl = document.getElementById("weeks");
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var prevMonth = -1;

  for (var w = 0; w < WEEKS; w++) {
    var ws = addDays(monday, -w * 7);
    var row = document.createElement("div");
    row.className = "row";
    var label = document.createElement("div");
    label.className = "month";
    var firstIn = null;
    for (var i = 0; i < 7; i++) { var dd = addDays(ws, i); if (dd.getDate() === 1) firstIn = dd; }
    if (firstIn) {
      label.textContent = MONTHS[firstIn.getMonth()] +
        (firstIn.getMonth() === 0 || prevMonth === -1 ? " '" + String(firstIn.getFullYear()).slice(2) : "");
      if (w > 0) row.className += " newmonth";
      prevMonth = firstIn.getMonth();
    }
    row.appendChild(label);
    for (var r = 0; r < 7; r++) {
      var d = addDays(ws, r), k = key(d);
      var el = document.createElement("div");
      el.className = "c";
      el.textContent = d.getDate() === 1 ? MONTHS[d.getMonth()] : d.getDate();
      if (d.getDate() === 1) { el.style.fontSize = "10px"; }
      if (d > today) el.className += " f";
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
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });
  }

  function render() {
    for (var k in cells) {
      var cls = "c l" + level(entries[k]);
      if (k === todayKey) cls += " t";
      if (k === sel) cls += " sel";
      cells[k].className = cls;
    }
    var t = entries[todayKey] || 0;
    var d = t >= GOAL ? today : addDays(today, -1), streak = 0;
    while ((entries[key(d)] || 0) >= GOAL) { streak++; d = addDays(d, -1); }
    var sum = 0;
    for (var i = 0; i < 7; i++) sum += entries[key(addDays(today, -i))] || 0;
    document.getElementById("sToday").textContent = t + "/" + GOAL;
    document.getElementById("sStreak").textContent = streak + (streak === 1 ? " day" : " days");
    document.getElementById("sAvg").textContent = Math.round(sum / 7 * 10) / 10;

    var c = entries[sel] || 0;
    document.getElementById("iDate").textContent = fmt(sel) + (sel === todayKey ? " · today" : "");
    document.getElementById("iCount").innerHTML = c + " <small>/ " + GOAL + "</small>";
    document.getElementById("iBar").style.width = Math.min(100, c / GOAL * 100) + "%";
  }

  document.getElementById("plus").addEventListener("click", function () {
    entries[sel] = (entries[sel] || 0) + 1; render(); notifyChange();
  });
  document.getElementById("minus").addEventListener("click", function () {
    entries[sel] = Math.max(0, (entries[sel] || 0) - 1); render(); notifyChange();
  });

  // Scriptable reads this a few times per second to save changes.
  window.__snap = function () { return JSON.stringify(entries); };
  function notifyChange() {}

  render();
</script>
</body></html>`;

async function showInteractive(log) {
  const before = JSON.stringify(log);
  const wv = new WebView();
  await wv.loadHTML(PAGE.replace("__DATA__", before).replace("__GOAL__", String(GOAL)));
  await wv.present(true);
  try {
    const out = await wv.evaluateJavaScript("JSON.stringify(window.entries)");
    if (out && out !== before) {
      const after = JSON.parse(out);
      saveLog(after);
      return after;
    }
  } catch (e) {
    console.error("Could not save changes: " + e);
  }
  return log;
}

// ---------- main ----------
let log = await loadLog();
const query = args.queryParameters || {};
const param =
  args.shortcutParameter ||
  (args.plainTexts && args.plainTexts.length ? args.plainTexts[0] : null);

if (query.add) {
  // "+1 glass" tapped on a reminder
  log[todayKey] = (log[todayKey] || 0) + 1;
  saveLog(log);
  await updateReminders(log);
  log = await showInteractive(log);
  await updateReminders(log);
} else if (!config.runsInWidget && (param || config.runsWithSiri || !config.runsInApp)) {
  // Called from Shortcuts
  const p = String(param || "add").trim().toLowerCase();
  if (p === "remove") log[todayKey] = Math.max(0, (log[todayKey] || 0) - 1);
  else log[todayKey] = (log[todayKey] || 0) + 1;
  saveLog(log);
  Script.setShortcutOutput(`💧 ${log[todayKey] || 0}/${GOAL} glasses today`);
  if (p !== "remove") await notifyLogged(log);
  await updateReminders(log);
} else if (config.runsInWidget) {
  Script.setWidget(buildWidget(log, config.widgetFamily));
  await updateReminders(log);
} else {
  log = await showInteractive(log);
  await updateReminders(log);
}

Script.complete();
