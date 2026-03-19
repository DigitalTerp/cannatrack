# My Canna Tracker — Next.js + TypeScript + Firebase

> _In the Jedi Order, constructing your first lightsaber marks the completion of training._  
> _This repo is my first lightsaber—my initiation into modern frontend development._

A **personalizable** web app for logging cannabis sessions, organizing cultivars, searching your history, and spotting patterns that reflect **your** preferences and routines. Built to stay out of your way and make it effortless to capture what matters.

---
![Main Page](/public/MyCannaTrackerMain.png)
## Features

- **Session Logging (fast & flexible)**  
  Capture method, weight (g), auto-timestamp, rating, notes, plus structured **Effects / Smell / Taste** fields—so your logs are both consistent and expressive.

- **Cultivar Library (auto-upserting)** 
![Cultivar Library](/public/CultivarsHistory.png) 
  Your library grows automatically from session logs. Store **name, type (Indica/Sativa/Hybrid), cultivator, lineage, THC/THCA/CBD** and reuse across sessions.

- **Smart Autofill**  
  Select a previously logged cultivar and key fields (type, cultivator, potency) **auto-populate** to keep entries consistent and fast.

- **Search (History & Library)**  
  - **History Search:** filter past sessions by **cultivar name, notes, method, rating, or date**.  
  - **Library Search:** find cultivars by **name, type, cultivator, or lineage**.  
  Client-side, debounced, and keyboard-friendly.

- **Daily Tracker**  
  A today-at-a-glance view with clear type badges and quick actions.

- **History Navigation** 
![Main Page](/public/HistoryScreen.png) 
  Jump via **calendar picker** or **Prev / Today / Next**. Edit/delete inline.

- **Insights (early analytics)**
![Main Page](/public/Insights.png)  
  Simple trends like **totals/means by method, weight, rating**—a foundation for richer analytics.

- **Mobile-First, Responsive UI**  
![Main Page](/public/MainMobileScreen.png)
  Built for thumbs: large tap targets, native mobile inputs, accessible contrast, and a clean hamburger nav. Looks great on desktop; **optimized for phones**.
![Main Page](/public/CannaTrackMobileMenu.png)

- **Auth & Data**
![Main Page](/public/CannaTrackerLogin.png)
  Email/Password via Firebase Auth, user-scoped collections in Firestore.

---

## Tech Stack

- **Next.js** (App Router)
- **TypeScript**
- **Firebase**  
  - Authentication (Email/Password)  
  - **Cloud Firestore** (user-scoped collections)
- **Styling**: Custom global CSS + **Plus Jakarta Sans**
- **Utilities**: **date-fns** for time formatting

---

The app auto-upserts cultivars from logs, and autofills session fields when you pick an existing cultivar.

## Architecture Notes

- **Search (History & Library)**  App Router with client components where interactivity matters (forms, history controls, search inputs).

Search is client-side and debounced for snappy filtering in History & Library.

Day math helpers (e.g., startOfTodayMs()) keep daily grouping consistent.

Type safety via Entry, StrainType, etc., so refactors are predictable.

Getting Started (local)


## Roadmap

- **Richer Insights** 

- **CSV Import/Export**

- **User Settings** 

I’ll keep adding features and sanding off rough edges. Ideas welcome—open an issue.

## License

MIT — use, remix, and learn freely. 🌿

## Why I Built This

As a judge and a tinkerer, I wanted a tracker that adapts to me—fast to log, easy to search, and expressive enough to capture what actually matters: how it smelled, how it tasted, how it felt, and whether it’s worth revisiting.

Training complete. First lightsaber constructed. Time to explore the galaxy (of cultivars)—one personalized log at a time.

## *** Updates

## March 19, 2026 — Insights + Cultivars UI Update

This update expands the analytics experience for concentrates and gives the Cultivars page more personality and faster filtering.

### Insights — Dab Tracking Expansion
- Added **dab-specific analytics** to the Insights page
- Dabs are now tracked in **grams**, matching how concentrate sessions are logged in the app
- Added **Dab Intake by Type** chart:
  - Groups dab consumption by **Indica / Hybrid / Sativa**
  - Shows which cultivar class is most used for dabs
