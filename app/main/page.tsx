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
                <strong>Cultivar Library</strong> — Save cultivar names with brand, lineage, THC %'s',
                effects, tastes, smell, and other notes so you can quickly recognize your favorites.
              </li>
              <li>
                <strong>Personalized Insights</strong> — See sessions per day, total weight consumed,
                and which types (Indica / Hybrid / Sativa) you reach for most. <strong>Plus More!</strong>
              </li>
              <li>
                <strong>Simple Daily Logging</strong> — Record method, weight or mg, in seconds—then revisit your history by day.
              </li>
            </ul>
          </div>

          <div className={styles.actions}>
            <button
              className={`${styles.loginBtn}`}
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

        <section className={styles.heroCard} aria-labelledby="new-edibles" style={{ marginTop: 16 }}>
          <h2 id="new-edibles" className={styles.ediblesHeading}>
            <span className={styles.newBadge}>NEW!</span>
            Edible Tracking
          </h2>

          <p className={styles.tagline} style={{ marginTop: 8 }}>
            Track THC in <em>milligrams</em> and learn which edibles you prefer.
            We support <strong>Gummy</strong>, <strong>Chocolate</strong>, <strong>Beverage</strong>, and <strong>Pill</strong>—with
            strain type (Indica / Hybrid / Sativa) for each session.
          </p>

          <div className={styles.features}>
            <ul>
              <li>
                <strong>Log exact THC mg</strong> — Know how much you actually consumed.
              </li>
              <li>
                <strong>See your edible mix</strong> — Identify the types you like (e.g., Gummy vs. Chocolate).
              </li>
              <li>
                <strong>Spot trends</strong> — Compare edible intake alongside smokeable habits for a complete picture.
              </li>
            </ul>
          </div>

          <div className={styles.actions}>
            <button
              className="btn btn-primary"
              onClick={() => router.push('/login?next=/tracker')}
            >
              Try Edible Tracking
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => router.push('/insights')}
            >
              View Insights
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
