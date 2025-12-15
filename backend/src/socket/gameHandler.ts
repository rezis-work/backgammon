import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { games, users, game_moves } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  initializeBoard,
  rollDice,
  isValidMove,
  makeMove,
  checkWinCondition,
  canPlayerMove,
} from '../services/gameService.js';
import type { BackgammonBoard, SocketGameMove } from '../../../shared/src/types.js';

interface GameRoom {
  gameId: string;
  board: BackgammonBoard;
  player1Id: string;
  player2Id: string;
  currentPlayer: 1 | 2;
  dice: [number, number] | null;
  diceUsed: boolean[];
}

const gameRooms = new Map<string, GameRoom>();
// Track which socket is in which game
const socketToGame = new Map<string, string>();

export function setupSocketIO(io: Server) {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0];
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET not set');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;

    socket.on('join-game', async (gameId: string) => {
      try {
        // Verify user is part of the game
        const [game] = await db
          .select()
          .from(games)
          .where(eq(games.id, gameId))
          .limit(1);

        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        if (game.player1_id !== userId && game.player2_id !== userId) {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        if (game.status !== 'active') {
          socket.emit('error', { message: 'Game is not active' });
          return;
        }

        socket.join(`game:${gameId}`);
        
        // Track this socket's game
        socketToGame.set(socket.id, gameId);

        // Initialize or get game room
        if (!gameRooms.has(gameId)) {
          const board = initializeBoard();
          board.game_id = gameId;
          board.current_player = 1;

          gameRooms.set(gameId, {
            gameId,
            board,
            player1Id: game.player1_id,
            player2Id: game.player2_id,
            currentPlayer: 1,
            dice: null,
            diceUsed: [],
          });
        }

        const room = gameRooms.get(gameId)!;
        
        // Emit current game state
        socket.emit('game-state', {
          board: room.board,
          currentPlayer: room.currentPlayer,
          dice: room.dice,
          canMove: room.currentPlayer === (game.player1_id === userId ? 1 : 2),
        });

        // Notify other player
        socket.to(`game:${gameId}`).emit('player-joined', { userId });
      } catch (error) {
        console.error('Join game error:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    socket.on('roll-dice', async (gameId: string) => {
      try {
        const room = gameRooms.get(gameId);
        if (!room) {
          socket.emit('error', { message: 'Game room not found' });
          return;
        }

        const playerNumber = room.player1Id === userId ? 1 : 2;
        if (room.currentPlayer !== playerNumber) {
          socket.emit('error', { message: 'Not your turn' });
          return;
        }

        if (room.dice) {
          socket.emit('error', { message: 'Dice already rolled' });
          return;
        }

        const dice = rollDice();
        room.dice = dice;
        room.diceUsed = [false, false];

        // Save dice roll to database
        await db.insert(game_moves).values({
          game_id: gameId,
          player_id: userId,
          move_data: { type: 'roll', dice },
          move_number: 0,
        });

        // Emit dice roll to all players, but only the current player can move
        const sockets = await io.in(`game:${gameId}`).fetchSockets();
        
        for (const socket of sockets) {
          const socketUserId = (socket as any).userId;
          const socketPlayerNumber = room.player1Id === socketUserId ? 1 : 2;
          const socketCanMove = room.currentPlayer === socketPlayerNumber;
          
          socket.emit('dice-rolled', { dice, player: playerNumber });
          socket.emit('game-state', {
            board: room.board,
            currentPlayer: room.currentPlayer,
            dice: room.dice,
            canMove: socketCanMove,
            usedDice: room.diceUsed,
          });
        }
      } catch (error) {
        console.error('Roll dice error:', error);
        socket.emit('error', { message: 'Failed to roll dice' });
      }
    });

    socket.on('make-move', async (move: SocketGameMove) => {
      try {
        const room = gameRooms.get(move.game_id);
        if (!room) {
          socket.emit('error', { message: 'Game room not found' });
          return;
        }

        const playerNumber = room.player1Id === userId ? 1 : 2;
        if (room.currentPlayer !== playerNumber) {
          socket.emit('error', { message: 'Not your turn' });
          return;
        }

        if (!room.dice) {
          socket.emit('error', { message: 'Must roll dice first' });
          return;
        }

        // Determine which die to use
        let dieUsed = -1;
        let diceValue = 0;
        
        if (move.from === 'bar' && typeof move.to === 'number') {
          // Entering from bar
          const entryPoint = playerNumber === 1 ? (move.to + 1) : (24 - move.to);
          if (entryPoint === room.dice![0] && !room.diceUsed[0]) {
            dieUsed = 0;
            diceValue = room.dice![0];
          } else if (entryPoint === room.dice![1] && !room.diceUsed[1]) {
            dieUsed = 1;
            diceValue = room.dice![1];
          }
        } else if (move.to === 'off' && typeof move.from === 'number') {
          // Bearing off
          const pointNumber = playerNumber === 1 ? (24 - move.from) : (move.from + 1);
          if (pointNumber === room.dice![0] && !room.diceUsed[0]) {
            dieUsed = 0;
            diceValue = room.dice![0];
          } else if (pointNumber === room.dice![1] && !room.diceUsed[1]) {
            dieUsed = 1;
            diceValue = room.dice![1];
          } else {
            // Check if bearing off with higher die (when no checkers on higher points)
            const higherDie = room.dice![0] > room.dice![1] ? 0 : 1;
            if (!room.diceUsed[higherDie] && pointNumber < room.dice![higherDie]) {
              // Verify no checkers on higher points
              const homeStart = playerNumber === 1 ? 18 : 0;
              const homeEnd = playerNumber === 1 ? 23 : 5;
              let canBearOff = true;
              for (let i = (playerNumber === 1 ? move.from + 1 : move.from - 1); 
                   (playerNumber === 1 ? i <= homeEnd : i >= homeStart); 
                   (playerNumber === 1 ? i++ : i--)) {
                if (room.board.points[i][playerNumber - 1] > 0) {
                  canBearOff = false;
                  break;
                }
              }
              if (canBearOff) {
                dieUsed = higherDie;
                diceValue = room.dice![higherDie];
              }
            }
          }
        } else if (typeof move.from === 'number' && typeof move.to === 'number') {
          // Regular move
          const distance = Math.abs(move.to - move.from);
          if (distance === room.dice![0] && !room.diceUsed[0]) {
            dieUsed = 0;
            diceValue = room.dice![0];
          } else if (distance === room.dice![1] && !room.diceUsed[1]) {
            dieUsed = 1;
            diceValue = room.dice![1];
          }
        }

        if (dieUsed === -1) {
          socket.emit('error', { message: 'Invalid move - dice value does not match' });
          return;
        }

        // Validate move with exact dice value
        if (!isValidMove(room.board, move.from, move.to, playerNumber, diceValue)) {
          socket.emit('error', { message: 'Invalid move' });
          return;
        }

        // Make move
        room.board = makeMove(room.board, move.from, move.to, playerNumber, diceValue);

        // Mark die as used
        room.diceUsed[dieUsed] = true;

        // Save move to database
        await db.insert(game_moves).values({
          game_id: move.game_id,
          player_id: userId,
          move_data: { from: move.from, to: move.to },
          move_number: 0,
        });

        // Check if all dice used or no moves available
        const allDiceUsed = room.diceUsed.every(used => used);
        const canMoveMore = canPlayerMove(room.board, playerNumber, room.dice, room.diceUsed);

        if (allDiceUsed || !canMoveMore) {
          // Switch player
          room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
          room.dice = null;
          room.diceUsed = [];
        }

        // Check win condition
        const winner = checkWinCondition(room.board);
        if (winner) {
          const winnerId = winner === 1 ? room.player1Id : room.player2Id;
          
          // Update game in database
          await db.update(games).set({
            status: 'completed',
            winner_id: winnerId,
            points_awarded: 50,
            completed_at: new Date(),
            updated_at: new Date(),
          }).where(eq(games.id, move.game_id));

          // Update winner's points
          const [winner] = await db
            .select()
            .from(users)
            .where(eq(users.id, winnerId))
            .limit(1);
          
          if (winner) {
            await db
              .update(users)
              .set({
                points: winner.points + 50,
                updated_at: new Date(),
              })
              .where(eq(users.id, winnerId));
          }

          io.to(`game:${move.game_id}`).emit('game-over', {
            winner: winner,
            winnerId,
            board: room.board,
          });

          gameRooms.delete(move.game_id);
        } else {
          // Emit updated game state to all players in the room
          // Each player needs to know if it's their turn
          const sockets = await io.in(`game:${move.game_id}`).fetchSockets();
          
          for (const socket of sockets) {
            const socketUserId = (socket as any).userId;
            const socketPlayerNumber = room.player1Id === socketUserId ? 1 : 2;
            const socketCanMove = room.currentPlayer === socketPlayerNumber;
            
            socket.emit('game-state', {
              board: room.board,
              currentPlayer: room.currentPlayer,
              dice: room.dice,
              canMove: socketCanMove,
              usedDice: room.diceUsed,
            });
          }
        }
      } catch (error) {
        console.error('Make move error:', error);
        socket.emit('error', { message: 'Failed to make move' });
      }
    });

    socket.on('disconnect', async () => {
      try {
        const gameId = socketToGame.get(socket.id);
        if (!gameId) return;

        const room = gameRooms.get(gameId);
        if (!room) {
          socketToGame.delete(socket.id);
          return;
        }

        // Check if game is still active
        const [game] = await db
          .select()
          .from(games)
          .where(eq(games.id, gameId))
          .limit(1);

        if (!game || game.status !== 'active') {
          socketToGame.delete(socket.id);
          return;
        }

        // Determine which player disconnected
        const disconnectedPlayerNumber = room.player1Id === userId ? 1 : 2;
        const winnerNumber = disconnectedPlayerNumber === 1 ? 2 : 1;
        const winnerId = winnerNumber === 1 ? room.player1Id : room.player2Id;

        // Update game in database - player left, opponent wins
        await db.update(games).set({
          status: 'completed',
          winner_id: winnerId,
          points_awarded: 20, // 20 points for opponent leaving
          completed_at: new Date(),
          updated_at: new Date(),
        }).where(eq(games.id, gameId));

        // Update winner's points
        const [winner] = await db
          .select()
          .from(users)
          .where(eq(users.id, winnerId))
          .limit(1);
        
        if (winner) {
          await db
            .update(users)
            .set({
              points: winner.points + 20,
              updated_at: new Date(),
            })
            .where(eq(users.id, winnerId));
        }

        // Notify remaining player
        io.to(`game:${gameId}`).emit('game-over', {
          winner: winnerNumber,
          winnerId,
          board: room.board,
          reason: 'opponent_left',
        });

        // Clean up
        gameRooms.delete(gameId);
        socketToGame.delete(socket.id);
      } catch (error) {
        console.error('Disconnect handler error:', error);
      }
    });
  });
}

