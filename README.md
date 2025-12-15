# Backgammon Live Game Platform

A full-stack Backgammon game platform built with Next.js, Express.js, PostgreSQL, and Socket.io.

## Features

- User authentication (register/login)
- User profiles with points system
- Friend system (search, send/accept/decline requests)
- Game invitations
- Real-time Backgammon gameplay
- Leaderboard
- Winner gets 50 points

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), shadcn/ui, Tailwind CSS
- **Backend**: Express.js, Socket.io
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Authentication**: JWT tokens

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:

   **Backend** (`backend/.env`):
   ```
   DATABASE_URL=your_neon_postgresql_connection_string
   JWT_SECRET=your_secret_key_here
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   PORT=5000
   ```

   **Frontend** (`frontend/.env.local`):
   ```
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
   ```

4. Set up the database:
   ```bash
   cd backend
   npm run db:push
   ```

5. Run the development servers:
   ```bash
   # From root directory
   npm run dev
   ```

   Or run separately:
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
chess_platform/
├── frontend/          # Next.js application
├── backend/           # Express.js API
└── shared/           # Shared TypeScript types
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile
- `GET /api/users/:id` - Get user by ID

### Friends
- `POST /api/friends/search` - Search users
- `POST /api/friends/request` - Send friend request
- `GET /api/friends/requests` - Get friend requests
- `POST /api/friends/accept/:id` - Accept friend request
- `POST /api/friends/decline/:id` - Decline friend request
- `GET /api/friends` - Get friends list

### Games
- `POST /api/games/invite` - Send game invite
- `GET /api/games/invites` - Get game invites
- `POST /api/games/accept/:id` - Accept game invite
- `POST /api/games/decline/:id` - Decline game invite
- `GET /api/games/:id` - Get game by ID

### Leaderboard
- `GET /api/leaderboard` - Get leaderboard

## Socket.io Events

### Client → Server
- `join-game` - Join a game room
- `roll-dice` - Roll dice
- `make-move` - Make a move

### Server → Client
- `game-state` - Game state update
- `dice-rolled` - Dice roll result
- `game-over` - Game completion
- `error` - Error message

## License

MIT

