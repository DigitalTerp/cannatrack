'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getEntry } from '@/lib/firestore';
import type { Entry } from '@/lib/types';
import EditEntryForm from '@/components/EditEntryForm';

export default function EditEntryPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // WATCH AUTH STATE
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // if not logged in (after auth known), send to login w/ redirect back
  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace(`/login?next=/entries/${id}/edit`);
  }, [authReady, user, id, router]);

  // load the entry
  useEffect(() => {
    (async () => {
      if (!user || !id) return;
      try {
        setLoading(true);
        setErr(null);
        const e = await getEntry(user.uid, id);
        if (!e) {
          setErr('Not found or no access.');
          setEntry(null);
        } else {
          setEntry(e);
        }
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load entry.');
        setEntry(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, id]);

  if (!authReady) {
    return (
      <div className="container">
        <div className="card">Checking authentication…</div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="container">
      <div className="page-hero">
        <h1>Edit Session</h1>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={() => router.push('/tracker')}>
            Cancel
          </button>
        </div>
      </div>

      {loading && <div className="card">Loading…</div>}

      {err && !loading && (
        <div className="card">
          <p className="error" style={{ marginBottom: '0.75rem' }}>{err}</p>
          <button className="btn btn-ghost" onClick={() => router.push('/tracker')}>
            Back to Daily Tracker
          </button>
        </div>
      )}

      {!loading && !err && entry && (
        <EditEntryForm entry={entry} />
      )}
    </div>
  );
}