- Added **Top Cultivar From Dabs** badge
- Added **Top Dab Cultivars** chart:
  - Ranked by total grams consumed
  - Includes both **sessions** and **grams**
- Added **Types of Concentrates Dabbed** chart:
  - Groups usage by concentrate form/category combinations
  - Examples include form + type combinations such as **Badder (Live Resin)** or **Sugar (Cured)**
- Added **7-day dab totals** to the summary badges at the top of Insights

### Cultivars Page — Stats & Filtering
- Added a prominent **Total Cultivars** summary badge above search
- Added cultivar class counts for:
  - **Indica**
  - **Hybrid**
  - **Sativa**
- Converted cultivar class badges into **interactive filter buttons**
- Clicking **Indica / Hybrid / Sativa / All** now filters the cultivar list directly
- Search and type filtering now work **together**
- Refined the layout so:
  - **Total Cultivars** stands on its own line
  - Search stays centered and clean
  - Filter buttons sit below the search input
- Updated the filter button labels so counts appear at the **end** of the label
  - Example: `Indica 12` instead of `Indica: 12`

### UI / UX Polish
- Enlarged the **Total Cultivars** badge for stronger hierarchy
- Improved spacing between summary, search, and filters
- Added more visual flair to cultivar class filters while keeping them consistent with the site’s badge system
- Preserved mobile behavior and responsiveness while improving layout clarity on larger screens

## Major Update — Concentrates
Date: March 8, 2026

This update adds full support for concentrates throughout the application, including data modeling, session logging, and purchase tracking. It also includes a round of general UI and UX improvements.

### Concentrate Support
- Introduced Smokeable Type (Flower or Concentrate)
- Added concentrate categories: Cured, Live Resin, Live Rosin
- Concentrate forms dynamically update based on category selection
- Method of consumption automatically adjusts for concentrate sessions
- Purchases now store concentrate category and form data
- Session logging correctly matches and deducts from the appropriate purchase

### Purchase & Session Improvements
- Improved linking between purchases and logged sessions
- More accurate deduction logic based on product type
- Better handling of depleted and archived purchases

### UI & UX Improvements
- Updated Purchase Card layout for clarity and consistency
- Clearer display of product type, category, and form
- General visual cleanup and usability refinements across forms

## 2025-11-16 — Purchases and Cultivar Updates

- **Improved weight formatting system**
  - Added fractional ounce labels (⅛, ¼, ½, ¾ oz)
  - Updated multi-ounce and gram formatting across the app

- **Updated PurchaseCard UI**
  - Moved lineage above the info center
  - Enhanced mobile centering and spacing
  - Refined progress bar placement

- **Added Waste Display**
  - New archive metric showing leftover material (stems, seeds, unusable bits)
  - Displays waste grams and percentage
  - Helps track usable vs. unusable product yield
  - Includes contextual explanation within finished purchases

- **Enhanced Finished Purchases view**
  - Added Purchase Length (days between purchase → finish)
  - Integrated new Waste Display styling

- **Added new Cultivar Consumption Log**
  - Replaces the old consumption section on the cultivar page
  - Provides a clear breakdown of:
    - Total sessions
    - Total amount consumed
    - Date range
    - Average potency
  - Includes filtering by consumption method
  - More readable, report-like interface

- **Adjustments to the Cultivar ID page**
  - Changed Consumption section to show statistics
  - Added link to the new Full Consumption Log

- **Additional mobile responsiveness**

## 2025-10-06 — Edibles: mg display fix & quicker entry

- Fixed an issue where edible **mg** amounts were not showing in **History** and **Daily** views.
- Added **Recall Previous Edibles**: auto-suggests past edible items so you can quickly pre-fill name/dose from earlier sessions.

## Cultivar and Product Page Update — 2025-10-02

