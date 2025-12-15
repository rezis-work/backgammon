'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/profile" className="text-xl font-bold text-gray-900">
                Backgammon Live
              </Link>
              <div className="flex space-x-4">
                <Link href="/profile" className="text-gray-700 hover:text-gray-900">
                  Profile
                </Link>
                <Link href="/friends" className="text-gray-700 hover:text-gray-900">
                  Friends
                </Link>
                <Link href="/leaderboard" className="text-gray-700 hover:text-gray-900">
                  Leaderboard
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Hello, {user.username}</span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}

