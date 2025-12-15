import express from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { desc } from 'drizzle-orm';

const router = express.Router();

// Get leaderboard
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const leaderboard = await db
      .select({
        id: users.id,
        username: users.username,
        points: users.points,
      })
      .from(users)
      .orderBy(desc(users.points))
      .limit(limit)
      .offset(offset);

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

