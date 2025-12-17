import type { BackgammonBoard } from '../../../shared/src/types.js';

export function initializeBoard(): BackgammonBoard {
  // Standard Backgammon starting position
  // Home board (gate) for both players: indices 0-5 (bottom left)
  // Board layout:
  //   Top row: indices 6-11 (left), 12-17 (right) - displayed left to right
  //   Bottom row: indices 23-18 (right), 5-0 (left/HOME) - displayed right to left
  // Movement: Top row moves left, bottom row moves right (both towards home at bottom left)
  const points: number[][] = Array(24).fill(null).map(() => [0, 0]);
  
  // Based on standard backgammon starting position:
  // Top left quadrant (indices 6-11, displayed left to right):
  //   - Index 6 (first point): 5 black checkers
  //   - Index 8 (third point): 3 white checkers
  points[6] = [0, 5];  // Top left, first point - 5 black
  points[8] = [3, 0];  // Top left, third point - 3 white

  // Top right quadrant (indices 12-17, displayed left to right):
  //   - Index 12 (first point): 5 white checkers
  //   - Index 17 (last point): 2 black checkers
  points[12] = [5, 0]; // Top right, first point - 5 white
  points[17] = [0, 2]; // Top right, last point - 2 black

  // Bottom left quadrant (indices 5-0, HOME, displayed right to left):
  //   - Index 5 (first point when displayed): 5 white checkers
  //   - Index 3 (third point when displayed): 3 black checkers
  points[5] = [5, 0];  // Bottom left, first point - 5 white
  points[3] = [0, 3];  // Bottom left, third point - 3 black

  // Bottom right quadrant (indices 18-23, displayed left to right):
  //   - Index 18 (leftmost): 5 black checkers
  //   - Index 23 (rightmost): 2 white checkers
  points[18] = [0, 5]; // Bottom right, leftmost point - 5 black
  points[23] = [2, 0]; // Bottom right, rightmost point - 2 white

  return {
    points,
    bar: { player1: 0, player2: 0 },
    borne_off: { player1: 0, player2: 0 },
    dice: null,
    current_player: 1,
    game_id: '',
  };
}

export function rollDice(): [number, number] {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return [die1, die2];
}

// Check if a point is in player's home board
function isInHomeBoard(pointIndex: number, player: 1 | 2): boolean {
  // Both players' home board (gate): points 1-6 (indices 0-5) - bottom left
  return pointIndex >= 0 && pointIndex <= 5;
}

// Check if all checkers are in home board
function allInHomeBoard(board: BackgammonBoard, player: 1 | 2): boolean {
  // Both players' home board: indices 0-5
  const homeStart = 0;
  const homeEnd = 5;
  
  // Check outer board and bar
  for (let i = 0; i < 24; i++) {
    if (i < homeStart || i > homeEnd) {
      if (board.points[i][player - 1] > 0) return false;
    }
  }
  
  return board.bar[player === 1 ? 'player1' : 'player2'] === 0;
}

export function isValidMove(
  board: BackgammonBoard,
  from: number | 'bar',
  to: number | 'off',
  player: 1 | 2,
  diceValue?: number
): boolean {
  // If moving from bar
  if (from === 'bar') {
    if (typeof to !== 'number') return false;
    
    // Both players enter on points 18-23 (opponent's outer board)
    // Entry point calculation: from point 24 (index 23), move backwards by dice value
    const entryStart = 18;
    const entryEnd = 23;
    
    if (to < entryStart || to > entryEnd) return false;
    
    // Check if point is open (0 or 1 opponent checker)
    const opponent = player === 1 ? 2 : 1;
    if (board.points[to][opponent - 1] > 1) return false;
    
    // Check if we have checkers on bar
    if (board.bar[player === 1 ? 'player1' : 'player2'] === 0) return false;
    
    // If diceValue provided, check if move matches dice
    // Entry point: from 24 (index 23) backwards by dice value
    if (diceValue !== undefined) {
      const expectedEntry = 24 - diceValue; // Point number
      const expectedIndex = expectedEntry - 1; // Convert to index
      if (to !== expectedIndex) return false;
    }
    
    return true;
  }

  // If bearing off
  if (to === 'off') {
    if (typeof from !== 'number') return false;
    
    // All checkers must be in home board
    if (!allInHomeBoard(board, player)) return false;
    
    // Point must be in home board and have checkers
    if (!isInHomeBoard(from, player)) return false;
    if (board.points[from][player - 1] === 0) return false;
    
    // If diceValue provided, check bearing off rules
    if (diceValue !== undefined) {
      // Both players: point number = index + 1 (points 1-6, indices 0-5)
      const pointNumber = from + 1;
      
      // Can bear off if exact match or if no checker on higher points
      if (pointNumber === diceValue) return true;
      
      // Can bear off with higher die if no checkers on higher points
      if (pointNumber < diceValue) {
        const homeStart = 0;
        const homeEnd = 5;
        // Check if there are checkers on higher points (higher indices = higher point numbers)
        for (let i = from + 1; i <= homeEnd; i++) {
          if (board.points[i][player - 1] > 0) return false;
        }
        return true;
      }
      
      return false;
    }
    
    return true;
  }

  // Regular move
  if (typeof from !== 'number' || typeof to !== 'number') return false;
  if (from < 0 || from > 23 || to < 0 || to > 23) return false;
  if (board.points[from][player - 1] === 0) return false;

  // Check direction - both players move towards lower indices (towards home board 0-5)
  // Direction is always decreasing (to < from)
  if (to >= from) return false; // Wrong direction - must move towards lower indices

  // Check if point is open
  const opponent = player === 1 ? 2 : 1;
  if (board.points[to][opponent - 1] > 1) return false; // Cannot land on point with 2+ opponent checkers

  // If diceValue provided, check if move matches dice
  if (diceValue !== undefined) {
    const distance = from - to; // Distance is always positive since to < from
    if (distance !== diceValue) return false;
  }

  return true;
}

