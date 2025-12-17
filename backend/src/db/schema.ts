import { pgTable, uuid, varchar, integer, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  points: integer('points').default(0).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const friendRequestStatusEnum = pgEnum('friend_request_status', ['pending', 'accepted', 'declined']);

export const friend_requests = pgTable('friend_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  sender_id: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiver_id: uuid('receiver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: friendRequestStatusEnum('status').default('pending').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const friends = pgTable('friends', {
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  friend_id: uuid('friend_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const gameStatusEnum = pgEnum('game_status', ['pending', 'active', 'completed']);
export const gameTypeEnum = pgEnum('game_type', ['backgammon', 'dice']);

export const games = pgTable('games', {
  id: uuid('id').defaultRandom().primaryKey(),
  player1_id: uuid('player1_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  player2_id: uuid('player2_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  game_type: gameTypeEnum('game_type').default('backgammon').notNull(),
  status: gameStatusEnum('status').default('pending').notNull(),
  winner_id: uuid('winner_id').references(() => users.id, { onDelete: 'set null' }),
  points_awarded: integer('points_awarded').default(0).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'),
});

export const game_moves = pgTable('game_moves', {
  id: uuid('id').defaultRandom().primaryKey(),
  game_id: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  player_id: uuid('player_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  move_data: jsonb('move_data').notNull(),
  move_number: integer('move_number').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sentFriendRequests: many(friend_requests),
  receivedFriendRequests: many(friend_requests),
  friends: many(friends),
  gamesAsPlayer1: many(games),
  gamesAsPlayer2: many(games),
  gameMoves: many(game_moves),
}));

