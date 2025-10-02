# My Canna Tracker — Next.js + TypeScript + Firebase

> _In the Jedi Order, constructing your first lightsaber marks the completion of training._  
> _This repo is my first lightsaber—my initiation into modern frontend development._

A **personalizable** web app for logging cannabis sessions, organizing cultivars, searching your history, and spotting patterns that reflect **your** preferences and routines. Built to stay out of your way and make it effortless to capture what matters.

---

## Features

- **Session Logging (fast & flexible)**  
  Capture method, weight (g), auto-timestamp, rating, notes, plus structured **Effects / Smell / Taste** fields—so your logs are both consistent and expressive.

- **Cultivar Library (auto-upserting)**  
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
  Jump via **calendar picker** or **Prev / Today / Next**. Edit/delete inline.

- **Insights (early analytics)**  
  Simple trends like **totals/means by method, weight, rating**—a foundation for richer analytics.

- **Mobile-First, Responsive UI**  
  Built for thumbs: large tap targets, native mobile inputs, accessible contrast, and a clean hamburger nav. Looks great on desktop; **optimized for phones**.

- **Auth & Data**  
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

- **My Purchase Tracker** A way of adding your Purchase and giving estimated levels of what remains for that cultivar and shows indications when it may need to be refilled for either same or alternative cultivars

- **Optional Photos/Gallery** Per session 




I’ll keep adding features and sanding off rough edges. Ideas welcome—open an issue.

## License

MIT — use, remix, and learn freely. 🌿

## Why I Built This

As a judge and a tinkerer, I wanted a tracker that adapts to me—fast to log, easy to search, and expressive enough to capture what actually matters: how it smelled, how it tasted, how it felt, and whether it’s worth revisiting.

Training complete. First lightsaber constructed. Time to explore the galaxy (of cultivars)—one personalized log at a time.

## *** Updates

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

We gave purchases the glow-up they deserve 🎉  
Here’s a quick, human-friendly tour of what changed and why it’s nice to use.

---

### The big idea
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

**September 17, 2025** 

### Forms & UI Enhancements
- **CSS Cleanup & Consistency**  
  - Introduced a shared `FormEntry.module.css` to unify styles across both **Add Entry** and **Edit Entry** forms.  
  - Removed duplicate inline styles and migrated to consistent CSS classes.  
  - Improved field spacing for better readability and usability.  

- **Personalization**  
  - Both forms now use the `niceName()` const from the tracker page to display a personalized greeting (e.g., “Hi, Keith!”).  
  - Edit form header updated to show **cultivar name** or edible entry name directly in the page title for clearer context.  

- **Mobile Responsiveness**  
  - Centered forms and action buttons on small screens.  
  - Fixed button sizing so **primary** and **ghost** buttons now scale consistently.  
  - Adjusted grids to collapse more gracefully for mobile users.

- **UI Tweaks**  
  - Added breathing room between fields to avoid cramped layouts.  
  - Improved alignment of headers and inline action buttons (Back/Cancel).  
  - Simplified redundant form headers (e.g., replaced “Log Session” with personalized or contextual alternatives).

### Insights Page Improvements
- **Weight Conversion Helper**  
  - Added `formatWeightGraph()` , `formatWeightTotal()`, and `G_PER_OZ` constants to convert **28 g = 1 oz**.  
  - Tooltips and badges now display weights as **oz (g)** once totals exceed 28 grams.  

- **UI & CSS Enhancements**  
  - Improved chart readability with spacing, font sizing, and tooltips.  
  - Updated styles to be more visually balanced and easier to scan.  

- **Ordering & Clarity**  
  - Re-ordered **Consumption Method** chart categories alphabetically.  
  - Adjusted **Cultivar Type Consumed** 

---

These changes bring a more polished, consistent, and personalized experience across session logging and insights, while making the data easier to read and understand at a glance.

**September 6, 2025** Insights, History, Tracker, Authentacticion Polish

Insights

-** Switched Sessions and Weight Consumed to Last 30 Days (was 7).

-** Added date ranges under each chart title (e.g., Sep 1 – Sep 30, 2025).

