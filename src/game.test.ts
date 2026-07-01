import { describe, expect, it } from "vitest";

import {
  createFireball,
  createInitialGameState,
  FIREBALL_WARNING_DURATION,
  fireballHitsCell,
  getFireballPosition,
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
  });

  it("warns outside the grid before becoming dangerous", () => {
    const fireball: Fireball = {
      id: 1,
      edge: "left",
      lane: 2,
      age: FIREBALL_WARNING_DURATION / 2,
      warningDuration: FIREBALL_WARNING_DURATION,
      travelDuration: scheduleFireballTravelDuration(1),
    };

    const position = getFireballPosition(fireball);

    expect(position.isWarning).toBe(true);
    expect(position.col).toBeLessThan(0);
    expect(fireballHitsCell(fireball, { row: 2, col: 0 })).toBe(false);
  });

  it("travels through its lane and hits the player", () => {
    const travelDuration = scheduleFireballTravelDuration(1);
    const fireball: Fireball = {
      id: 1,
      edge: "left",
      lane: 2,
      age: FIREBALL_WARNING_DURATION + travelDuration / 2,
      warningDuration: FIREBALL_WARNING_DURATION,
      travelDuration,
    };

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
    const fireball: Fireball = {
      id: 1,
      edge: "up",
      lane: 4,
      age: FIREBALL_WARNING_DURATION + travelDuration - 0.01,
      warningDuration: FIREBALL_WARNING_DURATION,
      travelDuration,
    };
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
