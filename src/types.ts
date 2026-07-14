export const GRID_SIZE = 5;
export const CENTER_CELL = 2;

export type Direction = "up" | "right" | "down" | "left";
export type Edge = Direction;
export type GameStatus = "playing" | "paused" | "gameOver";

export interface Cell {
  row: number;
  col: number;
}

export interface Fireball {
  id: number;
  edge: Edge;
  lane: number;
  kind: "normal" | "bending" | "fast";
  targetLane: number;
  row: number;
  col: number;
  velocityRow: number;
  velocityCol: number;
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
  bendingFireballCooldown: number;
  fastFireballSequenceActive: boolean;
}

export interface RecordsSnapshot {
  bestScore: number;
  worldRecord: number;
}

export interface RecordsStore {
  load(): RecordsSnapshot;
  save(score: number): RecordsSnapshot;
}
