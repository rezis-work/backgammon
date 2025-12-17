import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { games, users, game_moves } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  initializeBoard,
  rollDice as rollBackgammonDice,
  isValidMove,
  makeMove,
  checkWinCondition,
  canPlayerMove,
} from '../services/gameService.js';
import {
  initializeDiceGame,
  rollDice as rollSingleDice,
  processDiceRoll,
} from '../services/diceGameService.js';
import type { BackgammonBoard, SocketGameMove, DiceGameState } from '../../../shared/src/types.js';

interface BackgammonGameRoom {
  gameId: string;
  board: BackgammonBoard;
  player1Id: string;
  player2Id: string;
  currentPlayer: 1 | 2;
  dice: [number, number] | null;
  diceUsed: boolean[];
}

interface DiceGameRoom {
  gameId: string;
  gameState: DiceGameState;
  player1Id: string;
  player2Id: string;
}

const backgammonRooms = new Map<string, BackgammonGameRoom>();
const diceRooms = new Map<string, DiceGameRoom>();
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

        const gameType = game.game_type || 'backgammon';

        if (gameType === 'dice') {
          // Initialize or get dice game room
          if (!diceRooms.has(gameId)) {
            const gameState = initializeDiceGame(gameId);
            diceRooms.set(gameId, {
              gameId,
              gameState,
              player1Id: game.player1_id,
              player2Id: game.player2_id,
            });
          }

          const room = diceRooms.get(gameId)!;
          const playerNumber = game.player1_id === userId ? 1 : 2;
          
          // Emit current game state
          socket.emit('dice-game-state', {
            gameState: room.gameState,
            canRoll: room.gameState.current_player === playerNumber && room.gameState.game_winner === null,
          });
        } else {
          // Initialize or get backgammon game room
          if (!backgammonRooms.has(gameId)) {
            const board = initializeBoard();
            board.game_id = gameId;
            board.current_player = 1;

            backgammonRooms.set(gameId, {
              gameId,
              board,
              player1Id: game.player1_id,
              player2Id: game.player2_id,
              currentPlayer: 1,
              dice: null,
              diceUsed: [],
            });
          }

          const room = backgammonRooms.get(gameId)!;
          
          // Emit current game state
          socket.emit('game-state', {
            board: room.board,
            currentPlayer: room.currentPlayer,
            dice: room.dice,
            canMove: room.currentPlayer === (game.player1_id === userId ? 1 : 2),
          });
        }

        // Notify other player
        socket.to(`game:${gameId}`).emit('player-joined', { userId });
      } catch (error) {
        console.error('Join game error:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    socket.on('roll-dice', async (gameId: string) => {
      try {
        const [game] = await db
          .select()
          .from(games)
          .where(eq(games.id, gameId))
          .limit(1);

        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        const gameType = game.game_type || 'backgammon';

        if (gameType === 'dice') {
          const room = diceRooms.get(gameId);
          if (!room) {
            socket.emit('error', { message: 'Game room not found' });
            return;
          }

          const playerNumber = room.player1Id === userId ? 1 : 2;
          if (room.gameState.current_player !== playerNumber) {
            socket.emit('error', { message: 'Not your turn' });
            return;
          }

          if (room.gameState.game_winner !== null) {
            socket.emit('error', { message: 'Game is over' });
            return;
          }

          // Check if player already rolled this round
          if ((playerNumber === 1 && room.gameState.player1_roll !== null) ||
              (playerNumber === 2 && room.gameState.player2_roll !== null)) {
            socket.emit('error', { message: 'You already rolled this round' });
            return;
          }

          const roll = rollSingleDice();
          room.gameState = processDiceRoll(room.gameState, playerNumber, roll);

          // Save roll to database
          await db.insert(game_moves).values({
            game_id: gameId,
            player_id: userId,
            move_data: { type: 'dice-roll', roll, player: playerNumber, round: room.gameState.current_round },
            move_number: room.gameState.current_round,
          });

          // Check if game is won
          if (room.gameState.game_winner !== null) {
            const winnerId = room.gameState.game_winner === 1 ? room.player1Id : room.player2Id;
            
            // Update game in database
            await db.update(games).set({
              status: 'completed',
              winner_id: winnerId,
              points_awarded: 10,
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
                  points: winner.points + 10,
                  updated_at: new Date(),
                })
                .where(eq(users.id, winnerId));
            }

            io.to(`game:${gameId}`).emit('dice-game-over', {
              winner: room.gameState.game_winner,
              winnerId,
              gameState: room.gameState,
            });

            diceRooms.delete(gameId);
          } else {
            // Emit updated game state to all players
            const sockets = await io.in(`game:${gameId}`).fetchSockets();
            
            for (const socket of sockets) {
              const socketUserId = (socket as any).userId;
              const socketPlayerNumber = room.player1Id === socketUserId ? 1 : 2;
              
              socket.emit('dice-rolled', { roll, player: playerNumber, round: room.gameState.current_round });
              socket.emit('dice-game-state', {
                gameState: room.gameState,
                canRoll: room.gameState.current_player === socketPlayerNumber,
              });
            }
          }
        } else {
          // Backgammon dice roll
          const room = backgammonRooms.get(gameId);
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

          const dice = rollBackgammonDice();
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
        }
      } catch (error) {
        console.error('Roll dice error:', error);
        socket.emit('error', { message: 'Failed to roll dice' });
      }
    });

    socket.on('make-move', async (move: SocketGameMove) => {
      try {
        const [game] = await db
          .select()
          .from(games)
          .where(eq(games.id, move.game_id))
          .limit(1);

        if (!game || (game.game_type || 'backgammon') !== 'backgammon') {
          socket.emit('error', { message: 'Invalid game type for this action' });
          return;
        }

        const room = backgammonRooms.get(move.game_id);
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
          // Entering from bar - both players enter from point 24 (index 23) backwards by dice value
          const expectedEntry = 24 - room.dice![0]; // Point number
          const expectedIndex0 = expectedEntry - 1; // Convert to index
          const expectedEntry1 = 24 - room.dice![1]; // Point number
          const expectedIndex1 = expectedEntry1 - 1; // Convert to index
          
          if (move.to === expectedIndex0 && !room.diceUsed[0]) {
            dieUsed = 0;
            diceValue = room.dice![0];
          } else if (move.to === expectedIndex1 && !room.diceUsed[1]) {
            dieUsed = 1;
            diceValue = room.dice![1];
          }
        } else if (move.to === 'off' && typeof move.from === 'number') {
          // Bearing off - both players: point number = index + 1
          const pointNumber = move.from + 1;
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
              // Verify no checkers on higher points (higher indices = higher point numbers)
              const homeStart = 0;
              const homeEnd = 5;
              let canBearOff = true;
              for (let i = move.from + 1; i <= homeEnd; i++) {
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
          // Regular move - both players move towards lower indices
          const distance = move.from - move.to; // Always positive since to < from
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

        const [game] = await db
          .select()
          .from(games)
          .where(eq(games.id, gameId))
          .limit(1);

        if (!game) {
          socketToGame.delete(socket.id);
          return;
        }

        const gameType = game.game_type || 'backgammon';
        let room: BackgammonGameRoom | DiceGameRoom | undefined;
        
        if (gameType === 'dice') {
          room = diceRooms.get(gameId);
        } else {
          room = backgammonRooms.get(gameId);
        }

        if (!room) {
          socketToGame.delete(socket.id);
          return;
        }

        // Check if game is still active
        if (!game || game.status !== 'active') {
          socketToGame.delete(socket.id);
          return;
        }

        // Determine which player disconnected
        const disconnectedPlayerNumber = (gameType === 'dice' 
          ? (room as DiceGameRoom).player1Id === userId ? 1 : 2
          : (room as BackgammonGameRoom).player1Id === userId ? 1 : 2);
        const winnerNumber = disconnectedPlayerNumber === 1 ? 2 : 1;
        const winnerId = winnerNumber === 1 
          ? (gameType === 'dice' ? (room as DiceGameRoom).player1Id : (room as BackgammonGameRoom).player1Id)
          : (gameType === 'dice' ? (room as DiceGameRoom).player2Id : (room as BackgammonGameRoom).player2Id);

        // Update game in database - player left, opponent wins
        const pointsAwarded = gameType === 'dice' ? 10 : 20;
        await db.update(games).set({
          status: 'completed',
          winner_id: winnerId,
          points_awarded: pointsAwarded,
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
              points: winner.points + pointsAwarded,
              updated_at: new Date(),
            })
            .where(eq(users.id, winnerId));
        }

        // Notify remaining player
        if (gameType === 'dice') {
          io.to(`game:${gameId}`).emit('dice-game-over', {
            winner: winnerNumber,
            winnerId,
            gameState: (room as DiceGameRoom).gameState,
            reason: 'opponent_left',
          });
        } else {
          io.to(`game:${gameId}`).emit('game-over', {
            winner: winnerNumber,
            winnerId,
            board: (room as BackgammonGameRoom).board,
            reason: 'opponent_left',
          });
        }

        // Clean up
        backgammonRooms.delete(gameId);
        diceRooms.delete(gameId);
        socketToGame.delete(socket.id);
      } catch (error) {
        console.error('Disconnect handler error:', error);
      }
    });
  });
}

