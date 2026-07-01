export const GRID_SIZE = 5;
export const CENTER_CELL = 2;

export type Direction = "up" | "right" | "down" | "left";
export type Edge = Direction;
export type GameStatus = "playing" | "gameOver";

export interface Cell {
  row: number;
  col: number;
}

export interface Fireball {
  id: number;
  edge: Edge;
  lane: number;
  age: number;
  warningDuration: number;
  travelDuration: number;
}

export interface GameState {
  player: Cell;
  playerFacing: Direction;
  coin: Cell;
  previousCoin: Cell | null;
  fireballs: Fireball[];
  score: number;
  bestScore: number;
  worldRecord: number;
  gameStatus: GameStatus;
  elapsed: number;
  fireballSpawnClock: number;
  nextFireballDelay: number;
  nextFireballId: number;
}

export interface RecordsSnapshot {
  bestScore: number;
  worldRecord: number;
}

export interface RecordsStore {
  load(): RecordsSnapshot;
  save(score: number): RecordsSnapshot;
}
