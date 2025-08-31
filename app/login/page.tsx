import { Suspense } from 'react';
import LoginClient from './LoginClient';

type SearchParams = { [key: string]: string | string[] | undefined };

export default function LoginPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const raw = searchParams?.next;
  const nextPath =
    typeof raw === 'string' && raw.length > 0
      ? raw
      : Array.isArray(raw) && raw.length > 0
      ? raw[0]
      : '/tracker';

  return (
    <Suspense fallback={null}>
      <LoginClient nextPath={nextPath} />
    </Suspense>
  );
}