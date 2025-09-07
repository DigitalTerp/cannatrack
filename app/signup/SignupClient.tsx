'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import styles from './signup.module.css';

export default function SignUpPage() {
  const router = useRouter();

  // form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState(''); // unique-ish handle you store in Firestore
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ui state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // if already logged in, bounce to tracker
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u: User | null) => {
      if (u) router.replace('/tracker');
    });
    return () => unsub();
  }, [router]);

  const canSubmit =
    fullName.trim().length >= 2 &&
    username.trim().length >= 2 &&
    email.includes('@') &&
    password.length >= 6;

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setError(null);
    setInfo(null);
    setIsSubmitting(true);

    try {
      // 1) Create the Auth user
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      // 2) (Optional) Set displayName on Auth
      await updateProfile(cred.user, { displayName: fullName.trim() });

      // 3) Create/merge the Firestore user profile (this is the “step 3” placement)
      await setDoc(
        doc(db, 'users', cred.user.uid),
        {
          fullName: fullName.trim(),
          username: username.trim(),
          email: cred.user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setInfo('Account created successfully! Redirecting…');
      router.push('/tracker');
    } catch (err: any) {
      // Friendly error message
      if (err?.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err?.code === 'permission-denied') {
        setError('Missing or insufficient permissions to create your profile.');
      } else {
        setError(err?.message ?? 'Failed to create an account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container">
      <div className={styles.loginContainer}>
        {/* Brand header (matches Login) */}
        <h1 className={styles.textGradient}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Image
              src="/My%20Canna%20Tracker.svg"
              alt="My Canna Tracker logo"
              width={36}
              height={36}
              priority
            />
            <span className="brand-gradient">MY CANNA TRACKER</span>
          </span>
        </h1>

        <h2 className={styles.subtitle}>Create your account</h2>
        <p className={styles.tagline}>
          Sign up to start logging sessions, tracking cultivars, and building your private history.
        </p>

        <div className={styles.fullLine} />

        <h6 className={styles.formTitle}>Sign up</h6>

        {error && <div className={styles.errorBox}>{error}</div>}
        {info && <div className={styles.infoBox}>{info}</div>}

        <form onSubmit={handleSignUp}>
          <div className={styles.field}>
            <p className={styles.label}>Name</p>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g., Jane"
              autoComplete="name"
            />
          </div>

          <div className={styles.field}>
            <p className={styles.label}>Username</p>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., janedoe"
              autoComplete="username"
            />
          </div>

          <div className={styles.field}>
            <p className={styles.label}>E-mail</p>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <p className={styles.label}>Password</p>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
          </div>

          <button type="submit" disabled={!canSubmit || isSubmitting} className={styles.submitBtn}>
            <h6>{isSubmitting ? 'Creating…' : 'CREATE ACCOUNT'}</h6>
          </button>
        </form>

        <div className={styles.secondaryBtnsContainer}>
          <Link href="/login" className={styles.cardButtonSecondary}>
            <small>Have an account? Log in</small>
          </Link>
          <Link href="/login?reset=1" className={styles.cardButtonSecondary}>
            <small>Forgot password?</small>
          </Link>
        </div>

        <div className={styles.fullLine} />

        <footer className={styles.footer}>
          <span>
            A Product Tracking Web Based App Project
            <br />
            Built with Next.js + TypeScript + Firebase
          </span>
        </footer>
      </div>
    </div>
  );
}
