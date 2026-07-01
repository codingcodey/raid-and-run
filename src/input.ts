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

export function bindInput(canvas: HTMLCanvasElement, callbacks: InputCallbacks): () => void {
  let pointerStart: { x: number; y: number } | null = null;
  let lastMoveAt = 0;

  const requestMove = (direction: Direction) => {
    const now = performance.now();

    if (now - lastMoveAt < 85) {
      return;
    }

    lastMoveAt = now;
    callbacks.move(direction);
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
      requestMove(direction);
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary) {
      return;
    }

    pointerStart = toCanvasPoint(canvas, event.clientX, event.clientY);
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!event.isPrimary || !pointerStart) {
      return;
    }

    const pointerEnd = toCanvasPoint(canvas, event.clientX, event.clientY);
    const deltaX = pointerEnd.x - pointerStart.x;
    const deltaY = pointerEnd.y - pointerStart.y;
    const distance = Math.hypot(deltaX, deltaY);
    pointerStart = null;

    if (callbacks.getStatus() === "gameOver") {
      callbacks.restart();
      return;
    }

    if (distance >= 20) {
      requestMove(directionFromDelta(deltaX, deltaY));
      return;
    }

    const tappedCell = canvasPointToCell(pointerEnd.x, pointerEnd.y);

    if (tappedCell) {
      const direction = directionFromCells(callbacks.getPlayer(), tappedCell);

      if (direction) {
        requestMove(direction);
      }
    }
  };
  const onPointerCancel = () => {
    pointerStart = null;
  };

  window.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("pointerdown", onPointerDown);
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
