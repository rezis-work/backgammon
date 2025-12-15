import express from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, friend_requests, friends } from '../db/schema.js';
import { eq, and, or, ilike } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const searchSchema = z.object({
  query: z.string().min(1),
});

const friendRequestSchema = z.object({
  receiver_id: z.string().uuid(),
});

// Search users
router.post('/search', authenticate, async (req: AuthRequest, res) => {
  try {
    const { query } = searchSchema.parse(req.body);

    const results = await db
      .select({
        id: users.id,
        username: users.username,
        points: users.points,
      })
      .from(users)
      .where(ilike(users.username, `%${query}%`))
      .limit(20);

    // Exclude current user
    const filtered = results.filter(u => u.id !== req.userId);

    res.json({ users: filtered });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send friend request
router.post('/request', authenticate, async (req: AuthRequest, res) => {
  try {
    const { receiver_id } = friendRequestSchema.parse(req.body);

    if (receiver_id === req.userId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check if receiver exists
    const [receiver] = await db
      .select()
      .from(users)
      .where(eq(users.id, receiver_id))
      .limit(1);

    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already friends
    const existingFriendship = await db
      .select()
      .from(friends)
      .where(
        or(
          and(eq(friends.user_id, req.userId!), eq(friends.friend_id, receiver_id)),
          and(eq(friends.user_id, receiver_id), eq(friends.friend_id, req.userId!))
        )
      )
      .limit(1);

    if (existingFriendship.length > 0) {
      return res.status(400).json({ error: 'Already friends' });
    }

    // Check if request already exists
    const existingRequest = await db
      .select()
      .from(friend_requests)
      .where(
        and(
          or(
            and(eq(friend_requests.sender_id, req.userId!), eq(friend_requests.receiver_id, receiver_id)),
            and(eq(friend_requests.sender_id, receiver_id), eq(friend_requests.receiver_id, req.userId!))
          ),
          eq(friend_requests.status, 'pending')
        )
      )
      .limit(1);

    if (existingRequest.length > 0) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    // Create friend request
    const [request] = await db
      .insert(friend_requests)
      .values({
        sender_id: req.userId!,
        receiver_id,
        status: 'pending',
      })
      .returning();

    res.status(201).json({ request });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friend requests
router.get('/requests', authenticate, async (req: AuthRequest, res) => {
  try {
    const incoming = await db
      .select({
        id: friend_requests.id,
        sender_id: friend_requests.sender_id,
        receiver_id: friend_requests.receiver_id,
        status: friend_requests.status,
        created_at: friend_requests.created_at,
        sender: {
          id: users.id,
          username: users.username,
          points: users.points,
        },
      })
      .from(friend_requests)
      .innerJoin(users, eq(friend_requests.sender_id, users.id))
      .where(and(
        eq(friend_requests.receiver_id, req.userId!),
        eq(friend_requests.status, 'pending')
      ));

    const outgoing = await db
      .select({
        id: friend_requests.id,
        sender_id: friend_requests.sender_id,
        receiver_id: friend_requests.receiver_id,
        status: friend_requests.status,
        created_at: friend_requests.created_at,
        receiver: {
          id: users.id,
          username: users.username,
          points: users.points,
        },
      })
      .from(friend_requests)
      .innerJoin(users, eq(friend_requests.receiver_id, users.id))
      .where(and(
        eq(friend_requests.sender_id, req.userId!),
        eq(friend_requests.status, 'pending')
      ));

    res.json({
      incoming,
      outgoing,
    });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept friend request
router.post('/accept/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const requestId = req.params.id;

    const [request] = await db
      .select()
      .from(friend_requests)
      .where(and(
        eq(friend_requests.id, requestId),
        eq(friend_requests.receiver_id, req.userId!),
        eq(friend_requests.status, 'pending')
      ))
      .limit(1);

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Update request status
    await db
      .update(friend_requests)
      .set({ status: 'accepted' })
      .where(eq(friend_requests.id, requestId));

    // Create friendship (both directions)
    await db.insert(friends).values([
      { user_id: request.sender_id, friend_id: request.receiver_id },
      { user_id: request.receiver_id, friend_id: request.sender_id },
    ]);

    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Decline friend request
router.post('/decline/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const requestId = req.params.id;

    const [request] = await db
      .select()
      .from(friend_requests)
      .where(and(
        eq(friend_requests.id, requestId),
        eq(friend_requests.receiver_id, req.userId!),
        eq(friend_requests.status, 'pending')
      ))
      .limit(1);

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Update request status
    await db
      .update(friend_requests)
      .set({ status: 'declined' })
      .where(eq(friend_requests.id, requestId));

    res.json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Decline friend request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friends list
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userFriends = await db
      .select({
        id: users.id,
        username: users.username,
        points: users.points,
        created_at: friends.created_at,
      })
      .from(friends)
      .innerJoin(users, eq(friends.friend_id, users.id))
      .where(eq(friends.user_id, req.userId!));

    res.json({ friends: userFriends });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

