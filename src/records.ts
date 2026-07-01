import type { RecordsSnapshot, RecordsStore } from "./types";

const BEST_SCORE_KEY = "raid-and-run.bestScore";
const WORLD_RECORD_KEY = "raid-and-run.worldRecord";

function readNumber(storage: Storage, key: string): number {
  const value = Number(storage.getItem(key));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export class LocalRecordsStore implements RecordsStore {
  constructor(private readonly storage: Storage) {}

  load(): RecordsSnapshot {
    const bestScore = readNumber(this.storage, BEST_SCORE_KEY);
    const worldRecord = Math.max(bestScore, readNumber(this.storage, WORLD_RECORD_KEY));
    return { bestScore, worldRecord };
  }

  save(score: number): RecordsSnapshot {
    const current = this.load();
    const nextBest = Math.max(current.bestScore, score);
    const nextWorld = Math.max(current.worldRecord, score);

    this.storage.setItem(BEST_SCORE_KEY, String(nextBest));
    this.storage.setItem(WORLD_RECORD_KEY, String(nextWorld));

    return { bestScore: nextBest, worldRecord: nextWorld };
  }
}

export class MemoryRecordsStore implements RecordsStore {
  private snapshot: RecordsSnapshot;

  constructor(initial: RecordsSnapshot = { bestScore: 0, worldRecord: 0 }) {
    this.snapshot = { ...initial };
  }

  load(): RecordsSnapshot {
    return { ...this.snapshot };
  }

  save(score: number): RecordsSnapshot {
    this.snapshot = {
      bestScore: Math.max(this.snapshot.bestScore, score),
      worldRecord: Math.max(this.snapshot.worldRecord, score),
    };

    return this.load();
  }
}
