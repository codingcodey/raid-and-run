import { describe, expect, it } from "vitest";

import {
  BENDING_FIREBALL_COOLDOWN_SPAWNS,
  BENDING_FIREBALL_FORCED_DELAY,
  BENDING_FIREBALL_MAX_ANGLE_RADIANS,
  BENDING_FIREBALL_MAX_TRAVEL_SECONDS,
  BENDING_FIREBALL_SCALE,
  BENDING_FIREBALL_SPEED_RATIO,
  BENDING_FIREBALL_TURN_RESPONSE,
  createFireball,
  createInitialGameState,
  createSpawnedFireball,
  FIREBALL_WARNING_DURATION,
  FIREBALL_COLLISION_RADIUS,
  fireballHitsCell,
  getFireballPosition,
  getFireballRotation,
  movePlayer,
  scheduleFireballDelay,
  scheduleFireballTravelDuration,
  updateGame,
} from "./game";
import { MemoryRecordsStore } from "./records";
import type { Fireball, GameState } from "./types";

const records = { bestScore: 0, worldRecord: 0 };

function fixedRandom(value: number): () => number {
  return () => value;
}

function sequenceRandom(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
}

function baseState(): GameState {
  return createInitialGameState(records, fixedRandom(0));
}

function fireballFixture(overrides: Partial<Fireball> = {}): Fireball {
  return {
    id: 1,
    edge: "left",
    lane: 2,
    kind: "normal",
    targetLane: 2,
    row: 2,
    col: -2.5,
    velocityRow: 0,
    velocityCol: 1,
    age: 0,
    warningDuration: FIREBALL_WARNING_DURATION,
    travelDuration: scheduleFireballTravelDuration(1),
    ...overrides,
  };
}

describe("game setup", () => {
  it("starts the player in the center and spawns the first coin elsewhere", () => {
    const state = baseState();

    expect(state.player).toEqual({ row: 2, col: 2 });
    expect(state.playerFacing).toBe("down");
    expect(state.coin).not.toEqual(state.player);
    expect(state.score).toBe(0);
    expect(state.fireballs).toHaveLength(0);
  });

  it("keeps score records on the state", () => {
    const state = createInitialGameState({ bestScore: 9, worldRecord: 14 }, fixedRandom(0));

    expect(state.bestScore).toBe(9);
    expect(state.worldRecord).toBe(14);
  });
});

describe("coins and movement", () => {
  it("moves one cell at a time and clamps to the board", () => {
    let state = baseState();

    state = movePlayer(state, "left", fixedRandom(0));
    state = movePlayer(state, "left", fixedRandom(0));
    state = movePlayer(state, "left", fixedRandom(0));
    state = movePlayer(state, "up", fixedRandom(0));
    state = movePlayer(state, "up", fixedRandom(0));
    state = movePlayer(state, "up", fixedRandom(0));

    expect(state.player).toEqual({ row: 0, col: 0 });
  });

  it("persists the last movement direction for sprite animation", () => {
    let state = baseState();

    state = movePlayer(state, "left", fixedRandom(0));
    expect(state.playerFacing).toBe("left");

    state = updateGame(state, 1, fixedRandom(0));
    expect(state.playerFacing).toBe("left");

    state = movePlayer(state, "right", fixedRandom(0));
    expect(state.playerFacing).toBe("right");
  });

  it("collects a coin, increments score, and immediately spawns another coin", () => {
    const state: GameState = {
      ...baseState(),
      player: { row: 2, col: 2 },
      coin: { row: 2, col: 3 },
    };

    const nextState = movePlayer(state, "right", fixedRandom(0));

    expect(nextState.score).toBe(1);
    expect(nextState.player).toEqual({ row: 2, col: 3 });
    expect(nextState.previousCoin).toEqual({ row: 2, col: 3 });
    expect(nextState.coin).not.toEqual(nextState.player);
  });
});

