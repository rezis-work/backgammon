import type { BackgammonBoard } from '../../../shared/src/types.js';

export function initializeBoard(): BackgammonBoard {
  // Standard Backgammon starting position
  // Points are indexed 0-23, where:
  // - Point 1 (index 0) is bottom right
  // - Point 24 (index 23) is top right
  // Player 1 (white) moves from 24→1 (counterclockwise)
  // Player 2 (black) moves from 1→24 (clockwise)
  const points: number[][] = Array(24).fill(null).map(() => [0, 0]);
  
  // Player 1 (white) starting position:
  // - 2 checkers on point 24 (index 23)
  // - 5 checkers on point 13 (index 12)
  // - 3 checkers on point 8 (index 7)
  // - 5 checkers on point 6 (index 5)
  points[23] = [2, 0];  // Point 24
  points[12] = [5, 0]; // Point 13
  points[7] = [3, 0];  // Point 8
  points[5] = [5, 0];  // Point 6

  // Player 2 (black) starting position:
  // - 2 checkers on point 1 (index 0)
  // - 5 checkers on point 12 (index 11)
  // - 3 checkers on point 17 (index 16)
  // - 5 checkers on point 19 (index 18)
  points[0] = [0, 2];  // Point 1
  points[11] = [0, 5]; // Point 12
  points[16] = [0, 3]; // Point 17
  points[18] = [0, 5]; // Point 19

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
  // Player 1's home: points 18-23 (indices 17-22)
  // Player 2's home: points 0-5 (indices 0-5)
  if (player === 1) {
    return pointIndex >= 18 && pointIndex <= 23;
  } else {
    return pointIndex >= 0 && pointIndex <= 5;
  }
}

// Check if all checkers are in home board
function allInHomeBoard(board: BackgammonBoard, player: 1 | 2): boolean {
  const homeStart = player === 1 ? 18 : 0;
  const homeEnd = player === 1 ? 23 : 5;
  
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
    
    // Must enter on opponent's home board
    // Player 1 enters on points 0-5 (opponent's home)
    // Player 2 enters on points 18-23 (opponent's home)
    const entryStart = player === 1 ? 0 : 18;
    const entryEnd = player === 1 ? 5 : 23;
    
    if (to < entryStart || to > entryEnd) return false;
    
    // Check if point is open (0 or 1 opponent checker)
    const opponent = player === 1 ? 2 : 1;
    if (board.points[to][opponent - 1] > 1) return false;
    
    // Check if we have checkers on bar
    if (board.bar[player === 1 ? 'player1' : 'player2'] === 0) return false;
    
    // If diceValue provided, check if move matches dice
    if (diceValue !== undefined) {
      const entryPoint = player === 1 ? (to + 1) : (24 - to);
      if (entryPoint !== diceValue) return false;
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
      const pointNumber = player === 1 ? (24 - from) : (from + 1);
      
      // Can bear off if exact match or if no checker on higher points
      if (pointNumber === diceValue) return true;
      
      // Can bear off with higher die if no checkers on higher points
      if (pointNumber < diceValue) {
        const homeStart = player === 1 ? 18 : 0;
        const homeEnd = player === 1 ? 23 : 5;
        for (let i = (player === 1 ? from + 1 : from - 1); 
             (player === 1 ? i <= homeEnd : i >= homeStart); 
             (player === 1 ? i++ : i--)) {
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

  // Check direction
  const direction = player === 1 ? -1 : 1;
  if ((to - from) * direction <= 0) return false; // Wrong direction

  // Check if point is open
  const opponent = player === 1 ? 2 : 1;
  if (board.points[to][opponent - 1] > 1) return false; // Cannot land on point with 2+ opponent checkers

  // If diceValue provided, check if move matches dice
  if (diceValue !== undefined) {
    const distance = Math.abs(to - from);
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
  const homeStart = player === 1 ? 18 : 0;
  const homeEnd = player === 1 ? 23 : 5;
  
  // Check if player has checkers on bar - must enter first
  if (board.bar[player === 1 ? 'player1' : 'player2'] > 0) {
    const entryStart = player === 1 ? 0 : 18;
    const entryEnd = player === 1 ? 5 : 23;
    
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
      if (!usedDice[0]) {
        const direction = player === 1 ? -1 : 1;
        const to = i + (dice[0] * direction);
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
        const direction = player === 1 ? -1 : 1;
        const to = i + (dice[1] * direction);
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
