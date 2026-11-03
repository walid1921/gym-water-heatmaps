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
- **Widget**: clean, emoji-free design. Small dimmed title at the top; last month plus the coming months with weekday and month labels, thin month dividers and today outlined; small stats at the bottom (this week · this month · last visit).
- **Colors**: 🟩 went · 🟧 didn't go (orange, 70%). Every past day since your first visit without a visit counts as *didn't go*; today only once it's over.
- **Interactive calendar**: tap the widget to scroll through the year; tap a day and set it to **Went** or **Didn't go**.
- **Stats**: this week, this month, last 12 months, total, "last visit X days ago".
- **Notifications**
  - "🏋️ Gym day registered" when you arrive (once per day).
  - Duolingo-style nudge at 10 pm every night after 3 days without the gym, until you go again.
- **Widget sizes**: small, medium, large.
- **Lock Screen**: ring with gym days this week out of 7, e.g. `1/7` (circular), mini heatmap of the last 16 weeks (rectangular), and a one-line summary (inline).

### Settings (near the middle of the script)
```js
const MISSED_DAYS = 3;     // days without the gym before the nightly reminders start
const REMINDER_HOUR = 22;  // reminder time (10 pm)
const WEEKLY_GOAL = 7;     // Lock Screen shows gym days this week out of 7
```

---

## 💧 Water Heatmap

### Features
- **Intensity heatmap**: squares get brighter blue the more you drink, bright blue when you hit your goal.
- **Widget**: same clean layout as the gym widget. Small dimmed title at the top; thin progress bar for today at the bottom with small stats (today `3/8` · "2 days in a row" · 7-day average).
- **Days in a row**: how many days in a row you reached your goal (today counts once you reach it).
- **Interactive calendar**: big **+1 glass** / **−1** buttons; tap any past day to fix its count.
- **Time log**: tap a day to see when each glass was logged and how (notification, shortcut or app).
- **Smart reminders** at 9, 11, 13, 15, 17, 19 and 21 o'clock, only when you're behind schedule.
  Tap a reminder (or long-press it and tap **+1 glass 💧**) to log a glass straight from the notification.
- **Evening summary** at 21:30: 🎉 goal reached (with streak), 💧 "6/8, 2 more before bed?", or 😬 "only 2/8".
- **Lock Screen**: progress ring for today's glasses (circular), mini heatmap of the last 16 weeks (rectangular), and a one-line summary (inline).

### Settings (top of the script)
```js
const GOAL = 8;                                  // glasses per day
const REMINDER_HOURS = [9, 11, 13, 15, 17, 19, 21];
const SUMMARY_HOUR = 21, SUMMARY_MINUTE = 30;    // evening summary time
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

### Lock Screen widgets
1. Long-press the Lock Screen → **Customize** → **Lock Screen**.
2. Tap the widget area under the clock, choose **Scriptable**, and add the round or rectangular size.
3. Tap the added widget and set **Script** to `Gym Heatmap` or `Water Heatmap`.
4. For the one-line version, tap the date above the clock and choose **Scriptable**.

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
| `gym-status.json` | Days you marked *didn't go* by hand: `{ "missed": [...] }` |
| `water-log.json` | Glasses per day, e.g. `{ "2026-11-03": 5 }` |
| `water-times.json` | When each glass was logged, e.g. `{ "2026-11-03": [{ "t": "13:20", "s": "notification" }] }` |

These files are personal data and are not part of this repository.

## Updating

This repository is the source of truth. After changing a script here, copy it into Scriptable
(open the script → select all → paste → **Done**). Scriptable does not sync with Git by itself.

## Notes for developers
- The interactive calendars are HTML pages shown in Scriptable's `WebView`; changes are read back with
  `evaluateJavaScript` after the page is closed.
- A plain tap on a Scriptable notification only opens the app. To run code from a notification, give it an
  `openURL` built from `URLScheme.forRunningScript()` plus a query parameter (e.g. `?add=1`), read via `args.queryParameters`.
  Set `DEBUG = true` in `water-heatmap.js` to see what each run receives (notification link check).
- Avoid naming page variables `log`: Scriptable injects its own `log()` into web pages and overwrites it.
- Widgets are drawn with `DrawContext`, sized from `Device.screenSize()` so the grid fills the widget.
