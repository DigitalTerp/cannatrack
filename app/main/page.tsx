'use client';

import { useRouter } from 'next/navigation';
import styles from './main.module.css';

export default function MainPage() {
  const router = useRouter();

  return (
    <div className={styles.page}>
      <div className="container">
        <section className={styles.hero}>
          {/* Text */}
          <div className={styles.copy}>
            <h1>Welcome to My Canna Tracker</h1>
            <p className="subtle">Log sessions, build your cultivar library, and learn what you love.</p>

            <div className={styles.features}>
              <ul>
                <li>Log sessions with method, weight, mood, and notes</li>
                <li>Auto-build your Cultivars library (cultivator, lineage, THC/THCA)</li>
                <li>See daily history and insights over time</li>
              </ul>
            </div>

            <div className={styles.actions}>
              <button
                className="btn btn-primary"
                onClick={() => router.push('/login?next=/tracker')}
              >
                Login to Start
              </button>
            </div>
          </div>

          <div className={styles.imgWrap}>
            <img src="/hero-img.jpg" alt="Cannabis journal hero" />
          </div>
        </section>
      </div>
    </div>
  );
}
