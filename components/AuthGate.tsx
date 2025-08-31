'use client';
import { ReactNode, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegister, setIsRegister] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message ?? 'Authentication error');
    }
  };

  if (loading) return <div className="container-page py-10">Loading...</div>;

  if (!user) {
    return (
      <div className="container-page py-16 flex justify-center">
        <div className="card p-8 w-full max-w-md">
          <h1 className="text-2xl font-semibold mb-4 text-center">
            {isRegister ? 'Create Account' : 'Sign In'}
          </h1>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn btn-primary" type="submit">
              {isRegister ? 'Register' : 'Sign In'}
            </button>
          </form>
          <p className="text-sm text-gray-600 mt-4 text-center">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button type="button" className="underline text-green-700" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? 'Sign in' : 'Register'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
        <div className="container-page flex items-center justify-between py-4">
          <a href="/" className="font-semibold">Cannabis Tracker</a>
          <nav className="flex items-center gap-2">
            <a className="btn btn-ghost" href="/entries/new">Log Session</a>
            <a className="btn btn-ghost" href="/history">History</a>
            <a className="btn btn-ghost" href="/insights">Insights</a>
            <a className="btn btn-ghost" href="/strains">Strains</a>
            <button className="btn" onClick={() => signOut(auth)}>Sign Out</button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
