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
const pauseButtonElement = document.querySelector<HTMLButtonElement>("#pause");

if (!canvasElement || !restartButtonElement || !pauseButtonElement) {
  throw new Error("Raid and Run failed to mount.");
}

const canvas = canvasElement;
const restartButton = restartButtonElement;
const pauseButton = pauseButtonElement;

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
  syncControls();
  canvas.focus({ preventScroll: true });
};

const togglePause = () => {
  if (state.gameStatus === "gameOver") {
    return;
  }

  audio.unlock(state);
  audio.playButtonClick();
  state = {
    ...state,
    gameStatus: state.gameStatus === "paused" ? "playing" : "paused",
  };
  syncControls();
  canvas.focus({ preventScroll: true });
};

const dispatchMove = (direction: Direction) => {
  if (state.gameStatus !== "playing") {
    return;
  }

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
  togglePause,
  restart,
  getPlayer: () => state.player,
  getStatus: () => state.gameStatus,
});

restartButton.addEventListener("click", restart);
pauseButton.addEventListener("click", togglePause);
canvas.addEventListener("pointerdown", () => audio.unlock(state));
canvas.addEventListener("click", () => {
  audio.unlock(state);
  canvas.focus({ preventScroll: true });
});
syncControls();
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
    syncControls();
  }
}

function syncControls(): void {
  restartButton.classList.toggle("is-visible", state.gameStatus === "gameOver");
  pauseButton.classList.toggle("is-hidden", state.gameStatus === "gameOver");
  pauseButton.classList.toggle("is-paused", state.gameStatus === "paused");
  pauseButton.setAttribute("aria-pressed", String(state.gameStatus === "paused"));
}

function createRecordsStore(): RecordsStore {
  try {
    return new LocalRecordsStore(window.localStorage);
  } catch {
    return new MemoryRecordsStore();
  }
}