-** Added total badges:

-** Sessions chart: Total Sessions.

-** Weight chart: Total in grams.

-** Added “Most Type Consumed” badge to Cultivar Type Consumed (Indica/Hybrid/Sativa), using the same color scheme as cultivar/type badges elsewhere.

-** Added “Top Cultivar Strain” badge (shows the top strain name; badge color reflects its type).

-** Improved chart readability:

-** Dynamic bar spacing when there are many days.

-** Tick label rotation when needed.

-** Extra chart height where labels/legends require it.

-** Layout & copy:

-** Intro paragraph under “Your Consumption Log”.

-** Centered headings/subtitles/badges on mobile (and optionally centered on desktop for a consistent dashboard feel).

-** More “breathing room” around charts.

History

-** Added daily summary under the controls: Total sessions and Total grams for the selected day.

-** Streamlined entry cards layout to read more like clean key/value details (less “chip/bubble” chrome).

-** Tracker

-** New greeting (“Hi, {name}!”) with full date under “Today”.

-** Shows Amount Consumed Today with a centered badge.

-** Mobile UX: centered entry titles/badges/buttons; Log Session button is full-width on small screens.

Cultivars

-** Added a subtitle under the page title explaining the page purpose (log of all consumed cultivars, editable details, etc.).

Auth (Login / Sign Up)

-** Split the combined form into separate Login and Sign Up pages with unified styling.

-** Sign Up now collects Full Name and Username and persists to users/{uid} in Firestore.

-** Equalized secondary button sizes (e.g., Create Account / Forgot Password), refined colors to match theme.

Main (Landing)

-** Sticky bottom CTA on mobile (“Login to Start”)—full-width on small screens; inline on desktop.

-** Centered hero content on mobile.

Styles / CSS Modules

-** insights.module.css: stats bar spacing, centered mobile layout, chart “breathing room,” tall charts for rotated labels, consistent badge sizing.

-** DailyLog.module.css: mobile centering for name line, meta chips, and action buttons; full-width “Log Session” button on small screens.

-**tracker.module.css: greeting/date/consumed-today sections centered and tidy on mobile, consistent spacing.

General polish to align badges and headings across pages.

**September 10, 2025** Major Update — Personalization, Edibles, Landing Refresh, Cleanup

This release marks one of the biggest updates to *My Canna Tracker* yet. 🎉

**Highlights**

- **Personalized Menu**
  - Mobile drawer now greets you by your registered username.
  - Inline reminder if it’s not your account, with a quick logout link.
  - Adds a friendlier, more “yours” feel across navigation.

- **NEW! Edible Tracking**
  - Dedicated entry form for edibles (Gummy, Chocolate, Beverage, Pill).
  - Track THC dosage in **mg** alongside type (Indica/Hybrid/Sativa).
  - Edibles are excluded from cultivar graphs to keep analytics clean.
  - Insights now include **Edible Intake** charts (mg totals + type mix).
  - History cards display **edible type** + dose for each entry.

- **Main Landing Page Overhaul**
  - No global header — focused **welcome screen** with larger centered logo.
  - New explanatory copy highlighting features.
  - Separate **“NEW! Edible Tracking” section** with badge styling.
  - Cleaner actions: green primary **Login** button + subtle line-style **Create Account** button.

- **Tracker / History Enhancements**
  - Tracker shows **grams** *and* **edible mg** consumed today.
  - History smokeable entries now display **THC%**.
  - Entry cards more consistent with badges for method, weight, THC%, time.

- **Insights Expansion**
  - Added edible-specific graphs showing mg totals by day and type.
  - Cultivar charts now exclude edible sessions (clarity in analytics).
  - Additional badges: **Most Consumed Type**, **Most Consumed Edible Type**.

- **General Cleanup**
  - Consolidated inline styles into `main.module.css` and other CSS modules.
  - Created dedicated icon components (`HamburgerIcon`, `XIcon`).
  - Simplified badge layouts, improved chart readability, and unified spacing.
  - Codebase refactors for readability and maintainability.

This update makes My Canna Tracker more personal, more useful for edible consumers, and more polished overall.