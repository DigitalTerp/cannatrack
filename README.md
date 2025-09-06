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

- **Richer Insights** (per-method breakdowns, cultivar scoring, dose totals by time of day)

- **CSV Import/Export**

- **Tagging & Advanced Filters** (sessions & cultivars)

- **Favorites / Pinning** (Quick access to go-to cultivars)

- **User Settings** (Default method/dose, preferred units)

- **Optional Photos/Gallery** Per session


I’ll keep adding features and sanding off rough edges. Ideas welcome—open an issue.

## License

MIT — use, remix, and learn freely. 🌿

## Why I Built This

As a judge and a tinkerer, I wanted a tracker that adapts to me—fast to log, easy to search, and expressive enough to capture what actually matters: how it smelled, how it tasted, how it felt, and whether it’s worth revisiting.

Training complete. First lightsaber constructed. Time to explore the galaxy (of cultivars)—one personalized log at a time.

## *** Updates

- **September 6, 2025**

- **History Page**

Added per-day totals beneath the date controls:

Total Sessions for the selected day

Total Weight (g) consumed for the selected day

Cleaned up the entry detail layout (centered, simpler text presentation, consistent actions).

- **Insights/Analytics**

Added an intro paragraph under Your Consumption Log explaining what the page shows.

- **Last 7 Days stats bar**

Added Display for Date Range

Badges for total sessions and total grams

Sessions and Weight Consumed charts are now Last 30 Days (was 7).

Subtitles added to every chart to better explain what you’re seeing.

- **Badges added**

Sessions (30d): total sessions badge + date range

Weight Consumed (30d): total grams badge + date range

Cultivar Type Consumed (30d): Most Preferred Type badge (based on recent data)

Top Cultivars (Last 30 Days): dual-series bar chart shows sessions and grams per cultivar.

- **Chart UX polish**

Improved spacing/margins and centered headings/subtext on mobile; better axis label readability.