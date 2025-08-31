'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

/* Hamburger Menu Icon */
function HamburgerIcon({ open, size = 28 }: { open: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill='transparent'
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`icon-hamburger ${open ? 'is-open' : ''}`}
    >
      <line x1="4" y1="7"  x2="20" y2="7"  className="bar bar-top" />
      <line x1="4" y1="12" x2="20" y2="12" className="bar bar-mid" />
      <line x1="4" y1="17" x2="20" y2="17" className="bar bar-bot" />
    </svg>
  );
}

/* X icon for closing the drawer */
function XIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function HeaderBar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  const go = useCallback((path: string) => {
    router.push(path);
    setOpen(false);
  }, [router]);

  const goLogSession = useCallback(() => {
    if (auth.currentUser) go('/entries/new');
    else go('/login?next=/entries/new');
  }, [go]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } finally {
      setOpen(false);
      router.push('/main');
    }
  }, [router]);

  // Close drawer with Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <div className="header-row">
            <button
              className="hamburger"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="mobile-drawer"
              onClick={() => setOpen(v => !v)}
            >
              <HamburgerIcon open={open} size={28} />
            </button>

            <h1 className="site-title">
              <Link href="/" aria-label="Go to start">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}>
                  <Image src="/My%20Canna%20Tracker.svg" alt="My Canna Tracker logo" width={24} height={24} priority />
                  <span className="brand-gradient">MY CANNA TRACKER</span>
                </span>
              </Link>
            </h1>

            <div style={{ width: 56, height: 1 }} />
          </div>

          {/* Desktop nav only */}
          <nav className="site-nav desktop-only">
            <button className="btn btn-primary" onClick={goLogSession}>Log Session</button>
            <a className="btn btn-ghost" href="/tracker">Daily</a>
            <a className="btn btn-ghost" href="/strains">Cultivars</a>
            <a className="btn btn-ghost" href="/history">History</a>
            <a className="btn btn-ghost" href="/insights">Insights</a>

            {user ? (
              <button className="btn btn-ghost logout-btn" onClick={handleLogout}>Logout</button>
            ) : (
              <button className="btn btn-ghost" onClick={() => go('/login')}>Login</button>
            )}
          </nav>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div id="mobile-drawer" className={`drawer ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Main menu">
        <div className="drawer-header">
          <div style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}>
            <Image src="/My%20Canna%20Tracker.svg" alt="Logo" width={25} height={25} priority />
            Menu
          </div>

          <button className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
            <XIcon size={22} />
          </button>
        </div>

        <nav className="drawer-nav">
          <a href="/tracker" className="drawer-link" onClick={() => setOpen(false)}>Daily</a>
          <a href="/strains" className="drawer-link" onClick={() => setOpen(false)}>Cultivars</a>
          <a href="/history" className="drawer-link" onClick={() => setOpen(false)}>History</a>
          <a href="/insights" className="drawer-link" onClick={() => setOpen(false)}>Insights</a>

          <button className="btn btn-primary" onClick={goLogSession}>
            Log Session
          </button>

          {user ? (
            <button className="btn btn-ghost logout-btn" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={() => go('/login')}>
              Login
            </button>
          )}
        </nav>
      </div>

      <div
        className={`backdrop ${open ? 'show' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />
    </>
  );
}
