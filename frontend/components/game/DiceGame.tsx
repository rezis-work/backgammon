'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import type { DiceGameState } from '../../../shared/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import Dice from './Dice';

interface DiceGameProps {
  gameId: string;
  userId: string;
  playerNumber: 1 | 2;
}

export default function DiceGame({ gameId, userId, playerNumber }: DiceGameProps) {
  const [gameState, setGameState] = useState<DiceGameState | null>(null);
  const [canRoll, setCanRoll] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const [gameOver, setGameOver] = useState<{ winner: 1 | 2; winnerId: string } | null>(null);

  useEffect(() => {
    const socket = getSocket();
    
    socket.emit('join-game', gameId);

    socket.on('dice-game-state', (data: { gameState: DiceGameState; canRoll: boolean }) => {
      setGameState(data.gameState);
      setCanRoll(data.canRoll);
      setDiceRolling(false);
    });

    socket.on('dice-rolled', (data: { roll: number; player: 1 | 2; round: number }) => {
      setDiceRolling(false);
    });

    socket.on('dice-game-over', (data: { winner: 1 | 2; winnerId: string; gameState: DiceGameState; reason?: string }) => {
      setGameOver({ winner: data.winner, winnerId: data.winnerId });
      setGameState(data.gameState);
      setCanRoll(false);
    });

    socket.on('error', (data: { message: string }) => {
      toast.error(data.message, {
        duration: 4000,
      });
      setDiceRolling(false);
    });

    return () => {
      socket.off('dice-game-state');
      socket.off('dice-rolled');
      socket.off('dice-game-over');
      socket.off('error');
    };
  }, [gameId]);

  const handleRollDice = () => {
    if (!canRoll || diceRolling) return;
    
    const socket = getSocket();
    setDiceRolling(true);
    socket.emit('roll-dice', gameId);
  };

  const handleLeaveGame = () => {
    if (confirm('Are you sure you want to leave the game? Your opponent will win and receive 10 points.')) {
      const socket = getSocket();
      socket.disconnect();
      window.location.href = '/profile';
    }
  };

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading game...</div>
      </div>
    );
  }

  if (gameOver) {
    const isWinner = gameOver.winner === playerNumber;
    const pointsEarned = 10;
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className={`text-6xl mb-4 ${isWinner ? '🎉' : '😔'}`}>
              {isWinner ? '🎉' : '😔'}
            </div>
            <h2 className="text-4xl font-bold mb-4">
              {isWinner ? 'You Won!' : 'You Lost!'}
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              {isWinner 
                ? `Congratulations! You earned ${pointsEarned} points!` 
                : 'Better luck next time!'}
            </p>
            <Button onClick={() => window.location.href = '/profile'}>
              Return to Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isMyTurn = gameState.current_player === playerNumber;
  const myRoll = playerNumber === 1 ? gameState.player1_roll : gameState.player2_roll;
  const opponentRoll = playerNumber === 1 ? gameState.player2_roll : gameState.player1_roll;
  const myScore = playerNumber === 1 ? gameState.player1_score : gameState.player2_score;
  const opponentScore = playerNumber === 1 ? gameState.player2_score : gameState.player1_score;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 bg-white/90 backdrop-blur-sm rounded-lg shadow-xl p-4 border-2 border-blue-800">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-blue-900">Dice Game</h2>
              <p className="text-sm text-blue-700 mt-1">
                {isMyTurn ? '✨ Your turn to roll' : "⏳ Opponent's turn"}
              </p>
            </div>
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

        {/* Score Display */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-white/90 backdrop-blur-sm border-2 border-blue-800">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                {playerNumber === 1 ? 'You (Player 1)' : 'Opponent (Player 1)'}
              </h3>
              <div className="text-4xl font-bold text-blue-700 mb-2">
                {gameState.player1_score}
              </div>
              <p className="text-sm text-gray-600">First to 3 wins!</p>
            </CardContent>
          </Card>
          <Card className="bg-white/90 backdrop-blur-sm border-2 border-blue-800">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                {playerNumber === 2 ? 'You (Player 2)' : 'Opponent (Player 2)'}
              </h3>
              <div className="text-4xl font-bold text-blue-700 mb-2">
                {gameState.player2_score}
              </div>
              <p className="text-sm text-gray-600">First to 3 wins!</p>
            </CardContent>
          </Card>
        </div>

        {/* Round Info */}
        <div className="mb-6 text-center">
          <Card className="bg-white/90 backdrop-blur-sm border-2 border-blue-800 inline-block">
            <CardContent className="p-4">
              <p className="text-lg font-semibold text-blue-900">
                Round {gameState.current_round}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Dice Area */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          {/* Player 1 Dice */}
          <Card className="bg-white/90 backdrop-blur-sm border-2 border-blue-800">
            <CardContent className="p-8 text-center">
              <h3 className="text-xl font-semibold text-blue-900 mb-4">
                {playerNumber === 1 ? 'Your Roll' : 'Opponent'}
              </h3>
              {gameState.player1_roll !== null ? (
                <div className="flex justify-center">
                  <Dice value={gameState.player1_roll} isRolling={diceRolling && playerNumber === 1} size="lg" />
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center">
                  <p className="text-gray-400">Waiting to roll...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Player 2 Dice */}
          <Card className="bg-white/90 backdrop-blur-sm border-2 border-blue-800">
            <CardContent className="p-8 text-center">
              <h3 className="text-xl font-semibold text-blue-900 mb-4">
                {playerNumber === 2 ? 'Your Roll' : 'Opponent'}
              </h3>
              {gameState.player2_roll !== null ? (
                <div className="flex justify-center">
                  <Dice value={gameState.player2_roll} isRolling={diceRolling && playerNumber === 2} size="lg" />
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center">
                  <p className="text-gray-400">Waiting to roll...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Round Result */}
        {gameState.round_winner !== null && gameState.round_winner !== 0 && (
          <div className="mb-6 text-center">
            <Card className="bg-green-100 border-2 border-green-600 inline-block">
              <CardContent className="p-4">
                <p className="text-lg font-semibold text-green-800">
                  {gameState.round_winner === playerNumber 
                    ? '🎉 You won this round!' 
                    : 'Opponent won this round'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {gameState.round_winner === 0 && gameState.player1_roll !== null && gameState.player2_roll !== null && (
          <div className="mb-6 text-center">
            <Card className="bg-yellow-100 border-2 border-yellow-600 inline-block">
              <CardContent className="p-4">
                <p className="text-lg font-semibold text-yellow-800">
                  It's a tie! No points awarded.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Roll Button */}
        {canRoll && (
          <div className="text-center">
            <Button 
              onClick={handleRollDice}
              size="lg"
              disabled={diceRolling}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg text-lg px-8 py-6"
            >
              {diceRolling ? 'Rolling...' : '🎲 Roll Dice'}
            </Button>
          </div>
        )}

        {/* Status Message */}
        {!canRoll && gameState.current_player !== playerNumber && (
          <div className="text-center mt-4">
            <p className="text-lg text-gray-600">
              Waiting for opponent to roll...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

