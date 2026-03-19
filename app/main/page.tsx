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
                <strong>Edible Tracking</strong> — Log gummies, chocolates, beverages, and pills in
                precise THC milligrams (mg) with strain type, and compare trends alongside flower sessions.
              </li>
              <li>
                <strong>Concentrate Support</strong> — Track flower <em>and</em> concentrates with
                categories like Cured, Live Resin, and Live Rosin, plus form details for a more accurate log.
              </li>
              <li>
                <strong>Personalized Insights</strong> — See sessions per day, total weight consumed,
                most-used types, dab trends, and top cultivars at a glance.
              </li>
              <li>
                <strong>Simple Daily Logging</strong> — Record method, weight or mg in seconds—then
                revisit your history by day.
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
         <section className={styles.heroCard} aria-labelledby="latest-updates" style={{ marginTop: 16 }}>
          <h2 id="latest-updates" className={styles.ediblesHeading}>
            <span className={styles.newBadge}>LATEST</span>
            Insights &amp; Cultivar Upgrades
          </h2>

          <p className={styles.tagline} style={{ marginTop: 8 }}>
            Today’s updates build on the concentrate rollout with better analytics and a more interactive
            cultivar library.
          </p>

          <div className={styles.features}>
            <ul>
              <li>
                <strong>Dab insights</strong> — Track dab usage in grams with charts for cultivar type,
                concentrate type, and top dab cultivars.
              </li>
              <li>
                <strong>Top Cultivar from Dabs</strong> — Quickly see which cultivar shows up the most in your dab sessions.
              </li>
              <li>
                <strong>Concentrate breakdowns</strong> — See which concentrate styles you use most across the last 30 days.
              </li>
              <li>
                <strong>Cultivar totals</strong> — The library now shows your total number of saved cultivars.
              </li>
              <li>
                <strong>Type filters</strong> — Filter your library instantly by Indica, Hybrid, or Sativa.
              </li>
            </ul>
          </div>
        </section>

        <section className={styles.heroCard} aria-labelledby="march-concentrates" style={{ marginTop: 16 }}>
          <h2 id="march-concentrates" className={styles.ediblesHeading}>
            <span className={styles.newBadge}>MARCH UPDATE</span>
            Concentrates Are Here
          </h2>

          <p className={styles.tagline} style={{ marginTop: 8 }}>
            The biggest update from the beginning of March brought full <em>concentrate support</em>
            into My Canna Tracker—so your sessions, purchases, and stash tracking now reflect more than just flower.
          </p>

          <div className={styles.features}>
            <ul>
              <li>
                <strong>Flower or Concentrate</strong> — Log the type of smokeable product you’re using.
              </li>
              <li>
                <strong>Concentrate categories</strong> — Track Cured, Live Resin, and Live Rosin.
              </li>
              <li>
                <strong>Form-aware logging</strong> — Save details like Sugar, Badder, Crumble,
                Diamonds and Sauce, Hash Rosin, and more.
              </li>
              <li>
                <strong>Purchase matching</strong> — Sessions deduct from the correct concentrate purchase
                based on type and form.
              </li>
              <li>
                <strong>Cleaner inventory tracking</strong> — Better handling for active, depleted, and archived concentrates.
              </li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  );
}