### Cultivar Page Overhaul
- Each cultivar now has a **dedicated product page**:
  - View detailed information about the cultivar (lineage, flavors, aromas, effects, notes).
  - Track **past sessions** with consumption data (method, weight, potency, rating, date).
  - See **statistics** such as average rating, total consumption, and session counts.
  - Access **purchase history**, separated into **active** and **archived purchases** with spend tracking.
  - View **cultivator breakdowns**, showing which brands you’ve tried for that cultivar, with aggregated ratings and potency stats.

### Main Cultivar Library
- Gave the **main Cultivars list** a cleaner, more consistent look:
  - Dedicated columns for **Cultivar | Type | Lineage | Added | Actions** on desktop.
  - Tighter, more compact rows for mobile.
  - Type badge now shows **next to the cultivar name on mobile** for readability.

### Codebase Adjustments
- Adjusted `firestore.ts` queries to support fetching session data, purchase history, and legacy name lookups.
- Cleaned up old helpers and improved code consistency.
- Minor **visual refinements** for spacing, typography, and badge styling.


## Purchase Tracker Update — 2025-09-26

### The Big Idea
You can now track **what you bought**, **how much you used**, **when you finished it**, and **what it cost**—all in one clean flow. When you log sessions, your active purchase **counts down automatically**. When you’re done, you can **Finish & Archive** with one click.

---

### What you’ll notice first
- **Purchases page (`/purchases`)**
  - Cards are centered, roomier, and mobile-friendly.
  - Each card shows **Potency**, **Purchased date**, **Spent**, and **$/g** in tidy pills.
  - A slick progress bar shows how much you have left.
  - Buttons match the site’s vibe (including a new blue **`.btn-secondary`** style).

- **Finish & Archive**
  - Marks the purchase **Depleted**, writes a historical snapshot, and removes it from “active.”
  - The archived item shows up in **Purchase History** views.

- **Purchase History (last 30 days)**
  - The `PurchaseHistory` component now only shows the **past 30 days**, centered with bigger summary pills:
    - **Past Purchases** · **Spent** · **Purchased** (auto-converts g → oz at 28g+).
  - Dates are shown as **MM-DD-YYYY** across purchase UI.

- **History page (`/history`)**
  - Added a **Finished Purchases** section with its own **month navigator** (Prev / This / Next).
  - Totals bar for **Purchases**, **Spent**, and **Purchased** for the selected month.
  - You can remove archive entries here too.

---

### Under the hood (but still human)
- **Auto-deduction:** logging a session reduces remaining grams on the related purchase so inventory stays honest.
- **Archive entries:** saved to `users/{uid}/entries` with:
  - `journalType: 'purchase-archive'`, `isPurchaseArchive: true`, `hiddenFromDaily: true`
  - `purchaseId` (links back to the original)
  - Finished timestamps (`purchaseFinishedDateISO` / `purchaseFinishedAtMs`) and a snapshot of grams/cost/date.
- **No more duplicates:** we merge the canonical archive and legacy hidden entries and de-dupe them by ID.
- **Firestore-safe writes:** we strip `undefined` before writing, so rules stay happy.

---

### Pages & components we touched
- `app/purchases/page.tsx` — grouped by **Type** with the same **typeBadge** style (sized like our summary pills and labeled “Flower”).
- `app/purchases/[id]/edit/page.tsx` — hydrates purchase data; styles match the new forms.
- `components/PurchaseCard.tsx` — new layout, centered name, info pills, progress gradient.
- `components/PurchaseHistory.tsx` — 30-day view, larger summary pills, centered cards.
- `app/history/page.tsx` — keeps daily sessions and now includes **Finished Purchases** with a month picker.
- **Landing page** — highlights the new Purchase Tracker (edibles info is still there, just not the headline).

---

### Styling polish
- Moved stray inline styles into CSS Modules for consistency.
- Ensured light/dark mode keep the **same sizes** (no shrinking pills in dark mode).
- New secondary button you’ll see in a few places:
  ```css
  .btn-secondary { background: #3b82f6; color: #fff; border-color: #2563eb; }
  .btn-secondary:hover { background: #2563eb; }