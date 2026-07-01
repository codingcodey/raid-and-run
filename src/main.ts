import "./styles.css";

import { assetPath } from "./asset-path";
import { GameAudio } from "./audio";
import { createInitialGameState, movePlayer, updateGame, withRecords } from "./game";
import { bindInput } from "./input";
import { LocalRecordsStore, MemoryRecordsStore } from "./records";
import { CANVAS_HEIGHT, CANVAS_WIDTH, renderGame } from "./render";
import type { Direction, GameState, RecordsStore } from "./types";

const FIXED_STEP_SECONDS = 1 / 60;
const MAX_FRAME_SECONDS = 0.12;

const canvasElement = document.querySelector<HTMLCanvasElement>("#game");
const restartButtonElement = document.querySelector<HTMLButtonElement>("#restart");

if (!canvasElement || !restartButtonElement) {
  throw new Error("Raid and Run failed to mount.");
}

const canvas = canvasElement;
const restartButton = restartButtonElement;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
canvas.tabIndex = 0;
restartButton.style.backgroundImage = `url("${assetPath("assets/restart-button.png")}")`;

const canvasContext = canvas.getContext("2d");

if (!canvasContext) {
  throw new Error("Canvas rendering is not supported.");
}

const ctx = canvasContext;

const records = createRecordsStore();
const audio = new GameAudio();
let state: GameState = createInitialGameState(records.load());
let accumulator = 0;
let lastFrameTime = performance.now();

const restart = () => {
  audio.unlock(state);
  state = createInitialGameState(records.load());
  audio.reset(state);
  audio.playButtonClick();
  syncRestartButton();
  canvas.focus({ preventScroll: true });
};

const dispatchMove = (direction: Direction) => {
  const previousStatus = state.gameStatus;
  const previousScore = state.score;
  audio.unlock(state);
  state = movePlayer(state, direction);
  if (state.score > previousScore) {
    if (previousScore === 0) {
      audio.playFirstCoin();
    } else {
      audio.playCoin();
    }
  }
  audio.syncMusic(state);
  commitGameOver(previousStatus);
};

bindInput(canvas, {
  move: dispatchMove,
  restart,
  getPlayer: () => state.player,
  getStatus: () => state.gameStatus,
});

restartButton.addEventListener("click", restart);
canvas.addEventListener("pointerdown", () => audio.unlock(state));
canvas.addEventListener("click", () => {
  audio.unlock(state);
  canvas.focus({ preventScroll: true });
});
syncRestartButton();
requestAnimationFrame(tick);

function tick(now: number): void {
  const frameSeconds = Math.min(MAX_FRAME_SECONDS, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  if (state.gameStatus === "playing") {
    accumulator += frameSeconds;

    while (accumulator >= FIXED_STEP_SECONDS) {
      const previousStatus = state.gameStatus;
      const previousFireballId = state.nextFireballId;
      state = updateGame(state, FIXED_STEP_SECONDS);
      accumulator -= FIXED_STEP_SECONDS;
      if (state.nextFireballId > previousFireballId) {
        audio.playFireball();
      }
      audio.syncMusic(state);
      commitGameOver(previousStatus);

      if (state.gameStatus === "gameOver") {
        accumulator = 0;
        break;
      }
    }
  } else {
    accumulator = 0;
  }

  renderGame(ctx, state);
  requestAnimationFrame(tick);
}

function commitGameOver(previousStatus: GameState["gameStatus"]): void {
  if (previousStatus === "playing" && state.gameStatus === "gameOver") {
    state = withRecords(state, records.save(state.score));
    audio.playDeathSequence();
    syncRestartButton();
  }
}

function syncRestartButton(): void {
  restartButton.classList.toggle("is-visible", state.gameStatus === "gameOver");
}

function createRecordsStore(): RecordsStore {
  try {
    return new LocalRecordsStore(window.localStorage);
  } catch {
    return new MemoryRecordsStore();
  }
}
