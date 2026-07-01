import type { Cell, Direction, GameStatus } from "./types";
import { CANVAS_HEIGHT, CANVAS_WIDTH, canvasPointToCell } from "./render";

interface InputCallbacks {
  move(direction: Direction): void;
  restart(): void;
  getPlayer(): Cell;
  getStatus(): GameStatus;
}

const KEY_DIRECTIONS: Record<string, Direction | undefined> = {
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowLeft: "left",
  w: "up",
  d: "right",
  s: "down",
  a: "left",
};
const RESTART_KEYS = new Set(["Enter", " ", "r", "w", "ArrowUp"]);
const HOLD_REPEAT_DELAY_MS = 225;
const MOVE_REPEAT_MS = 135;
const SWIPE_THRESHOLD = 20;

export function bindInput(canvas: HTMLCanvasElement, callbacks: InputCallbacks): () => void {
  let pointerState: { id: number; start: { x: number; y: number }; didMove: boolean } | null = null;
  let heldDirection: Direction | null = null;
  let repeatDelayTimer: number | null = null;
  let repeatTimer: number | null = null;

  const moveNow = (direction: Direction) => {
    callbacks.move(direction);
  };

  const stopHeldMove = () => {
    if (repeatDelayTimer !== null) {
      window.clearTimeout(repeatDelayTimer);
      repeatDelayTimer = null;
    }

    if (repeatTimer !== null) {
      window.clearInterval(repeatTimer);
      repeatTimer = null;
    }

    heldDirection = null;
  };

  const startHeldMove = (direction: Direction) => {
    if (callbacks.getStatus() !== "playing") {
      return;
    }

    if (heldDirection === direction && (repeatDelayTimer !== null || repeatTimer !== null)) {
      return;
    }

    stopHeldMove();
    heldDirection = direction;
    moveNow(direction);
    repeatDelayTimer = window.setTimeout(() => {
      repeatDelayTimer = null;

      if (callbacks.getStatus() !== "playing" || heldDirection !== direction) {
        stopHeldMove();
        return;
      }

      repeatTimer = window.setInterval(() => {
        if (callbacks.getStatus() !== "playing") {
          stopHeldMove();
          return;
        }

        moveNow(direction);
      }, MOVE_REPEAT_MS);
    }, HOLD_REPEAT_DELAY_MS);
  };

  const changeHeldDirection = (direction: Direction) => {
    if (heldDirection === direction) {
      return;
    }

    startHeldMove(direction);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (callbacks.getStatus() === "gameOver" && isRestartKey(event.key)) {
      event.preventDefault();
      callbacks.restart();
      return;
    }

    const direction = KEY_DIRECTIONS[event.key] ?? KEY_DIRECTIONS[event.key.toLowerCase()];

    if (direction) {
      event.preventDefault();
      startHeldMove(direction);
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    const direction = KEY_DIRECTIONS[event.key] ?? KEY_DIRECTIONS[event.key.toLowerCase()];

    if (direction && direction === heldDirection) {
      stopHeldMove();
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary) {
      return;
    }

    const point = toCanvasPoint(canvas, event.clientX, event.clientY);
    pointerState = { id: event.pointerId, start: point, didMove: false };
    canvas.setPointerCapture(event.pointerId);

    const tappedCell = canvasPointToCell(point.x, point.y);
    const direction = tappedCell ? directionFromCells(callbacks.getPlayer(), tappedCell) : null;

    if (direction) {
      pointerState.didMove = true;
      startHeldMove(direction);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!event.isPrimary || !pointerState || pointerState.id !== event.pointerId) {
      return;
    }

    const point = toCanvasPoint(canvas, event.clientX, event.clientY);
    const deltaX = point.x - pointerState.start.x;
    const deltaY = point.y - pointerState.start.y;

    if (Math.hypot(deltaX, deltaY) >= SWIPE_THRESHOLD) {
      pointerState.didMove = true;
      changeHeldDirection(directionFromDelta(deltaX, deltaY));
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!event.isPrimary || !pointerState || pointerState.id !== event.pointerId) {
      return;
    }

    const pointerEnd = toCanvasPoint(canvas, event.clientX, event.clientY);
    const deltaX = pointerEnd.x - pointerState.start.x;
    const deltaY = pointerEnd.y - pointerState.start.y;
    const distance = Math.hypot(deltaX, deltaY);
    const didMove = pointerState.didMove;
    pointerState = null;
    stopHeldMove();

    if (callbacks.getStatus() === "gameOver") {
      callbacks.restart();
      return;
    }

    if (didMove) {
      return;
    }

    if (distance >= SWIPE_THRESHOLD) {
      moveNow(directionFromDelta(deltaX, deltaY));
      return;
    }

    const tappedCell = canvasPointToCell(pointerEnd.x, pointerEnd.y);

    if (tappedCell) {
      const direction = directionFromCells(callbacks.getPlayer(), tappedCell);

      if (direction) {
        moveNow(direction);
      }
    }
  };
  const onPointerCancel = () => {
    pointerState = null;
    stopHeldMove();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);

  return () => {
    stopHeldMove();
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
  };
}

function isRestartKey(key: string): boolean {
  return RESTART_KEYS.has(key) || RESTART_KEYS.has(key.toLowerCase());
}

function toCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((clientX - rect.left) / rect.width) * CANVAS_WIDTH,
    y: ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
  };
}

function directionFromDelta(deltaX: number, deltaY: number): Direction {
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0 ? "right" : "left";
  }

  return deltaY > 0 ? "down" : "up";
}

function directionFromCells(player: Cell, target: Cell): Direction | null {
  const deltaRow = target.row - player.row;
  const deltaCol = target.col - player.col;

  if (deltaRow === 0 && deltaCol === 0) {
    return null;
  }

  if (Math.abs(deltaCol) >= Math.abs(deltaRow)) {
    return deltaCol > 0 ? "right" : "left";
  }

  return deltaRow > 0 ? "down" : "up";
}
