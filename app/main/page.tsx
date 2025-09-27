'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from './main.module.css';

export default function MainPage() {
  const router = useRouter();

  return (
    <div className={styles.page}>
      <div className={styles.centerWrap}>

        <section className={styles.heroCard} aria-labelledby="welcome-title">
          <div className={styles.brandCol}>
            <Image
              src="/My%20Canna%20Tracker.svg"
              alt="My Canna Tracker logo"
              width={140}
              height={140}
              priority
              className={styles.logo}
            />
            <h1 id="welcome-title" className={styles.title}>
              <span style={{ color: '#e5e7eb', fontWeight: 400 }}>Welcome to,</span>{' '}
              <span style={{ display: 'inline-block' }}>My Canna Tracker</span>
            </h1>
          </div>

          <p className={styles.tagline}>
            Your personal log for understanding what works for you!
          </p>

          <div className={styles.features}>
            <ul>
              <li>
                <strong>Cultivar Library</strong> — Save cultivar names with brand, lineage, THC %’s,
                effects, tastes, smell, and other notes so you can quickly recognize your favorites.
              </li>
              <li>
              <strong>Edible Tracking</strong> — Log gummies, chocolates, beverages, and pills in precise THC milligrams (mg) 
              with strain type, and compare trends alongside flower sessions.
              </li>

              <li>
                <strong>Personalized Insights</strong> — See sessions per day, total weight consumed,
                and which types (Indica / Hybrid / Sativa) you reach for most. <strong>Plus More!</strong>
              </li>
              <li>
                <strong>Simple Daily Logging</strong> — Record method, weight or mg in seconds—then revisit your history by day.
              </li>
            </ul>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.loginBtn}
              onClick={() => router.push('/login?next=/tracker')}
            >
              LOG IN
            </button>
            <button
              className={styles.lineBtn}
              onClick={() => router.push('/signup')}
            >
              Don’t have an account?
            </button>
          </div>
        </section>

        <section className={styles.heroCard} aria-labelledby="new-purchases" style={{ marginTop: 16 }}>
          <h2 id="new-purchases" className={styles.ediblesHeading}>
            <span className={styles.newBadge}>NEW!</span>
            Purchase Tracker
          </h2>

          <p className={styles.tagline} style={{ marginTop: 8 }}>
            Track your stash from <em>purchase to finish</em> with live inventory, potency and spend,
            auto-archiving, and a clean 30-day history view.
          </p>

          <div className={styles.features}>
            <ul>
              <li>
                <strong>Log purchases fast</strong> — Cultivar, Amount, Cost, Dates, and optional potency.
              </li>
              <li>
                <strong>Live inventory</strong> — See remaining vs. total with a colorful progress bar.
              </li>
              <li>
                <strong>Finish &amp; archive</strong> — One click to archive with clear history cards.
              </li>
              <li>
                <strong>30-day overview</strong> — Totals for purchases, amount spent, and quantity (grams/ounces).
              </li>
            </ul>
          </div>

          <div className={styles.actions}>
            <button
              className="btn btn-primary"
              onClick={() => router.push('/login?next=/purchases')}
            >
              Open Purchase Tracker
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
