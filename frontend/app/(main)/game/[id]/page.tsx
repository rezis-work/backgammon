'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/lib/api';
import BackgammonBoard from '@/components/game/BackgammonBoard';
import { Card, CardContent } from '@/components/ui/card';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [playerNumber, setPlayerNumber] = useState<1 | 2 | null>(null);

  useEffect(() => {
    if (!user) return;
    loadGame();
  }, [user, params.id]);

  const loadGame = async () => {
    try {
      const { game: gameData } = await gamesApi.getGame(params.id as string);
      setGame(gameData);
      
      if (gameData.status === 'pending') {
        // Accept the game invite automatically
        await gamesApi.acceptInvite(gameData.id);
        setGame({ ...gameData, status: 'active' });
      }

      // Determine player number
      if (gameData.player1_id === user?.id) {
        setPlayerNumber(1);
      } else if (gameData.player2_id === user?.id) {
        setPlayerNumber(2);
      }
    } catch (error) {
      console.error('Failed to load game:', error);
      router.push('/profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !game || !playerNumber) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading game...</div>
      </div>
    );
  }

  if (game.status !== 'active') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <p>Game is not active</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <BackgammonBoard
        gameId={game.id}
        userId={user!.id}
        playerNumber={playerNumber}
      />
    </div>
  );
}

