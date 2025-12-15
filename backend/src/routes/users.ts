import express from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
});

// Get user profile
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        points: users.points,
        created_at: users.created_at,
        updated_at: users.updated_at,
      })
      .from(users)
      .where(eq(users.id, req.userId!))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = updateUserSchema.parse(req.body);

    if (data.username) {
      // Check if username is taken
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.username, data.username))
        .limit(1);

      if (existingUser.length > 0 && existingUser[0].id !== req.userId) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(users.id, req.userId!))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        points: users.points,
        created_at: users.created_at,
        updated_at: users.updated_at,
      });

    res.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        points: users.points,
        created_at: users.created_at,
      })
      .from(users)
      .where(eq(users.id, req.params.id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

