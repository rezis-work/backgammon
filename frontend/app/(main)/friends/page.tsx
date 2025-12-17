'use client';

import { useEffect, useState } from 'react';
import { friendsApi, gamesApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function FriendsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, []);

  const loadFriends = async () => {
    try {
      const { friends: friendsList } = await friendsApi.getFriends();
      setFriends(friendsList);
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

  const loadRequests = async () => {
    try {
      const data = await friendsApi.getRequests();
      setRequests(data);
    } catch (error) {
      console.error('Failed to load requests:', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const { users } = await friendsApi.search(searchQuery);
      setSearchResults(users);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await friendsApi.sendRequest(userId);
      await loadRequests();
      setSearchResults([]);
      setSearchQuery('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send request');
    }
  };

  const handleAcceptRequest = async (id: string) => {
    try {
      await friendsApi.acceptRequest(id);
      await loadRequests();
      await loadFriends();
    } catch (error) {
      console.error('Failed to accept request:', error);
    }
  };

  const handleDeclineRequest = async (id: string) => {
    try {
      await friendsApi.declineRequest(id);
      await loadRequests();
    } catch (error) {
      console.error('Failed to decline request:', error);
    }
  };

  const handleInviteToGame = async (friendId: string, gameType: 'backgammon' | 'dice' = 'backgammon') => {
    try {
      const { game } = await gamesApi.invite(friendId, gameType);
      toast.success(`${gameType === 'dice' ? 'Dice' : 'Backgammon'} game invite sent!`, {
        duration: 4000,
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send game invite');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search Users</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username..."
            />
            <Button type="submit" disabled={loading}>
              Search
            </Button>
          </form>
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{user.username}</p>
                    <p className="text-sm text-gray-500">{user.points} points</p>
                  </div>
                  <Button size="sm" onClick={() => handleSendRequest(user.id)}>
                    Add Friend
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Friend Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Incoming Requests</h3>
            {requests.incoming.length === 0 ? (
              <p className="text-sm text-gray-500">No incoming requests</p>
            ) : (
              <div className="space-y-2">
                {requests.incoming.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{req.sender.username}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAcceptRequest(req.id)}>
                        Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeclineRequest(req.id)}>
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-medium mb-2">Outgoing Requests</h3>
            {requests.outgoing.length === 0 ? (
              <p className="text-sm text-gray-500">No outgoing requests</p>
            ) : (
              <div className="space-y-2">
                {requests.outgoing.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{req.receiver.username}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Pending</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Friends</CardTitle>
        </CardHeader>
        <CardContent>
          {friends.length === 0 ? (
            <p className="text-sm text-gray-500">No friends yet</p>
          ) : (
            <div className="space-y-2">
              {friends.map((friend) => (
                <div key={friend.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{friend.username}</p>
                    <p className="text-sm text-gray-500">{friend.points} points</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleInviteToGame(friend.id, 'backgammon')}>
                      Backgammon
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleInviteToGame(friend.id, 'dice')}>
                      Dice
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

