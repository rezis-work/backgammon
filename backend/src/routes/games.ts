import express from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { games, users } from '../db/schema.js';
import { eq, and, or } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const inviteSchema = z.object({
  friend_id: z.string().uuid(),
});

// Send game invite
router.post('/invite', authenticate, async (req: AuthRequest, res) => {
  try {
    const { friend_id } = inviteSchema.parse(req.body);

    if (friend_id === req.userId) {
      return res.status(400).json({ error: 'Cannot invite yourself' });
    }

    // Check if friend exists
    const [friend] = await db
      .select()
      .from(users)
      .where(eq(users.id, friend_id))
      .limit(1);

    if (!friend) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if there's already a pending game
    const existingGame = await db
      .select()
      .from(games)
      .where(
        and(
          or(
            and(eq(games.player1_id, req.userId!), eq(games.player2_id, friend_id)),
            and(eq(games.player1_id, friend_id), eq(games.player2_id, req.userId!))
          ),
          eq(games.status, 'pending')
        )
      )
      .limit(1);

    if (existingGame.length > 0) {
      return res.status(400).json({ error: 'Game invite already exists' });
    }

    // Create game invite
    const [game] = await db
      .insert(games)
      .values({
        player1_id: req.userId!,
        player2_id: friend_id,
        status: 'pending',
      })
      .returning();

    res.status(201).json({ game });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Send game invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get game invites (incoming - where user is player2)
router.get('/invites', authenticate, async (req: AuthRequest, res) => {
  try {
    const pendingInvites = await db
      .select({
        id: games.id,
        player1_id: games.player1_id,
        player2_id: games.player2_id,
        status: games.status,
        created_at: games.created_at,
        player1: {
          id: users.id,
          username: users.username,
          points: users.points,
        },
      })
      .from(games)
      .innerJoin(users, eq(games.player1_id, users.id))
      .where(and(
        eq(games.player2_id, req.userId!),
        eq(games.status, 'pending')
      ));

    res.json({ invites: pendingInvites });
  } catch (error) {
    console.error('Get game invites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get my games (games where user is player1 or player2, pending or active)
router.get('/my-games', authenticate, async (req: AuthRequest, res) => {
  try {
    // Get games where user is player1
    const gamesAsPlayer1 = await db
      .select({
        id: games.id,
        player1_id: games.player1_id,
        player2_id: games.player2_id,
        status: games.status,
        created_at: games.created_at,
        opponent: {
          id: users.id,
          username: users.username,
          points: users.points,
        },
      })
      .from(games)
      .innerJoin(users, eq(games.player2_id, users.id))
      .where(and(
        eq(games.player1_id, req.userId!),
        or(
          eq(games.status, 'pending'),
          eq(games.status, 'active')
        )
      ));

    // Get games where user is player2
    const gamesAsPlayer2 = await db
      .select({
        id: games.id,
        player1_id: games.player1_id,
        player2_id: games.player2_id,
        status: games.status,
        created_at: games.created_at,
        opponent: {
          id: users.id,
          username: users.username,
          points: users.points,
        },
      })
      .from(games)
      .innerJoin(users, eq(games.player1_id, users.id))
      .where(and(
        eq(games.player2_id, req.userId!),
        eq(games.status, 'active')
      ));

    // Combine and format
    const allGames = [
      ...gamesAsPlayer1.map(g => ({ ...g, isPlayer1: true })),
      ...gamesAsPlayer2.map(g => ({ ...g, isPlayer1: false }))
    ];

    res.json({ games: allGames });
  } catch (error) {
    console.error('Get my games error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept game invite
router.post('/accept/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const gameId = req.params.id;

    const [game] = await db
      .select()
      .from(games)
      .where(and(
        eq(games.id, gameId),
        eq(games.player2_id, req.userId!),
        eq(games.status, 'pending')
      ))
      .limit(1);

    if (!game) {
      return res.status(404).json({ error: 'Game invite not found' });
    }

    // Update game status to active
    const [updatedGame] = await db
      .update(games)
      .set({
        status: 'active',
        updated_at: new Date(),
      })
      .where(eq(games.id, gameId))
      .returning();

    res.json({ game: updatedGame });
  } catch (error) {
    console.error('Accept game invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Decline game invite
router.post('/decline/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const gameId = req.params.id;

    const [game] = await db
      .select()
      .from(games)
      .where(and(
        eq(games.id, gameId),
        eq(games.player2_id, req.userId!),
        eq(games.status, 'pending')
      ))
      .limit(1);

    if (!game) {
      return res.status(404).json({ error: 'Game invite not found' });
    }

    // Delete the game invite
    await db.delete(games).where(eq(games.id, gameId));

    res.json({ message: 'Game invite declined' });
  } catch (error) {
    console.error('Decline game invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get game by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const [game] = await db
      .select({
        id: games.id,
        player1_id: games.player1_id,
        player2_id: games.player2_id,
        status: games.status,
        winner_id: games.winner_id,
        points_awarded: games.points_awarded,
        created_at: games.created_at,
        updated_at: games.updated_at,
        completed_at: games.completed_at,
      })
      .from(games)
      .where(eq(games.id, req.params.id))
      .limit(1);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if user is part of the game
    if (game.player1_id !== req.userId && game.player2_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to view this game' });
    }

    res.json({ game });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

