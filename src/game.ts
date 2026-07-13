import { CENTER_CELL, GRID_SIZE, type Cell, type Direction, type Edge, type Fireball, type GameState, type RecordsSnapshot } from "./types";
import { randomInt, type RandomSource } from "./random";

export const FIREBALL_WARNING_DURATION = 0.72;
export const FIREBALL_OFFSCREEN_CELLS = 2.5;
export const FIREBALL_COLLISION_RADIUS = 0.42;
export const BENDING_FIREBALL_CHANCE = 0.05;
export const BENDING_FIREBALL_SCALE = 0.75;
export const BENDING_FIREBALL_SPEED_RATIO = 0.35;
export const BENDING_FIREBALL_MAX_TRAVEL_SECONDS = 10;
export const BENDING_FIREBALL_COOLDOWN_SPAWNS = 5;
export const BENDING_FIREBALL_FORCED_DELAY = 1.5;
export const BENDING_FIREBALL_MAX_ANGLE_RADIANS = Math.PI / 4;
export const BENDING_FIREBALL_TURN_RESPONSE = 0.75;
export const BENDING_FIREBALL_TURN_RATE_RADIANS = BENDING_FIREBALL_MAX_ANGLE_RADIANS * BENDING_FIREBALL_TURN_RESPONSE;

const EDGE_ORDER: Edge[] = ["up", "right", "down", "left"];
const FIREBALL_TRAVEL_CELLS = GRID_SIZE - 1 + FIREBALL_OFFSCREEN_CELLS * 2;
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
    bendingFireballCooldown: 0,
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
      .map((fireball) => updateFireball(fireball, state.player, deltaSeconds))
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
  const lane = randomInt(GRID_SIZE, random);
  const travelDuration = scheduleFireballTravelDuration(score);
  const start = getFireballStart(edge, lane);
  const velocity = getStraightFireballVelocity(edge, travelDuration);

  return {
    id,
    edge,
    lane,
    kind: "normal",
    targetLane: lane,
    row: start.row,
    col: start.col,
    velocityRow: velocity.row,
    velocityCol: velocity.col,
    age: 0,
    warningDuration: FIREBALL_WARNING_DURATION,
    travelDuration,
  };
}

export function createSpawnedFireball(
  score: number,
  id: number,
  player: Cell,
  canBend: boolean,
  random: RandomSource = Math.random,
): Fireball {
  const edge = EDGE_ORDER[randomInt(EDGE_ORDER.length, random)];
  const lane = randomInt(GRID_SIZE, random);
  const targetLane = getTargetLane(edge, player);
  const isBending = canBend && random() < BENDING_FIREBALL_CHANCE;
  const normalTravelDuration = scheduleFireballTravelDuration(score);
  const travelDuration = scheduleBendingFireballTravelDuration(score, isBending);
  const start = getFireballStart(edge, lane);
  const velocity = getStraightFireballVelocity(edge, normalTravelDuration, isBending ? BENDING_FIREBALL_SPEED_RATIO : 1);

  return {
    id,
    edge,
    lane,
    kind: isBending ? "bending" : "normal",
    targetLane,
    row: start.row,
    col: start.col,
    velocityRow: velocity.row,
    velocityCol: velocity.col,
    age: 0,
    warningDuration: FIREBALL_WARNING_DURATION,
    travelDuration,
  };
}

export function getFireballPosition(fireball: Fireball): FireballPosition {
  const progress = getFireballTravelProgress(fireball);
  const position =
    fireball.kind === "bending" && fireball.age >= fireball.warningDuration
      ? { row: fireball.row, col: fireball.col }
      : getStraightFireballPositionAtProgress(fireball, progress);

  return { ...position, progress, isWarning: fireball.age < fireball.warningDuration };
}

export function getFireballRotation(fireball: Fireball): number {
  if (fireball.kind === "normal") {
    return getStraightFireballAngle(fireball.edge);
  }

  const movementAngle = Math.atan2(fireball.velocityRow, fireball.velocityCol);
  return normalizeRadians(movementAngle - getStraightFireballAngle(fireball.edge));
}

export function scheduleBendingFireballTravelDuration(score: number, isBending = true): number {
  const duration = scheduleFireballTravelDuration(score);
  return isBending ? BENDING_FIREBALL_MAX_TRAVEL_SECONDS : duration;
}

function getStraightFireballPositionAtProgress(fireball: Fireball, progress: number): Omit<FireballPosition, "progress" | "isWarning"> {
  const start = -FIREBALL_OFFSCREEN_CELLS;
  const end = GRID_SIZE - 1 + FIREBALL_OFFSCREEN_CELLS;
  const forwardAxis = start + (end - start) * progress;
  const backwardAxis = end - (end - start) * progress;

  switch (fireball.edge) {
    case "left":
      return { row: fireball.lane, col: forwardAxis };
    case "right":
      return { row: fireball.lane, col: backwardAxis };
    case "up":
      return { row: forwardAxis, col: fireball.lane };
    case "down":
      return { row: backwardAxis, col: fireball.lane };
  }
}

