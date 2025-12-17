import type { DiceGameState } from '../../../shared/src/types.js';

export function initializeDiceGame(gameId: string): DiceGameState {
  return {
    game_id: gameId,
    player1_score: 0,
    player2_score: 0,
    current_round: 1,
    player1_roll: null,
    player2_roll: null,
    current_player: 1,
    round_winner: null,
    game_winner: null,
  };
}

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function processDiceRoll(
  gameState: DiceGameState,
  player: 1 | 2,
  roll: number
): DiceGameState {
  const newState = { ...gameState };

  if (player === 1) {
    newState.player1_roll = roll;
  } else {
    newState.player2_roll = roll;
  }

  // If both players have rolled, determine round winner
  if (newState.player1_roll !== null && newState.player2_roll !== null) {
    if (newState.player1_roll > newState.player2_roll) {
      newState.round_winner = 1;
      newState.player1_score++;
    } else if (newState.player2_roll > newState.player1_roll) {
      newState.round_winner = 2;
      newState.player2_score++;
    } else {
      // Tie - no winner for this round
      newState.round_winner = 0;
    }

    // Check if game is won (first to 3 points)
    if (newState.player1_score >= 3) {
      newState.game_winner = 1;
    } else if (newState.player2_score >= 3) {
      newState.game_winner = 2;
    } else {
      // Next round - reset rolls and switch starting player
      newState.current_round++;
      newState.player1_roll = null;
      newState.player2_roll = null;
      newState.round_winner = null;
      // Alternate starting player each round
      newState.current_player = newState.current_round % 2 === 0 ? 2 : 1;
    }
  } else {
    // Switch to other player
    newState.current_player = player === 1 ? 2 : 1;
  }

  return newState;
}

