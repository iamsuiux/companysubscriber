'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/ui/Sidebar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (!data.data?.user) {
          router.push('/login');
          return;
        }
        setUsername(data.data.user.username);
        setLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar username={username!} />
      <main className="flex-1 overflow-auto p-6 bg-gray-50">{children}</main>
    </div>
  );
}