export function fireballHitsCell(fireball: Fireball, cell: Cell): boolean {
  if (fireball.age < fireball.warningDuration) {
    return false;
  }

  const position = getFireballPosition(fireball);
  const radius = fireball.kind === "bending" ? FIREBALL_COLLISION_RADIUS * BENDING_FIREBALL_SCALE : FIREBALL_COLLISION_RADIUS;

  return Math.abs(position.row - cell.row) <= radius && Math.abs(position.col - cell.col) <= radius;
}

export function isPlayerHit(state: GameState): boolean {
  return state.fireballs.some((fireball) => fireballHitsCell(fireball, state.player));
}

export function scheduleFireballDelay(score: number): number {
  if (score >= 100) {
    return 0.4;
  }

  if (score >= 75) {
    return 0.5;
  }

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
  let bendingFireballCooldown = state.bendingFireballCooldown;
  let fireballs = state.fireballs;

  while (fireballSpawnClock >= nextFireballDelay) {
    fireballSpawnClock -= nextFireballDelay;
    const fireball = createSpawnedFireball(state.score, nextFireballId, state.player, bendingFireballCooldown === 0, random);
    fireballs = [...fireballs, fireball];
    nextFireballId += 1;

    if (fireball.kind === "bending") {
      bendingFireballCooldown = BENDING_FIREBALL_COOLDOWN_SPAWNS;
    } else if (bendingFireballCooldown > 0) {
      bendingFireballCooldown -= 1;
    }

    nextFireballDelay = bendingFireballCooldown > 0 ? BENDING_FIREBALL_FORCED_DELAY : scheduleFireballDelay(state.score);
  }

  return {
    ...state,
    fireballs,
    fireballSpawnClock,
    nextFireballDelay,
    nextFireballId,
    bendingFireballCooldown,
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

function updateFireball(fireball: Fireball, player: Cell, deltaSeconds: number): Fireball {
  if (fireball.kind !== "bending") {
    return { ...fireball, age: fireball.age + deltaSeconds };
  }

  const previousTravelAge = Math.max(0, fireball.age - fireball.warningDuration);
  const age = fireball.age + deltaSeconds;
  const travelAge = Math.max(0, age - fireball.warningDuration);
  const travelDelta = Math.min(fireball.travelDuration, travelAge) - Math.min(fireball.travelDuration, previousTravelAge);

  if (travelDelta <= 0) {
    return { ...fireball, age, targetLane: getTargetLane(fireball.edge, player) };
  }

  const targetRow = player.row;
  const targetCol = player.col;
  const currentAngle = Math.atan2(fireball.velocityRow, fireball.velocityCol);
  const targetAngle = Math.atan2(targetRow - fireball.row, targetCol - fireball.col);
  const turn = clamp(
    normalizeRadians(targetAngle - currentAngle),
    -BENDING_FIREBALL_TURN_RATE_RADIANS * travelDelta,
    BENDING_FIREBALL_TURN_RATE_RADIANS * travelDelta,
  );
  const nextAngle = currentAngle + turn;
  const speed = Math.hypot(fireball.velocityRow, fireball.velocityCol);
  const velocityRow = Math.sin(nextAngle) * speed;
  const velocityCol = Math.cos(nextAngle) * speed;

  return {
    ...fireball,
    age,
    targetLane: getTargetLane(fireball.edge, player),
    row: fireball.row + velocityRow * travelDelta,
    col: fireball.col + velocityCol * travelDelta,
    velocityRow,
    velocityCol,
  };
}

function getFireballStart(edge: Edge, lane: number): { row: number; col: number } {
  const start = -FIREBALL_OFFSCREEN_CELLS;
  const end = GRID_SIZE - 1 + FIREBALL_OFFSCREEN_CELLS;

  switch (edge) {
    case "left":
      return { row: lane, col: start };
    case "right":
      return { row: lane, col: end };
    case "up":
      return { row: start, col: lane };
    case "down":
      return { row: end, col: lane };
  }
}

function getStraightFireballVelocity(edge: Edge, travelDuration: number, speedScale = 1): { row: number; col: number } {
  const speed = (FIREBALL_TRAVEL_CELLS / travelDuration) * speedScale;

  switch (edge) {
    case "left":
      return { row: 0, col: speed };
    case "right":
      return { row: 0, col: -speed };
    case "up":
      return { row: speed, col: 0 };
    case "down":
      return { row: -speed, col: 0 };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getTargetLane(edge: Edge, player: Cell): number {
  return edge === "left" || edge === "right" ? player.row : player.col;
}

function getStraightFireballAngle(edge: Edge): number {
  switch (edge) {
    case "left":
      return 0;
    case "right":
      return Math.PI;
    case "up":
      return Math.PI / 2;
    case "down":
      return -Math.PI / 2;
  }
}

function normalizeRadians(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function markGameOver(state: GameState): GameState {
  return {
    ...state,
    gameStatus: "gameOver",
  };
}
