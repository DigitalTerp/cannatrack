'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import HamburgerIcon from '@/components/icons/HamburgerIcon';
import Xicon from '@/components/icons/XIcon';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

/* Friendly fallback if username not set */
function fallbackNiceName(u: User | null): string {
  const fromProfile = u?.displayName?.trim();
  if (fromProfile) return fromProfile;
  const email = u?.email || '';
  const raw = email.split('@')[0] || 'there';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function HeaderBar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setUsername(null);
        return;
      }
      try {
        // Fetch username from Firestore: /users/{uid} -> { username: string }
        const snap = await getDoc(doc(db, 'users', u.uid));
        const name = snap.exists() ? (snap.data()?.username as string | undefined) : undefined;
        setUsername(name && name.trim() ? name.trim() : null);
      } catch {
        setUsername(null);
      }
    });
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

  const display = username || fallbackNiceName(user);

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

      <div
        id="mobile-drawer"
        className={`drawer ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
      >
        <div className="drawer-header">
          <div style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}>
            <Image src="/My%20Canna%20Tracker.svg" alt="Logo" width={25} height={25} priority />
            Menu
          </div>

          <button className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
            <Xicon size={22} />
          </button>
        </div>

        {user && (
          <div
            className="drawer-user"
            style={{
              padding: '0 1rem 0.75rem 1rem',
              borderBottom: '1px solid var(--border-color, #2a2f3a)',
              marginBottom: '0.5rem',
            }}
          >
            <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 2 }}>
              Welcome, {display} 👋
            </div>
          </div>
        )}

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
