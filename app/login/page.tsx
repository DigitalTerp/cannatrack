'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, User, } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read and memoize the `next` redirect param; default to /tracker
  const nextPath = useMemo(() => {
    const n = searchParams.get('next');
    try {
      return n ? decodeURIComponent(n) : '/tracker';
    } catch {
      return '/tracker';
    }
  }, [searchParams]);

  // UI state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const cantAuth = !email.includes('@') || password.length < 6;

  // If already signed in, bounce to next
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u: User | null) => {
      if (u) router.replace(nextPath);
    });
    return () => unsub();
  }, [router, nextPath]);

  async function handleAuthUser() {
    if (cantAuth || isAuthenticating) return;
    setError(null);
    setInfo(null);
    setIsAuthenticating(true);

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.push(nextPath);
    } catch (err: any) {
      setError(err?.message ?? 'Authentication failed.');
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleResetPassword() {
    setError(null);
    setInfo(null);
    if (!email || !email.includes('@')) {
      setError('Enter your email above first.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      setError(err?.message ?? 'Could not send password reset email.');
    }
  }

  return (
    <div className="container">
      <div className={styles.loginContainer}>
        {/* Title with your SVG logo + gradient text */}
        <h1 className={styles.textGradient}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.6rem' }}>
            {/* If you rename file to remove spaces, change src to /my-canna-tracker.svg */}
            <Image
              src="/My%20Canna%20Tracker.svg"
              alt="My Canna Tracker logo"
              width={36}
              height={36}
              priority
            />
            <span>MY CANNA TRACKER</span>
          </span>
        </h1>

        <h2 className={styles.subtitle}>Private, focused tracking for your sessions</h2>
        <p className={styles.tagline}>
          Log what you try, how it felt, and build your own private cultivar history.
        </p>

        <div className={styles.fullLine} />

        <h6 className={styles.formTitle}>{isRegister ? 'Create an account' : 'Log in'}</h6>

        {error && <div className={styles.errorBox}>{error}</div>}
        {info && <div className={styles.infoBox}>{info}</div>}

        <div className={styles.field}>
          <p className={styles.label}>E-mail</p>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
          />
        </div>

        <div className={styles.field}>
          <p className={styles.label}>Password</p>
          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="At least 6 characters"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
        </div>

        <button onClick={handleAuthUser} disabled={cantAuth || isAuthenticating} className={styles.submitBtn}>
          <h6>{isAuthenticating ? 'Authorizing…' : 'Submit'}</h6>
        </button>

        <div className={styles.secondaryBtnsContainer}>
          <button
            onClick={() => setIsRegister((v) => !v)}
            className={styles.cardButtonSecondary}
            type="button"
          >
            <small>{isRegister ? 'Log in' : 'Sign up'}</small>
          </button>
          <button onClick={handleResetPassword} className={styles.cardButtonSecondary} type="button">
            <small>Forgot password?</small>
          </button>
        </div>

        <div className={styles.fullLine} />

        <footer className={styles.footer}>
          <span>
            A Product Tracking Web Based App Project<br />Built with Next.js + TypeScript + Firebase
          </span>
        </footer>
      </div>
    </div>
  );
}
