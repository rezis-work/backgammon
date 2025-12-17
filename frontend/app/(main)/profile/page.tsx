'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, gamesApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [gameInvites, setGameInvites] = useState<any[]>([]);
  const [myGames, setMyGames] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      loadInvites();
      loadMyGames();
    }
  }, [user]);

  const loadInvites = async () => {
    try {
      const { invites } = await gamesApi.getInvites();
      setGameInvites(invites);
    } catch (error) {
      console.error('Failed to load invites:', error);
    }
  };

  const loadMyGames = async () => {
    try {
      const { games } = await gamesApi.getMyGames();
      setMyGames(games);
    } catch (error) {
      console.error('Failed to load my games:', error);
    }
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersApi.updateMe({ username });
      await refreshUser();
    } catch (error) {
      console.error('Failed to update username:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input value={user.email} disabled />
          </div>
          <form onSubmit={handleUpdateUsername} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              Update Username
            </Button>
          </form>
          <div>
            <label className="block text-sm font-medium mb-1">Points</label>
            <div className="text-2xl font-bold text-primary">{user.points}</div>
          </div>
        </CardContent>
      </Card>

      {gameInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Game Invites</CardTitle>
            <CardDescription>You have {gameInvites.length} pending game invite(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {gameInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{invite.player1.username} invited you to play {invite.game_type === 'dice' ? 'Dice' : 'Backgammon'}</p>
                    <p className="text-sm text-gray-500">Click Accept to start the game</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await gamesApi.acceptInvite(invite.id);
                          window.location.href = `/game/${invite.id}`;
                        } catch (error) {
                          console.error('Failed to accept invite:', error);
                          toast.error('Failed to accept invite. Please try again.');
                        }
                      }}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await gamesApi.declineInvite(invite.id);
                          await loadInvites();
                          await loadMyGames();
                        } catch (error) {
                          console.error('Failed to decline invite:', error);
                          toast.error('Failed to decline invite. Please try again.');
                        }
                      }}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {myGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>My Games</CardTitle>
            <CardDescription>Games you're involved in</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myGames.map((game) => (
                <div key={game.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">
                      {game.isPlayer1 
                        ? `You invited ${game.opponent.username} to play`
                        : `Playing with ${game.opponent.username}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      Status: {game.status === 'pending' ? 'Waiting for acceptance' : 'Active'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {game.status === 'active' ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          window.location.href = `/game/${game.id}`;
                        }}
                      >
                        Join Game
                      </Button>
                    ) : game.isPlayer1 ? (
                      <span className="text-sm text-gray-500">Waiting for opponent...</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

