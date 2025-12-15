import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth
export const authApi = {
  register: async (data: { username: string; email: string; password: string }) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },
  login: async (data: { email: string; password: string }) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Users
export const usersApi = {
  getMe: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },
  updateMe: async (data: { username?: string }) => {
    const response = await api.put('/users/me', data);
    return response.data;
  },
  getUser: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
};

// Friends
export const friendsApi = {
  search: async (query: string) => {
    const response = await api.post('/friends/search', { query });
    return response.data;
  },
  sendRequest: async (receiver_id: string) => {
    const response = await api.post('/friends/request', { receiver_id });
    return response.data;
  },
  getRequests: async () => {
    const response = await api.get('/friends/requests');
    return response.data;
  },
  acceptRequest: async (id: string) => {
    const response = await api.post(`/friends/accept/${id}`);
    return response.data;
  },
  declineRequest: async (id: string) => {
    const response = await api.post(`/friends/decline/${id}`);
    return response.data;
  },
  getFriends: async () => {
    const response = await api.get('/friends');
    return response.data;
  },
};

// Games
export const gamesApi = {
  invite: async (friend_id: string) => {
    const response = await api.post('/games/invite', { friend_id });
    return response.data;
  },
  getInvites: async () => {
    const response = await api.get('/games/invites');
    return response.data;
  },
  getMyGames: async () => {
    const response = await api.get('/games/my-games');
    return response.data;
  },
  acceptInvite: async (id: string) => {
    const response = await api.post(`/games/accept/${id}`);
    return response.data;
  },
  declineInvite: async (id: string) => {
    const response = await api.post(`/games/decline/${id}`);
    return response.data;
  },
  getGame: async (id: string) => {
    const response = await api.get(`/games/${id}`);
    return response.data;
  },
};

// Leaderboard
export const leaderboardApi = {
  getLeaderboard: async (limit?: number, offset?: number) => {
    const response = await api.get('/leaderboard', {
      params: { limit, offset },
    });
    return response.data;
  },
};

export default api;