export function makeMove(
  board: BackgammonBoard,
  from: number | 'bar',
  to: number | 'off',
  player: 1 | 2,
  diceValue: number
): BackgammonBoard {
  const newBoard = JSON.parse(JSON.stringify(board)) as BackgammonBoard;

  if (from === 'bar') {
    if (typeof to !== 'number') return board;
    newBoard.bar[player === 1 ? 'player1' : 'player2']--;
    const opponent = player === 1 ? 2 : 1;
    
    // Hit opponent checker (blot)
    if (newBoard.points[to][opponent - 1] === 1) {
      newBoard.points[to][opponent - 1] = 0;
      newBoard.bar[opponent === 1 ? 'player1' : 'player2']++;
    }
    
    newBoard.points[to][player - 1]++;
  } else if (to === 'off') {
    if (typeof from !== 'number') return board;
    newBoard.points[from][player - 1]--;
    newBoard.borne_off[player === 1 ? 'player1' : 'player2']++;
  } else {
    if (typeof from !== 'number' || typeof to !== 'number') return board;
    newBoard.points[from][player - 1]--;
    const opponent = player === 1 ? 2 : 1;
    
    // Hit opponent checker (blot)
    if (newBoard.points[to][opponent - 1] === 1) {
      newBoard.points[to][opponent - 1] = 0;
      newBoard.bar[opponent === 1 ? 'player1' : 'player2']++;
    }
    
    newBoard.points[to][player - 1]++;
  }

  return newBoard;
}

export function checkWinCondition(board: BackgammonBoard): 1 | 2 | null {
  if (board.borne_off.player1 === 15) return 1;
  if (board.borne_off.player2 === 15) return 2;
  return null;
}

export function canPlayerMove(
  board: BackgammonBoard, 
  player: 1 | 2, 
  dice: [number, number],
  usedDice: boolean[] = [false, false]
): boolean {
  // Both players' home board: indices 0-5
  const homeStart = 0;
  const homeEnd = 5;
  
  // Check if player has checkers on bar - must enter first
  if (board.bar[player === 1 ? 'player1' : 'player2'] > 0) {
    // Both players enter on points 18-23 (indices 17-22)
    const entryStart = 18;
    const entryEnd = 23;
    
    for (let i = entryStart; i <= entryEnd; i++) {
      if (!usedDice[0] && isValidMove(board, 'bar', i, player, dice[0])) return true;
      if (!usedDice[1] && isValidMove(board, 'bar', i, player, dice[1])) return true;
    }
    return false;
  }
  
  // Check regular moves and bearing off
  for (let i = 0; i < 24; i++) {
    if (board.points[i][player - 1] > 0) {
      // Check moves with first die
      // Both players move towards lower indices (decreasing)
      if (!usedDice[0]) {
        const to = i - dice[0]; // Move towards lower indices
        if (to >= 0 && to < 24 && isValidMove(board, i, to, player, dice[0])) {
          return true;
        }
        // Check bearing off
        if (isInHomeBoard(i, player) && allInHomeBoard(board, player)) {
          if (isValidMove(board, i, 'off', player, dice[0])) return true;
        }
      }
      
      // Check moves with second die
      if (!usedDice[1]) {
        const to = i - dice[1]; // Move towards lower indices
        if (to >= 0 && to < 24 && isValidMove(board, i, to, player, dice[1])) {
          return true;
        }
        // Check bearing off
        if (isInHomeBoard(i, player) && allInHomeBoard(board, player)) {
          if (isValidMove(board, i, 'off', player, dice[1])) return true;
        }
      }
    }
  }
  
  return false;
}