describe("fireballs", () => {
  it("does not spawn fireballs before the first coin is collected", () => {
    const state = updateGame({ ...baseState(), score: 0 }, 30, fixedRandom(0));

    expect(state.fireballs).toHaveLength(0);
    expect(state.gameStatus).toBe("playing");
  });

  it("starts fireball spawning 1.5 seconds after the first coin is collected", () => {
    const state: GameState = {
      ...baseState(),
      score: 0,
      nextFireballDelay: scheduleFireballDelay(0),
      player: { row: 2, col: 2 },
      coin: { row: 2, col: 3 },
    };

    const afterCoin = movePlayer(state, "right", fixedRandom(0));
    const beforeDelay = updateGame(afterCoin, 1.49, fixedRandom(0));
    const afterDelay = updateGame(afterCoin, 1.5, fixedRandom(0));

    expect(beforeDelay.fireballs).toHaveLength(0);
    expect(afterDelay.score).toBe(1);
    expect(afterDelay.fireballs).toHaveLength(1);
    expect(afterDelay.fireballs[0].age).toBe(0);
  });

  it("uses faster fireball spawn intervals at 10, 25, 50, 75, and 100 points", () => {
    const state: GameState = {
      ...baseState(),
      score: 25,
      nextFireballDelay: scheduleFireballDelay(25),
    };

    const beforeDelay = updateGame(state, 0.79, fixedRandom(0));
    const afterDelay = updateGame(state, 0.8, fixedRandom(0));

    expect(scheduleFireballDelay(1)).toBe(1.5);
    expect(scheduleFireballDelay(9)).toBe(1.5);
    expect(scheduleFireballDelay(10)).toBe(1);
    expect(scheduleFireballDelay(24)).toBe(1);
    expect(scheduleFireballDelay(25)).toBe(0.8);
    expect(scheduleFireballDelay(49)).toBe(0.8);
    expect(scheduleFireballDelay(50)).toBe(0.6);
    expect(scheduleFireballDelay(74)).toBe(0.6);
    expect(scheduleFireballDelay(75)).toBe(0.5);
    expect(scheduleFireballDelay(99)).toBe(0.5);
    expect(scheduleFireballDelay(100)).toBe(0.4);
    expect(beforeDelay.fireballs).toHaveLength(0);
    expect(afterDelay.fireballs).toHaveLength(1);
  });

  it("chooses a random edge and lane for each fireball", () => {
    const fireball = createFireball(1, 7, sequenceRandom([0.99, 0.99]));

    expect(fireball.edge).toBe("left");
    expect(fireball.lane).toBe(4);
    expect(fireball.id).toBe(7);
    expect(fireball.kind).toBe("normal");
  });

  it("rotates straight fireballs from the left-entry sprite orientation", () => {
    expect(getFireballRotation(fireballFixture({ edge: "left" }))).toBe(0);
    expect(getFireballRotation(fireballFixture({ edge: "right" }))).toBe(Math.PI);
    expect(getFireballRotation(fireballFixture({ edge: "up" }))).toBe(Math.PI / 2);
    expect(getFireballRotation(fireballFixture({ edge: "down" }))).toBe(-Math.PI / 2);
  });

  it("can spawn a rare bending fireball that curves toward the player lane without exceeding 45 degrees", () => {
    const fireball = createSpawnedFireball(1, 7, { row: 4, col: 2 }, true, sequenceRandom([0.99, 0, 0.01]));

    expect(fireball.edge).toBe("left");
    expect(fireball.lane).toBe(0);
    expect(fireball.kind).toBe("bending");
    expect(fireball.targetLane).toBe(4);
    const normalSpeed = 9 / scheduleFireballTravelDuration(1);
    const bendingSpeed = Math.hypot(fireball.velocityRow, fireball.velocityCol);

    expect(BENDING_FIREBALL_SPEED_RATIO).toBe(0.35);
    expect(fireball.travelDuration).toBe(BENDING_FIREBALL_MAX_TRAVEL_SECONDS);
    expect(bendingSpeed).toBeCloseTo(normalSpeed * BENDING_FIREBALL_SPEED_RATIO);

    const movingState = updateGame(
      {
        ...baseState(),
        score: 1,
        player: { row: 4, col: 2 },
        fireballs: [fireball],
        nextFireballDelay: 100,
      },
      FIREBALL_WARNING_DURATION + fireball.travelDuration / 2,
      fixedRandom(0),
    );
    const movedFireball = movingState.fireballs[0];
    const middlePosition = getFireballPosition(movedFireball);

    expect(BENDING_FIREBALL_MAX_ANGLE_RADIANS).toBe(Math.PI / 4);
    expect(BENDING_FIREBALL_TURN_RESPONSE).toBe(0.75);
    expect(middlePosition.row).toBeGreaterThan(0);
    expect(middlePosition.row).toBeLessThan(4);
    expect(getFireballRotation(movedFireball)).toBeGreaterThan(0);
  });

  it("chases the player's current location from any edge without hopping lanes or changing speed", () => {
    const leftFireball = fireballFixture({
      edge: "left",
      lane: 0,
      kind: "bending",
      targetLane: 0,
      row: 0,
      col: -2.5,
      velocityRow: 0,
      velocityCol: 1.8,
      age: FIREBALL_WARNING_DURATION,
      travelDuration: BENDING_FIREBALL_MAX_TRAVEL_SECONDS,
    });
    const topFireball = fireballFixture({
      ...leftFireball,
      id: 2,
      edge: "up",
      row: -2.5,
      col: 0,
      velocityRow: 1.8,
      velocityCol: 0,
    });
    const state: GameState = {
      ...baseState(),
      score: 1,
      player: { row: 4, col: 3 },
      fireballs: [leftFireball, topFireball],
      nextFireballDelay: 100,
    };

    const nextState = updateGame(state, 0.25, fixedRandom(0));
    const leftSpeed = Math.hypot(nextState.fireballs[0].velocityRow, nextState.fireballs[0].velocityCol);
    const topSpeed = Math.hypot(nextState.fireballs[1].velocityRow, nextState.fireballs[1].velocityCol);

    expect(nextState.fireballs[0].targetLane).toBe(4);
    expect(nextState.fireballs[1].targetLane).toBe(3);
    expect(nextState.fireballs[0].row).toBeGreaterThan(0);
    expect(nextState.fireballs[0].row).toBeLessThan(0.2);
    expect(leftSpeed).toBeCloseTo(1.8);
    expect(topSpeed).toBeCloseTo(1.8);
  });

  it("forces the next five fireballs to be normal and spawn 1.5 seconds apart after a bending fireball", () => {
    const state: GameState = {
      ...baseState(),
      score: 1,
      player: { row: 4, col: 4 },
      nextFireballDelay: scheduleFireballDelay(1),
    };

    const afterBending = updateGame(state, 1.5, sequenceRandom([0.99, 0, 0.01]));
    const afterForcedNormals = updateGame(afterBending, 7.5, fixedRandom(0));

    expect(afterBending.fireballs[0].kind).toBe("bending");
    expect(afterBending.bendingFireballCooldown).toBe(BENDING_FIREBALL_COOLDOWN_SPAWNS);
    expect(afterBending.nextFireballDelay).toBe(BENDING_FIREBALL_FORCED_DELAY);
    expect(afterForcedNormals.fireballs.filter((fireball) => fireball.kind === "normal")).toHaveLength(5);
    expect(afterForcedNormals.fireballs.filter((fireball) => fireball.kind === "bending")).toHaveLength(1);
    expect(afterForcedNormals.bendingFireballCooldown).toBe(0);
    expect(afterForcedNormals.nextFireballDelay).toBe(scheduleFireballDelay(1));
  });

  it("uses a smaller hitbox for bending fireballs", () => {
    const fireball = fireballFixture({
      lane: 0,
      kind: "bending",
      targetLane: 4,
      row: 1,
      col: 1,
      velocityRow: 0,
      velocityCol: 1.8,
      age: FIREBALL_WARNING_DURATION,
      travelDuration: BENDING_FIREBALL_MAX_TRAVEL_SECONDS,
    });
    const position = getFireballPosition(fireball);
    const nearCell = { row: Math.round(position.row), col: Math.round(position.col) };

    expect(BENDING_FIREBALL_SCALE).toBe(0.75);
    expect(FIREBALL_COLLISION_RADIUS * BENDING_FIREBALL_SCALE).toBeLessThan(FIREBALL_COLLISION_RADIUS);
    expect(fireballHitsCell(fireball, nearCell)).toBe(true);
  });

  it("warns outside the grid before becoming dangerous", () => {
    const fireball = fireballFixture({
      edge: "left",
      lane: 2,
      age: FIREBALL_WARNING_DURATION / 2,
    });

    const position = getFireballPosition(fireball);

    expect(position.isWarning).toBe(true);
    expect(position.col).toBeLessThan(0);
    expect(fireballHitsCell(fireball, { row: 2, col: 0 })).toBe(false);
  });

  it("travels through its lane and hits the player", () => {
    const travelDuration = scheduleFireballTravelDuration(1);
    const fireball = fireballFixture({
      edge: "left",
      lane: 2,
      age: FIREBALL_WARNING_DURATION + travelDuration / 2,
      travelDuration,
    });

    const state: GameState = {
      ...baseState(),
      player: { row: 2, col: 2 },
      fireballs: [fireball],
      score: 1,
      nextFireballDelay: 100,
    };

    expect(getFireballPosition(fireball).col).toBeCloseTo(2);
    expect(updateGame(state, 0, fixedRandom(0)).gameStatus).toBe("gameOver");
  });

  it("disappears after crossing to the opposite side", () => {
    const travelDuration = scheduleFireballTravelDuration(1);
    const fireball = fireballFixture({
      edge: "up",
      lane: 4,
      targetLane: 4,
      age: FIREBALL_WARNING_DURATION + travelDuration - 0.01,
      travelDuration,
    });
    const state: GameState = {
      ...baseState(),
      player: { row: 0, col: 0 },
      fireballs: [fireball],
      score: 1,
      nextFireballDelay: 100,
    };

    const nextState = updateGame(state, 0.2, fixedRandom(0));

    expect(nextState.fireballs).toHaveLength(0);
    expect(nextState.gameStatus).toBe("playing");
  });
});

describe("records", () => {
  it("persists best score and local world record through the records interface", () => {
    const store = new MemoryRecordsStore({ bestScore: 4, worldRecord: 6 });

    expect(store.save(5)).toEqual({ bestScore: 5, worldRecord: 6 });
    expect(store.save(8)).toEqual({ bestScore: 8, worldRecord: 8 });
    expect(store.load()).toEqual({ bestScore: 8, worldRecord: 8 });
  });
});
