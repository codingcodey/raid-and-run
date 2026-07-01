import { CENTER_CELL, GRID_SIZE, type Cell, type Direction, type Edge, type Fireball, type GameState, type RecordsSnapshot } from "./types";
import { randomInt, type RandomSource } from "./random";

export const FIREBALL_WARNING_DURATION = 0.72;
export const FIREBALL_OFFSCREEN_CELLS = 2.5;
export const FIREBALL_COLLISION_RADIUS = 0.42;

const EDGE_ORDER: Edge[] = ["up", "right", "down", "left"];
const INITIAL_SCORE = 0;
const ALL_CELLS = createAllCells();

export interface FireballPosition {
  row: number;
  col: number;
  progress: number;
  isWarning: boolean;
}

export function createInitialGameState(records: RecordsSnapshot, random: RandomSource = Math.random): GameState {
  const player = { row: CENTER_CELL, col: CENTER_CELL };

  return {
    player,
    playerFacing: "down",
    coin: spawnCoin(player, null, random),
    previousCoin: null,
    fireballs: [],
    score: INITIAL_SCORE,
    bestScore: records.bestScore,
    worldRecord: records.worldRecord,
    gameStatus: "playing",
    elapsed: 0,
    fireballSpawnClock: 0,
    nextFireballDelay: scheduleFireballDelay(INITIAL_SCORE),
    nextFireballId: 1,
  };
}

export function withRecords(state: GameState, records: RecordsSnapshot): GameState {
  return {
    ...state,
    bestScore: records.bestScore,
    worldRecord: records.worldRecord,
  };
}

export function movePlayer(state: GameState, direction: Direction, random: RandomSource = Math.random): GameState {
  if (state.gameStatus === "gameOver") {
    return state;
  }

  const player = clampCell(stepCell(state.player, direction));
  let nextState: GameState = { ...state, player, playerFacing: direction };

  if (cellsEqual(player, nextState.coin)) {
    const score = nextState.score + 1;
    const previousCoin = nextState.coin;

    nextState = {
      ...nextState,
      score,
      previousCoin,
      coin: spawnCoin(player, previousCoin, random),
      fireballSpawnClock: state.score === 0 ? 0 : nextState.fireballSpawnClock,
      nextFireballDelay: state.score === 0 ? scheduleFireballDelay(score) : nextState.nextFireballDelay,
    };
  }

  return isPlayerHit(nextState) ? markGameOver(nextState) : nextState;
}

export function updateGame(state: GameState, deltaSeconds: number, random: RandomSource = Math.random): GameState {
  if (state.gameStatus === "gameOver") {
    return state;
  }

  let nextState: GameState = {
    ...state,
    elapsed: state.elapsed + deltaSeconds,
    fireballs: state.fireballs
      .map((fireball) => ({ ...fireball, age: fireball.age + deltaSeconds }))
      .filter((fireball) => fireball.age <= fireball.warningDuration + fireball.travelDuration),
  };

  if (nextState.score > 0) {
    nextState = advanceFireballSpawner(nextState, deltaSeconds, random);
  }

  return isPlayerHit(nextState) ? markGameOver(nextState) : nextState;
}

export function spawnCoin(player: Cell, previousCoin: Cell | null, random: RandomSource = Math.random): Cell {
  const preferredCells = ALL_CELLS.filter((cell) => {
    return !cellsEqual(cell, player) && (!previousCoin || !cellsEqual(cell, previousCoin));
  });
  const fallbackCells = ALL_CELLS.filter((cell) => !cellsEqual(cell, player));
  const candidates = preferredCells.length > 0 ? preferredCells : fallbackCells;

  return candidates[randomInt(candidates.length, random)];
}

export function createFireball(score: number, id: number, random: RandomSource = Math.random): Fireball {
  const edge = EDGE_ORDER[randomInt(EDGE_ORDER.length, random)];

  return {
    id,
    edge,
    lane: randomInt(GRID_SIZE, random),
    age: 0,
    warningDuration: FIREBALL_WARNING_DURATION,
    travelDuration: scheduleFireballTravelDuration(score),
  };
}

