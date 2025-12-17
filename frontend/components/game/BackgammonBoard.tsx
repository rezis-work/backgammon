'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import type { BackgammonBoard as BoardType, SocketGameMove } from '../../../shared/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import Dice from './Dice';

interface BackgammonBoardProps {
  gameId: string;
  userId: string;
  playerNumber: 1 | 2;
}

export default function BackgammonBoard({ gameId, userId, playerNumber }: BackgammonBoardProps) {
  const [board, setBoard] = useState<BoardType | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [dice, setDice] = useState<[number, number] | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [canMove, setCanMove] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<number | 'bar' | null>(null);
  const [gameOver, setGameOver] = useState<{ winner: 1 | 2; winnerId: string } | null>(null);
  const [gameOverReason, setGameOverReason] = useState<string | null>(null);
  const [usedDice, setUsedDice] = useState<boolean[]>([false, false]);
  const [validDestinations, setValidDestinations] = useState<Set<number | 'off'>>(new Set());

  useEffect(() => {
    const socket = getSocket();
    
    socket.emit('join-game', gameId);

    socket.on('game-state', (data: { board: BoardType; currentPlayer: 1 | 2; dice: [number, number] | null; canMove: boolean; usedDice?: boolean[] }) => {
      setBoard(data.board);
      setCurrentPlayer(data.currentPlayer);
      setDice(data.dice);
      setCanMove(data.canMove);
      setUsedDice(data.usedDice || [false, false]);
      setDiceRolling(false);
      setSelectedPoint(null);
      setValidDestinations(new Set());
    });

    socket.on('dice-rolled', (data: { dice: [number, number]; player: 1 | 2 }) => {
      setDiceRolling(true);
      setTimeout(() => {
        setDice(data.dice);
        setDiceRolling(false);
      }, 1000);
    });

    socket.on('game-over', (data: { winner: 1 | 2; winnerId: string; board: BoardType; reason?: string }) => {
      setGameOver({ winner: data.winner, winnerId: data.winnerId });
      setBoard(data.board);
      setCanMove(false);
      if (data.reason) {
        setGameOverReason(data.reason);
      }
    });

    socket.on('error', (data: { message: string }) => {
      toast.error(data.message, {
        duration: 4000,
      });
    });

    return () => {
      socket.off('game-state');
      socket.off('dice-rolled');
      socket.off('game-over');
      socket.off('error');
    };
  }, [gameId]);

  const handleRollDice = () => {
    const socket = getSocket();
    setDiceRolling(true);
    socket.emit('roll-dice', gameId);
  };

  // Calculate valid destinations when a point is selected
  const calculateValidDestinations = (from: number | 'bar') => {
    if (!board || !dice) {
      setValidDestinations(new Set());
      return;
    }

    const valid = new Set<number | 'off'>();
    // Both players' home board: indices 0-5 (bottom left - gate)
    const homeStart = 0;
    const homeEnd = 5;
    // Both players move towards lower indices (decreasing)
    const direction = -1;

    if (from === 'bar') {
      // Valid entry points from bar - both players enter on points 18-23 (indices 17-22)
      const entryStart = 18;
      const entryEnd = 23;
      
      for (let i = entryStart; i <= entryEnd; i++) {
        // Entry point: from 24 (index 23) backwards by dice value
        const expectedEntry0 = 24 - dice[0];
        const expectedIndex0 = expectedEntry0 - 1;
        const expectedEntry1 = 24 - dice[1];
        const expectedIndex1 = expectedEntry1 - 1;
        const opponent = playerNumber === 1 ? 2 : 1;
        
        if (board.points[i][opponent - 1] <= 1) {
          if (!usedDice[0] && i === expectedIndex0) valid.add(i);
          if (!usedDice[1] && i === expectedIndex1) valid.add(i);
        }
      }
    } else if (typeof from === 'number') {
      // Check if all checkers are in home board
      let allInHome = true;
      for (let i = 0; i < 24; i++) {
        if (i < homeStart || i > homeEnd) {
          if (board.points[i][playerNumber - 1] > 0) {
            allInHome = false;
            break;
          }
        }
      }
      if (board.bar[playerNumber === 1 ? 'player1' : 'player2'] > 0) {
        allInHome = false;
      }

      // Regular moves - both players move towards lower indices
      for (let dieIndex = 0; dieIndex < 2; dieIndex++) {
        if (usedDice[dieIndex]) continue;
        
        const to = from + (dice[dieIndex] * direction); // Move towards lower indices
        if (to >= 0 && to < 24) {
          const opponent = playerNumber === 1 ? 2 : 1;
          if (board.points[to][opponent - 1] <= 1) {
            valid.add(to);
          }
        }
      }

      // Bearing off
      if (allInHome && from >= homeStart && from <= homeEnd) {
        // Both players: point number = index + 1
        const pointNumber = from + 1;
        
        for (let dieIndex = 0; dieIndex < 2; dieIndex++) {
          if (usedDice[dieIndex]) continue;
          
          if (pointNumber === dice[dieIndex]) {
            valid.add('off');
          } else if (pointNumber < dice[dieIndex]) {
            // Check if no checkers on higher points (higher indices = higher point numbers)
            let canBearOff = true;
            for (let i = from + 1; i <= homeEnd; i++) {
              if (board.points[i][playerNumber - 1] > 0) {
                canBearOff = false;
                break;
              }
            }
            if (canBearOff) valid.add('off');
          }
        }
      }
    }

    setValidDestinations(valid);
  };

  const handlePointClick = (pointIndex: number) => {
    if (!canMove || !dice) return;

    if (selectedPoint === null) {
      // Select a point with player's checkers
      const checkers = board?.points[pointIndex][playerNumber - 1] || 0;
      if (checkers > 0) {
        setSelectedPoint(pointIndex);
        calculateValidDestinations(pointIndex);
      }
    } else if (selectedPoint === pointIndex) {
      // Clicking the same point - unselect it
      setSelectedPoint(null);
      setValidDestinations(new Set());
    } else {
      // Check if clicking on another point with checkers - select that instead
      const checkers = board?.points[pointIndex][playerNumber - 1] || 0;
      if (checkers > 0) {
        setSelectedPoint(pointIndex);
        calculateValidDestinations(pointIndex);
      } else if (validDestinations.has(pointIndex)) {
        // Move to destination
        const move: SocketGameMove = {
          game_id: gameId,
          from: selectedPoint,
          to: pointIndex,
          player_id: userId,
        };
        
        const socket = getSocket();
        socket.emit('make-move', move);
        setSelectedPoint(null);
        setValidDestinations(new Set());
      }
    }
  };

  const handleBarClick = () => {
    if (!canMove || !dice) return;
    
    // If bar is already selected, unselect it
    if (selectedPoint === 'bar') {
      setSelectedPoint(null);
      setValidDestinations(new Set());
      return;
    }
    
    // If another point is selected, allow switching to bar
    const barCheckers = board?.bar[playerNumber === 1 ? 'player1' : 'player2'] || 0;
    if (barCheckers > 0) {
      setSelectedPoint('bar');
      calculateValidDestinations('bar');
    }
  };

  const handleLeaveGame = () => {
    if (confirm('Are you sure you want to leave the game? Your opponent will win and receive 20 points.')) {
      const socket = getSocket();
      socket.disconnect();
      window.location.href = '/profile';
    }
  };

  const handleBearingOff = (pointIndex: number) => {
    if (!canMove || !dice || selectedPoint === null) return;
    
    if (validDestinations.has('off')) {
      const move: SocketGameMove = {
        game_id: gameId,
        from: selectedPoint,
        to: 'off',
        player_id: userId,
      };
      
      const socket = getSocket();
      socket.emit('make-move', move);
      setSelectedPoint(null);
      setValidDestinations(new Set());
    }
  };

  if (!board) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading game...</div>
      </div>
    );
  }

  if (gameOver) {
    const isWinner = gameOver.winner === playerNumber;
    const pointsEarned = gameOverReason === 'opponent_left' ? 20 : 50;
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 to-amber-100">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className={`text-6xl mb-4 ${isWinner ? '🎉' : '😔'}`}>
              {isWinner ? '🎉' : '😔'}
            </div>
            <h2 className="text-4xl font-bold mb-4">
              {isWinner ? 'You Won!' : 'You Lost!'}
            </h2>
            {gameOverReason === 'opponent_left' ? (
              <p className="text-lg text-gray-600 mb-6">
                {isWinner 
                  ? `Your opponent left the game. You earned ${pointsEarned} points!` 
                  : 'You left the game. Your opponent won.'}
              </p>
            ) : (
              <p className="text-lg text-gray-600 mb-6">
                {isWinner 
                  ? `Congratulations! You earned ${pointsEarned} points!` 
                  : 'Better luck next time!'}
              </p>
            )}
            <Button onClick={() => window.location.href = '/profile'}>
              Return to Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isMyTurn = currentPlayer === playerNumber;

  // Backgammon board layout (standard):
  // Top row: Top left (indices 6-11, left to right), then Top right (indices 12-17, left to right)
  // Bottom row: Bottom left HOME (indices 5-0, left to right), then Bottom right (indices 18-23, left to right)
  // Gate (home board): Points 1-6 (indices 0-5) at bottom left
  // Movement: Top row moves left (towards home), bottom row moves right (towards home)
  
  const renderPoint = (pointIndex: number, isTop: boolean, pointNumber: number) => {
    const point = board.points[pointIndex];
    const player1Checkers = point[0];
    const player2Checkers = point[1];
    const isSelected = selectedPoint === pointIndex;
    // Both players' home board: indices 0-5 (bottom left - gate)
    const homeStart = 0;
    const homeEnd = 5;
    const isHome = pointIndex >= homeStart && pointIndex <= homeEnd;
    const isValidDestination = validDestinations.has(pointIndex);
    const canBearingOff = isHome && selectedPoint !== null && validDestinations.has('off');
    
    const hasMyCheckers = (playerNumber === 1 ? player1Checkers : player2Checkers) > 0;
    const canSelect = canMove && hasMyCheckers && selectedPoint === null;

    // Alternate colors
    const isLight = (pointNumber - 1) % 2 === (isTop ? 1 : 0);

    return (
      <div
        key={pointIndex}
        className={`
          relative flex-1 h-32
          ${isSelected 
            ? 'ring-4 ring-yellow-400 z-20' 
            : isValidDestination
              ? 'ring-4 ring-green-500 cursor-pointer z-10 animate-pulse'
              : canSelect
                ? 'cursor-pointer hover:opacity-80'
                : 'opacity-60'
          }
          transition-all duration-200
        `}
        onClick={() => {
          if (!canMove) return;
          
          // If this point is selected, allow unselecting or bearing off
          if (isSelected) {
            if (canBearingOff && validDestinations.has('off')) {
              handleBearingOff(pointIndex);
            } else {
              // Unselect by clicking the same point
              handlePointClick(pointIndex);
            }
          } else if (canBearingOff && pointIndex === selectedPoint) {
            handleBearingOff(pointIndex);
          } else if (canSelect || isValidDestination) {
            handlePointClick(pointIndex);
          }
        }}
      >
        {/* Triangular point */}
        <div
          className={`
            absolute inset-0
            ${isLight ? 'bg-amber-100' : 'bg-amber-200'}
            ${isHome ? 'bg-gradient-to-b from-amber-300 to-amber-200' : ''}
            border border-amber-800
          `}
          style={{
            clipPath: isTop 
              ? 'polygon(0 0, 100% 0, 50% 100%)'
              : 'polygon(50% 0, 0 100%, 100% 100%)',
          }}
        />
        
        {/* Point number */}
        <div className={`absolute ${isTop ? 'top-1' : 'bottom-1'} left-1/2 -translate-x-1/2 text-xs font-bold text-amber-900 z-10`}>
          {pointNumber}
        </div>

        {/* Player 1 checkers (white) */}
        {player1Checkers > 0 && (
          <div className={`absolute ${isTop ? 'top-6' : 'bottom-6'} left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 z-10`}>
            {Array.from({ length: Math.min(player1Checkers, 5) }).map((_, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-white to-gray-200 border-2 border-gray-400 shadow-lg"
              />
            ))}
            {player1Checkers > 5 && (
              <div className="text-xs font-bold text-gray-700 bg-white rounded-full w-6 h-6 flex items-center justify-center border-2 border-gray-400 shadow">
                {player1Checkers}
              </div>
            )}
          </div>
        )}

        {/* Player 2 checkers (black) */}
        {player2Checkers > 0 && (
          <div className={`absolute ${isTop ? 'bottom-6' : 'top-6'} left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 z-10`}>
            {Array.from({ length: Math.min(player2Checkers, 5) }).map((_, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-800 to-black border-2 border-gray-600 shadow-lg"
              />
            ))}
            {player2Checkers > 5 && (
              <div className="text-xs font-bold text-white bg-gray-800 rounded-full w-6 h-6 flex items-center justify-center border-2 border-gray-600 shadow">
                {player2Checkers}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 bg-white/90 backdrop-blur-sm rounded-lg shadow-xl p-4 border-2 border-amber-800">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-amber-900">Backgammon</h2>
              <p className="text-sm text-amber-700 mt-1">
                {isMyTurn ? '✨ Your turn' : "⏳ Opponent's turn"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {dice ? (
                <div className="flex gap-3 items-center">
                  <div className="relative">
                    <Dice value={dice[0]} isRolling={diceRolling} size="md" />
                    {usedDice[0] && (
                      <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center backdrop-blur-sm">
                        <span className="text-white text-xs font-bold">USED</span>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Dice value={dice[1]} isRolling={diceRolling} size="md" />
                    {usedDice[1] && (
                      <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center backdrop-blur-sm">
                        <span className="text-white text-xs font-bold">USED</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                isMyTurn && (
                  <Button 
                    onClick={handleRollDice}
                    size="lg"
                    className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-lg text-lg px-6"
                  >
                    🎲 Roll Dice
                  </Button>
                )
              )}
              <Button
                onClick={handleLeaveGame}
                variant="outline"
                size="lg"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
              >
                🚪 Leave Game
              </Button>
            </div>
          </div>
        </div>

        {/* Bar */}
        {(board.bar.player1 > 0 || board.bar.player2 > 0) && (
          <div className={`mb-4 bg-gradient-to-r from-amber-800 to-amber-900 rounded-lg shadow-xl p-4 border-4 border-amber-700 ${selectedPoint === 'bar' ? 'ring-4 ring-yellow-400' : ''}`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold">Bar (White):</span>
                <div className="flex gap-2">
                  {Array.from({ length: board.bar.player1 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-full bg-gradient-to-br from-white to-gray-200 border-2 border-gray-400 shadow-md transition-transform ${
                        canMove && selectedPoint === null && playerNumber === 1
                          ? 'cursor-pointer hover:scale-110'
                          : 'cursor-not-allowed opacity-50'
                      }`}
                      onClick={playerNumber === 1 ? handleBarClick : undefined}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold">Bar (Black):</span>
                <div className="flex gap-2">
                  {Array.from({ length: board.bar.player2 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-black border-2 border-gray-600 shadow-md transition-transform ${
                        canMove && playerNumber === 2
                          ? 'cursor-pointer hover:scale-110'
                          : 'cursor-not-allowed opacity-50'
                      }`}
                      onClick={playerNumber === 2 ? handleBarClick : undefined}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Board */}
        <div className="bg-gradient-to-br from-amber-600 to-amber-800 rounded-2xl shadow-2xl p-4 border-8 border-amber-900">
          {/* Top half of board */}
          <div className="flex gap-2 mb-2">
            {/* Left quadrant - Top left (indices 6-11, displayed left to right) */}
            <div className="flex-1 flex gap-1">
              {[6, 7, 8, 9, 10, 11].map((i) => renderPoint(i, true, i + 1))}
            </div>
            
            {/* Center bar / Borne off area */}
            <div className="w-24 bg-gradient-to-b from-amber-700 to-amber-800 rounded-lg border-4 border-amber-900 flex flex-col items-center justify-center p-2 shadow-inner min-h-[256px]">
              <div className="text-white text-xs font-bold mb-2">Borne Off</div>
              <div className="flex flex-col gap-2 items-center">
                <div className="text-white text-2xl font-bold">{board.borne_off.player1}</div>
                <div className="text-white text-2xl font-bold">{board.borne_off.player2}</div>
              </div>
            </div>
            
            {/* Right quadrant - Top right (indices 12-17, displayed left to right) */}
            <div className="flex-1 flex gap-1">
              {[12, 13, 14, 15, 16, 17].map((i) => renderPoint(i, true, i + 1))}
            </div>
          </div>

          {/* Bottom half of board */}
          <div className="flex gap-2">
            {/* Left quadrant - Bottom left HOME (indices 5-0, displayed left to right) - GATE/HOME BOARD */}
            <div className="flex-1 flex gap-1">
              {[5, 4, 3, 2, 1, 0].map((i) => renderPoint(i, false, i + 1))}
            </div>
            
            {/* Center bar / Empty space */}
            <div className="w-24"></div>
            
            {/* Right quadrant - Bottom right (indices 18-23, displayed left to right) */}
            <div className="flex-1 flex gap-1">
              {[18, 19, 20, 21, 22, 23].map((i) => renderPoint(i, false, i + 1))}
            </div>
          </div>
        </div>

        {/* Status message */}
        {selectedPoint && (
          <div className="mt-4 text-center">
            <div className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg text-lg font-semibold">
              Selected: {selectedPoint === 'bar' ? 'Bar' : `Point ${selectedPoint + 1}`} - Click a green highlighted destination or click again to unselect
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
