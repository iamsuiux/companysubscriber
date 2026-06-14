'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/ui/Sidebar';
import { MobileMenu } from '@/components/ui/MobileMenu';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Toaster } from '@/components/ui/toaster';

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
    <>
      <Toaster />
      <div className="flex h-screen flex-col md:flex-row">
        {/* Desktop Sidebar - Hidden on Mobile */}
        <div className="hidden md:block">
          <Sidebar username={username!} />
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden w-full">
          <MobileMenu username={username!} />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-gray-50">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
