'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/profile');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-8">
        <h1 className="text-6xl font-bold text-gray-900">Backgammon Live</h1>
        <p className="text-xl text-gray-600">Play Backgammon online with friends</p>
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg">Login</Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline">Register</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

