# Gym & Water Heatmaps

GitHub-style contribution heatmaps for your iPhone Home Screen, built with [Scriptable](https://scriptable.app) and Apple Shortcuts.
Free, no Apple Developer account, no Mac needed, and nothing to re-sign every week.

| Script | What it tracks | How it logs |
| --- | --- | --- |
| `gym-heatmap.js` | Days you went to the gym | Automatically when you arrive at your gym (location automation) |
| `water-heatmap.js` | Glasses of water per day | One tap (Shortcut / Back Tap), the widget, or a reminder notification |

---

## 🏋️ Gym Heatmap

### Features
- **Auto-logging**: a Shortcuts "Arrive" automation marks the day when you reach your gym.
- **Widget**: last month plus the coming months, weekday and month labels, thin month dividers, today outlined.
- **Colors**: 🟩 gym day · 🟥 missed day (50% red) · ⬛ rest day.
  A day counts as *missed* from the 3rd day in a row without the gym.
- **Interactive calendar**: tap the widget to scroll through the year; tap a day and set it to ✅ Gym, ❌ Missed or 😴 Rest.
- **Stats**: this week, this month, last 12 months, week streak 🔥, "last visit X days ago".
- **Notifications**
  - "🏋️ Gym day registered" when you arrive (once per day).
  - Duolingo-style nudge at 10 pm every night after 3 days without the gym, until you go again.
- **Widget sizes**: small, medium, large, plus Lock Screen (circular, rectangular, inline).

### Settings (near the middle of the script)
```js
const MISSED_DAYS = 3;     // days without the gym before reminders / red days start
const REMINDER_HOUR = 22;  // reminder time (10 pm)
```

---

## 💧 Water Heatmap

### Features
- **Intensity heatmap**: squares get brighter blue the more you drink, bright blue when you hit your goal.
- **Widget**: thin progress bar for today, goal streak, 7-day average.
- **Interactive calendar**: big **+1 glass** / **−1** buttons; tap any past day to fix its count.
- **Smart reminders** at 9, 11, 13, 15, 17, 19 and 21 o'clock, only when you're behind schedule.
  Long-press a reminder and tap **+1 glass 💧** to log straight from the notification.
- **Lock Screen widgets**: `3/8` circular, rectangular and inline.

### Settings (top of the script)
```js
const GOAL = 8;                                  // glasses per day
const REMINDER_HOURS = [9, 11, 13, 15, 17, 19, 21];
```

---

## Setup

### 1. Install the scripts
1. Install **Scriptable** (free) from the App Store.
2. In Scriptable tap **+**, paste the contents of a script, and name it exactly:
   - `Gym Heatmap` for `gym-heatmap.js`
   - `Water Heatmap` for `water-heatmap.js`
3. Run each script once so it can plan its notifications.
4. Allow notifications: **Settings → Notifications → Scriptable**.

### 2. Add the widgets
1. Long-press the Home Screen → **Edit** → **Add Widget** → **Scriptable** (medium works best).
2. Tap the widget and set:
   - **Script**: `Gym Heatmap` or `Water Heatmap`
   - **When Interacting**: `Run Script`
   - **Parameter**: leave empty

### 3. Gym: log automatically when you arrive
1. **Shortcuts → Automation → + → Arrive**, choose your gym, radius about 100–150 m.
2. Turn **Confirm Before Run** off ("Run Immediately").
3. Add the action **Run Script** (Scriptable) → Script `Gym Heatmap`. Under **Texts** add `log`.
   Keep **Run In App** and **Show When Run** off.
4. Location: **Settings → Privacy & Security → Location Services → Shortcuts** → *While Using the App* + **Precise Location**.
   (Shortcuts has no "Always" option; iOS handles arrival triggers itself.)

### 4. Water: one-tap logging (optional)
1. In Shortcuts create a new shortcut: **Run Script** → `Water Heatmap`, under **Texts** add `add`.
2. Add it to the Home Screen, or assign it to **Settings → Accessibility → Touch → Back Tap**.

---

## Data

Everything is stored as small JSON files in **iCloud Drive → Scriptable** (or on the device if iCloud Drive is off):

| File | Contents |
| --- | --- |
| `gym-visits.json` | List of gym days, e.g. `["2026-11-02"]` |
| `gym-status.json` | Days you set by hand: `{ "missed": [...], "rest": [...] }` |
| `water-log.json` | Glasses per day, e.g. `{ "2026-11-03": 5 }` |

These files are personal data and are not part of this repository.

## Updating

This repository is the source of truth. After changing a script here, copy it into Scriptable
(open the script → select all → paste → **Done**). Scriptable does not sync with Git by itself.

## Notes for developers
- The interactive calendars are HTML pages shown in Scriptable's `WebView`; changes are read back with
  `evaluateJavaScript` after the page is closed.
- Avoid naming page variables `log`: Scriptable injects its own `log()` into web pages and overwrites it.
- Widgets are drawn with `DrawContext`, sized from `Device.screenSize()` so the grid fills the widget.
