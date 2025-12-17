export interface User {
  id: string;
  username: string;
  email: string;
  points: number;
  created_at: Date;
  updated_at: Date;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: Date;
  sender?: User;
  receiver?: User;
}

export interface Game {
  id: string;
  player1_id: string;
  player2_id: string;
  game_type?: 'backgammon' | 'dice';
  status: 'pending' | 'active' | 'completed';
  winner_id: string | null;
  points_awarded: number;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  player1?: User;
  player2?: User;
  winner?: User;
}

export interface GameMove {
  id: string;
  game_id: string;
  player_id: string;
  move_data: any;
  move_number: number;
  created_at: Date;
}

export interface BackgammonBoard {
  points: number[][]; // 24 points, each is [player1_checkers, player2_checkers]
  bar: { player1: number; player2: number }; // Checkers on the bar
  borne_off: { player1: number; player2: number }; // Checkers borne off
  dice: [number, number] | null;
  current_player: 1 | 2;
  game_id: string;
}

export interface GameState {
  board: BackgammonBoard;
  game: Game;
  can_move: boolean;
  last_move?: any;
}

export interface SocketGameMove {
  game_id: string;
  from: number | 'bar';
  to: number | 'off';
  player_id: string;
}

export interface DiceGameState {
  game_id: string;
  player1_score: number;
  player2_score: number;
  current_round: number;
  player1_roll: number | null;
  player2_roll: number | null;
  current_player: 1 | 2;
  round_winner: 0 | 1 | 2 | null; // 0 = tie, 1 = player1, 2 = player2, null = round not finished
  game_winner: 1 | 2 | null;
}

export interface SocketDiceRoll {
  game_id: string;
  player_id: string;
}