export function getFireballPosition(fireball: Fireball): FireballPosition {
  const progress = getFireballTravelProgress(fireball);
  const start = -FIREBALL_OFFSCREEN_CELLS;
  const end = GRID_SIZE - 1 + FIREBALL_OFFSCREEN_CELLS;
  const forwardAxis = start + (end - start) * progress;
  const backwardAxis = end - (end - start) * progress;

  switch (fireball.edge) {
    case "left":
      return { row: fireball.lane, col: forwardAxis, progress, isWarning: fireball.age < fireball.warningDuration };
    case "right":
      return { row: fireball.lane, col: backwardAxis, progress, isWarning: fireball.age < fireball.warningDuration };
    case "up":
      return { row: forwardAxis, col: fireball.lane, progress, isWarning: fireball.age < fireball.warningDuration };
    case "down":
      return { row: backwardAxis, col: fireball.lane, progress, isWarning: fireball.age < fireball.warningDuration };
  }
}

export function fireballHitsCell(fireball: Fireball, cell: Cell): boolean {
  if (fireball.age < fireball.warningDuration) {
    return false;
  }

  const position = getFireballPosition(fireball);

  if (fireball.edge === "left" || fireball.edge === "right") {
    return cell.row === fireball.lane && Math.abs(position.col - cell.col) <= FIREBALL_COLLISION_RADIUS;
  }

  return cell.col === fireball.lane && Math.abs(position.row - cell.row) <= FIREBALL_COLLISION_RADIUS;
}

export function isPlayerHit(state: GameState): boolean {
  return state.fireballs.some((fireball) => fireballHitsCell(fireball, state.player));
}

export function scheduleFireballDelay(score: number): number {
  if (score >= 50) {
    return 0.6;
  }

  if (score >= 25) {
    return 0.8;
  }

  return score >= 10 ? 1 : 1.5;
}

export function scheduleFireballTravelDuration(score: number): number {
  return Math.max(2.18, 3.74 - Math.min(score, 28) * 0.048125);
}

function advanceFireballSpawner(state: GameState, deltaSeconds: number, random: RandomSource): GameState {
  let fireballSpawnClock = state.fireballSpawnClock + deltaSeconds;
  let nextFireballDelay = state.nextFireballDelay;
  let nextFireballId = state.nextFireballId;
  let fireballs = state.fireballs;

  while (fireballSpawnClock >= nextFireballDelay) {
    fireballSpawnClock -= nextFireballDelay;
    fireballs = [...fireballs, createFireball(state.score, nextFireballId, random)];
    nextFireballId += 1;
    nextFireballDelay = scheduleFireballDelay(state.score);
  }

  return {
    ...state,
    fireballs,
    fireballSpawnClock,
    nextFireballDelay,
    nextFireballId,
  };
}

function createAllCells(): Cell[] {
  const cells: Cell[] = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      cells.push({ row, col });
    }
  }

  return cells;
}

function stepCell(cell: Cell, direction: Direction): Cell {
  switch (direction) {
    case "up":
      return { row: cell.row - 1, col: cell.col };
    case "right":
      return { row: cell.row, col: cell.col + 1 };
    case "down":
      return { row: cell.row + 1, col: cell.col };
    case "left":
      return { row: cell.row, col: cell.col - 1 };
  }
}

function clampCell(cell: Cell): Cell {
  return {
    row: Math.max(0, Math.min(GRID_SIZE - 1, cell.row)),
    col: Math.max(0, Math.min(GRID_SIZE - 1, cell.col)),
  };
}

function cellsEqual(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

function getFireballTravelProgress(fireball: Fireball): number {
  if (fireball.age <= fireball.warningDuration) {
    return 0;
  }

  return Math.max(0, Math.min(1, (fireball.age - fireball.warningDuration) / fireball.travelDuration));
}

function markGameOver(state: GameState): GameState {
  return {
    ...state,
    gameStatus: "gameOver",
  };
}
