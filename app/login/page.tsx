import LoginClient from './LoginClient';

export default function Page({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const nextPath = searchParams?.next ?? '/tracker';
  return <LoginClient nextPath={nextPath} />;
}
