import { assetPath } from "./asset-path";
import { GRID_SIZE, type Cell, type Edge, type Fireball, type GameState } from "./types";
import { BENDING_FIREBALL_SCALE, getFireballPosition, getFireballRotation } from "./game";

export const CANVAS_WIDTH = 420;
export const CANVAS_HEIGHT = 620;
export const CELL_SIZE = 64;
export const CELL_GAP = 8;
export const GRID_LEFT = 34;
export const GRID_TOP = 148;
export const GRID_STRIDE = CELL_SIZE + CELL_GAP;
export const GRID_PIXEL_SIZE = GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * CELL_GAP;

const ICE_MAP_SRC = assetPath("assets/ice-map.png");
const ICE_MAP_SCALE = 0.713;
const ICE_MAP_GRID_LEFT = 204;
const ICE_MAP_GRID_TOP = 374;
const ICE_MAP_CROP_X = 192;
const ICE_MAP_CROP_Y = 364;
const ICE_MAP_CROP_WIDTH = 522;
const ICE_MAP_CROP_HEIGHT = 574;
const ICE_MAP_DEST_X = Math.round(GRID_LEFT - (ICE_MAP_GRID_LEFT - ICE_MAP_CROP_X) * ICE_MAP_SCALE);
const ICE_MAP_DEST_Y = Math.round(GRID_TOP - (ICE_MAP_GRID_TOP - ICE_MAP_CROP_Y) * ICE_MAP_SCALE);
const PLAYER_FRAME_SECONDS = 0.18;
const PLAYER_SPRITE_SCALE = 0.205;
const PLAYER_VERTICAL_OFFSET = -4;
const PLAYER_SHADOW_WIDTH = 52;
const PLAYER_SHADOW_ALPHA = 0.42;
const COIN_FRAME_SECONDS = 0.12;
const COIN_CELL_HEIGHT = 42;
const COIN_SHADOW_WIDTH = 42;
const COIN_HUD_HEIGHT = 30;
const GAME_OVER_BANNER_X = 35;
const GAME_OVER_BANNER_Y = 100;
const GAME_OVER_BANNER_WIDTH = 350;
const GAME_OVER_BANNER_HEIGHT = 45;
const SCORE_BANNER_X = 38;
const SCORE_BANNER_Y = 248;
const SCORE_BANNER_WIDTH = 344;
const SCORE_BANNER_HEIGHT = 170;
const SCORE_VALUE_X = 318;
const WARNING_FRAME_SECONDS = 0.08;
const WARNING_HEIGHT = 54;
const FIREBALL_FRAME_SECONDS = 0.08;
const FIREBALL_SIDE_HEIGHT = 52;
const FIREBALL_VERTICAL_HEIGHT = 58;

interface SpriteFrame {
  image: HTMLImageElement | null;
  ready: boolean;
}

type PlayerLoopName = "default" | "left";

const SNOW_PIXELS = [
  [26, 18, 1, 0.24, 12],
  [70, 82, 1, 0.17, 14],
  [96, 44, 1, 0.2, 16],
  [142, 8, 1, 0.18, 13],
  [172, 22, 2, 0.16, 10],
  [252, 56, 1, 0.22, 13],
  [292, 12, 1, 0.19, 15],
  [336, 30, 1, 0.18, 19],
  [390, 84, 2, 0.15, 11],
  [48, 136, 2, 0.18, 17],
  [126, 104, 1, 0.23, 9],
  [178, 156, 1, 0.17, 14],
  [214, 132, 1, 0.15, 15],
  [304, 116, 2, 0.19, 8],
  [352, 138, 1, 0.17, 12],
  [376, 168, 1, 0.22, 18],
  [18, 228, 1, 0.16, 10],
  [86, 202, 2, 0.19, 13],
  [132, 258, 1, 0.18, 16],
  [164, 246, 1, 0.24, 19],
  [244, 210, 1, 0.18, 11],
  [276, 286, 1, 0.16, 14],
  [324, 266, 2, 0.15, 16],
  [398, 240, 1, 0.21, 9],
  [42, 334, 1, 0.2, 15],
  [92, 382, 1, 0.16, 12],
  [118, 306, 2, 0.15, 10],
  [196, 352, 1, 0.22, 17],
  [248, 392, 1, 0.18, 13],
  [282, 322, 1, 0.17, 8],
  [360, 370, 2, 0.16, 18],
  [402, 336, 1, 0.19, 11],
  [68, 442, 1, 0.21, 12],
  [116, 488, 1, 0.17, 15],
  [148, 420, 1, 0.18, 16],
  [226, 468, 2, 0.15, 9],
  [268, 510, 1, 0.17, 13],
  [308, 438, 1, 0.23, 19],
  [388, 496, 1, 0.19, 11],
  [30, 558, 2, 0.15, 14],
  [84, 596, 1, 0.18, 10],
  [116, 532, 1, 0.22, 8],
  [202, 584, 1, 0.18, 18],
  [252, 620, 1, 0.16, 13],
  [286, 548, 2, 0.16, 10],
  [366, 602, 1, 0.2, 16],
] as const;

let iceMapImage: HTMLImageElement | null = null;
let isIceMapReady = false;
const playerSprites: Record<PlayerLoopName, SpriteFrame[]> = {
  default: [
    createSpriteFrame(assetPath("assets/player-default-1.png")),
    createSpriteFrame(assetPath("assets/player-default-2.png")),
  ],
  left: [
    createSpriteFrame(assetPath("assets/player-left-1.png")),
    createSpriteFrame(assetPath("assets/player-left-2.png")),
  ],
};
const playerShadow = createSpriteFrame(assetPath("assets/player-shadow.png"));
const coinSprites = createNumberedSpriteFrames("assets/coin", 6);
const warningSprites = createNumberedSpriteFrames("assets/warning", 3);
const gameOverBanner = createSpriteFrame(assetPath("assets/game-over-banner.png"));
const scoreBanner = createSpriteFrame(assetPath("assets/score-banner.png"));
const fireballLeftSprites = createNumberedSpriteFrames("assets/fireball-left", 4);
const bendingFireballSprites = createNumberedSpriteFrames("assets/bending-fireball", 4);
const fireballRightSprites = createNumberedSpriteFrames("assets/fireball-right", 4);
const fireballBottomSprites = createNumberedSpriteFrames("assets/fireball-bottom", 4);
const fireballTopSprites = createNumberedSpriteFrames("assets/fireball-top", 4);
const fireballSpriteConfigs: Record<Edge, { frames: SpriteFrame[]; height: number }> = {
  left: { frames: fireballLeftSprites, height: FIREBALL_SIDE_HEIGHT },
  right: { frames: fireballRightSprites, height: FIREBALL_SIDE_HEIGHT },
  up: { frames: fireballTopSprites, height: FIREBALL_VERTICAL_HEIGHT },
  down: { frames: fireballBottomSprites, height: FIREBALL_VERTICAL_HEIGHT },
};

if (typeof Image !== "undefined") {
  iceMapImage = new Image();
  iceMapImage.onload = () => {
    isIceMapReady = true;
  };
  iceMapImage.src = ICE_MAP_SRC;
}

function createSpriteFrame(src: string): SpriteFrame {
  if (typeof Image === "undefined") {
    return {
      image: null,
      ready: false,
    };
  }

  const frame = {
    image: new Image(),
    ready: false,
  };

  frame.image.onload = () => {
    frame.ready = true;
  };
  frame.image.src = src;

  return frame;
}

function createNumberedSpriteFrames(prefix: string, count: number): SpriteFrame[] {
  return Array.from({ length: count }, (_, index) => createSpriteFrame(assetPath(`${prefix}-${index + 1}.png`)));
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawBackground(ctx, state.elapsed);
  drawBoard(ctx, state.elapsed);
  drawWarnings(ctx, state.fireballs, state.elapsed);
  drawCoinInCell(ctx, state.coin, state.elapsed);
  drawFireballs(ctx, state.fireballs, state.elapsed);
  drawPlayer(ctx, state, state.gameStatus === "gameOver");
  drawHud(ctx, state);

  if (state.gameStatus === "paused") {
    drawPauseOverlay(ctx);
  }

  if (state.gameStatus === "gameOver") {
    drawGameOver(ctx, state);
  }
}

export function canvasPointToCell(x: number, y: number): Cell | null {
  const localX = x - GRID_LEFT;
  const localY = y - GRID_TOP;

  if (localX < 0 || localY < 0 || localX > GRID_PIXEL_SIZE || localY > GRID_PIXEL_SIZE) {
    return null;
  }

  const col = Math.floor(localX / GRID_STRIDE);
  const row = Math.floor(localY / GRID_STRIDE);

  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
    return null;
  }

  return { row, col };
}

function drawBackground(ctx: CanvasRenderingContext2D, elapsed: number): void {
  ctx.fillStyle = "rgba(21, 33, 44, 1)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawSnow(ctx, elapsed);
}

function drawSnow(ctx: CanvasRenderingContext2D, elapsed: number): void {
  for (const [baseX, baseY, size, alpha, speed] of SNOW_PIXELS) {
    const drift = Math.round(Math.sin(elapsed * 0.8 + baseX * 0.09) * 2);
    const x = Math.round((baseX + drift + CANVAS_WIDTH) % CANVAS_WIDTH);
    const y = Math.round((baseY + elapsed * speed) % CANVAS_HEIGHT);
    const pixelSize = size * 2;

    ctx.fillStyle = `rgba(245, 250, 252, ${alpha})`;
    ctx.fillRect(x, y, pixelSize, pixelSize);
  }
}

function drawPauseOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(180, 190, 195, 0.22)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const didDrawCoin = drawAnimatedCoin(ctx, 151, 76, COIN_HUD_HEIGHT, state.elapsed);

  if (!didDrawCoin) {
    drawMiniCoin(ctx, 136, 61, 3, state.elapsed);
  }

  drawPixelText(ctx, String(state.score), 178, 76, 34, "#fff7d7", "left");

  drawPixelText(ctx, `BEST ${state.bestScore}`, 28, 126, 15, "#d8e5ec", "left", "#122132");
  drawPixelText(ctx, `WR ${state.worldRecord}`, 392, 126, 15, "#d8e5ec", "right", "#122132");
}

function drawBoard(ctx: CanvasRenderingContext2D, elapsed: number): void {
  if (iceMapImage && isIceMapReady) {
    ctx.drawImage(
      iceMapImage,
      ICE_MAP_CROP_X,
      ICE_MAP_CROP_Y,
      ICE_MAP_CROP_WIDTH,
      ICE_MAP_CROP_HEIGHT,
      ICE_MAP_DEST_X,
      ICE_MAP_DEST_Y,
      Math.round(ICE_MAP_CROP_WIDTH * ICE_MAP_SCALE),
      Math.round(ICE_MAP_CROP_HEIGHT * ICE_MAP_SCALE),
    );
    return;
  }

  drawProceduralBoard(ctx, elapsed);
}

function drawProceduralBoard(ctx: CanvasRenderingContext2D, elapsed: number): void {
  ctx.fillStyle = "#071019";
  ctx.fillRect(GRID_LEFT - 10, GRID_TOP - 10, GRID_PIXEL_SIZE + 20, GRID_PIXEL_SIZE + 20);

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const x = GRID_LEFT + col * GRID_STRIDE;
      const y = GRID_TOP + row * GRID_STRIDE;
      const isGold = (row + col) % 2 === 0 || (row === 1 && col === 1) || (row === 3 && col === 4);
      drawTile(ctx, x, y, row, col, isGold, elapsed);
    }
  }
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  row: number,
  col: number,
  isGold: boolean,
  elapsed: number,
): void {
  const top = isGold ? "#ffd84a" : "#b98c54";
  const mid = isGold ? "#efaa31" : "#8d6840";
  const hi = isGold ? "#ffe878" : "#d0aa73";
  const shadow = isGold ? "#b86a23" : "#65442b";

  ctx.fillStyle = "#071019";
  ctx.fillRect(x + 4, y + 5, CELL_SIZE, CELL_SIZE);

  ctx.fillStyle = mid;
  ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
  ctx.fillStyle = top;
  ctx.fillRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8);
  ctx.fillStyle = hi;
  ctx.fillRect(x + 8, y + 8, 24, 6);
  ctx.fillRect(x + 9, y + 14, 10, 4);
  ctx.fillStyle = shadow;
  ctx.fillRect(x + CELL_SIZE - 7, y + 8, 3, 22);
  ctx.fillRect(x + 8, y + CELL_SIZE - 7, 34, 3);

  ctx.fillStyle = isGold ? "#f9c84a" : "#9e7546";
  const chipA = ((row * 17 + col * 29) % 34) + 10;
  const chipB = ((row * 23 + col * 11) % 30) + 18;
  ctx.fillRect(x + chipA, y + 13, 3, 11);
  ctx.fillRect(x + chipB, y + 38, 18, 3);

  if ((row + col) % 3 === 0) {
    const sparkle = Math.sin(elapsed * 6 + row + col) > 0.4;
    ctx.fillStyle = sparkle ? "#fff4ab" : "#d48c2d";
    ctx.fillRect(x + 13, y + 46, 5, 5);
  }
}

function drawWarnings(ctx: CanvasRenderingContext2D, fireballs: Fireball[], elapsed: number): void {
  for (const fireball of fireballs) {
    if (fireball.age <= fireball.warningDuration) {
      drawWarning(ctx, fireball.edge, fireball.lane, elapsed + fireball.id * 0.017);
    }
  }
}

function drawWarning(ctx: CanvasRenderingContext2D, edge: Edge, lane: number, phase: number): void {
  const center = cellCenter({ row: lane, col: lane });
  let x = center.x;
  let y = center.y;

  if (edge === "left") {
    x = GRID_LEFT - 31;
    y = GRID_TOP + lane * GRID_STRIDE + CELL_SIZE / 2;
  } else if (edge === "right") {
    x = GRID_LEFT + GRID_PIXEL_SIZE + 31;
    y = GRID_TOP + lane * GRID_STRIDE + CELL_SIZE / 2;
  } else if (edge === "up") {
    x = GRID_LEFT + lane * GRID_STRIDE + CELL_SIZE / 2;
    y = GRID_TOP - 31;
  } else {
    x = GRID_LEFT + lane * GRID_STRIDE + CELL_SIZE / 2;
    y = GRID_TOP + GRID_PIXEL_SIZE + 31;
  }

  const frame = warningSprites[Math.floor(phase / WARNING_FRAME_SECONDS) % warningSprites.length];

  if (!frame.ready || !frame.image || frame.image.naturalWidth === 0) {
    ctx.fillStyle = "#ffde59";
    ctx.fillRect(Math.round(x - 5), Math.round(y - 18), 10, 25);
    ctx.fillRect(Math.round(x - 5), Math.round(y + 13), 10, 10);
    ctx.fillStyle = "#172231";
    ctx.fillRect(Math.round(x + 5), Math.round(y - 15), 4, 23);
    ctx.fillRect(Math.round(x + 5), Math.round(y + 16), 4, 8);
    return;
  }

  const width = Math.round((frame.image.naturalWidth / frame.image.naturalHeight) * WARNING_HEIGHT);
  ctx.drawImage(frame.image, Math.round(x - width / 2), Math.round(y - WARNING_HEIGHT / 2), width, WARNING_HEIGHT);
}

function drawCoinInCell(ctx: CanvasRenderingContext2D, cell: Cell, elapsed: number): void {
  const center = cellCenter(cell);

  drawShadow(ctx, center.x, center.y + 17, COIN_SHADOW_WIDTH);
  const didDrawCoin = drawAnimatedCoin(ctx, center.x, center.y - 2, COIN_CELL_HEIGHT, elapsed);

  if (!didDrawCoin) {
    drawMiniCoin(ctx, center.x - 14, center.y - 18, 4, elapsed);
  }
}

function drawFireballs(ctx: CanvasRenderingContext2D, fireballs: Fireball[], elapsed: number): void {
  for (const fireball of fireballs) {
    if (fireball.age < fireball.warningDuration) {
      continue;
    }

    const position = getFireballPosition(fireball);
    const x = GRID_LEFT + position.col * GRID_STRIDE + CELL_SIZE / 2;
    const y = GRID_TOP + position.row * GRID_STRIDE + CELL_SIZE / 2;

    if (fireball.kind === "bending") {
      const scale = BENDING_FIREBALL_SCALE;
      const rotation = Math.atan2(fireball.velocityRow, fireball.velocityCol);
      if (!drawBendingFireballSprite(ctx, x, y, elapsed + fireball.id * 0.013, scale, rotation)) {
        drawFireball(ctx, x, y, elapsed + fireball.id, scale, rotation);
      }
    } else {
      const scale = 1;
      const rotation = getFireballRotation(fireball);
      if (!drawFireballSprite(ctx, fireball.edge, x, y, elapsed + fireball.id * 0.013, scale, rotation)) {
        drawFireball(ctx, x, y, elapsed + fireball.id, scale, rotation);
      }
    }
  }
}

function drawFireballSprite(
  ctx: CanvasRenderingContext2D,
  edge: Edge,
  centerX: number,
  centerY: number,
  elapsed: number,
  scale: number,
  rotation: number,
): boolean {
  const { frames, height } = fireballSpriteConfigs[edge];
  const frame = frames[Math.floor(elapsed / FIREBALL_FRAME_SECONDS) % frames.length];

  if (!frame.ready || !frame.image || frame.image.naturalWidth === 0) {
    return false;
  }

  const scaledHeight = Math.round(height * scale);
  const width = Math.round((frame.image.naturalWidth / frame.image.naturalHeight) * scaledHeight);
  ctx.save();
  ctx.translate(Math.round(centerX), Math.round(centerY));
  ctx.rotate(rotation);
  ctx.drawImage(
    frame.image,
    Math.round(-width / 2),
    Math.round(-scaledHeight / 2),
    width,
    scaledHeight,
  );
  ctx.restore();

  return true;
}

function drawBendingFireballSprite(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  elapsed: number,
  scale: number,
  rotation: number,
): boolean {
  const frame = bendingFireballSprites[Math.floor(elapsed / FIREBALL_FRAME_SECONDS) % bendingFireballSprites.length];

  if (!frame.ready || !frame.image || frame.image.naturalWidth === 0) {
    return false;
  }

  const height = FIREBALL_SIDE_HEIGHT;
  const scaledHeight = Math.round(height * scale);
  const width = Math.round((frame.image.naturalWidth / frame.image.naturalHeight) * scaledHeight);
  ctx.save();
  ctx.translate(Math.round(centerX), Math.round(centerY));
  ctx.rotate(rotation);
  ctx.drawImage(
    frame.image,
    Math.round(-width / 2),
    Math.round(-scaledHeight / 2),
    width,
    scaledHeight,
  );
  ctx.restore();

  return true;
}

function drawFireball(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number, scale: number, rotation: number): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(rotation);
  drawProceduralFireball(ctx, 0, 0, phase, scale);
  ctx.restore();
}

function drawProceduralFireball(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number, scale: number): void {
  const s = Math.round(4 * scale);
  const flicker = Math.sin(phase * 13) > 0 ? s : 0;

  ctx.fillStyle = "rgba(255, 66, 28, 0.22)";
  ctx.fillRect(Math.round(x - 24 * scale), Math.round(y - 24 * scale), Math.round(48 * scale), Math.round(48 * scale));
  ctx.fillStyle = "#7a201c";
  ctx.fillRect(Math.round(x - 20 * scale - flicker), Math.round(y - 12 * scale), Math.round(18 * scale), Math.round(24 * scale));
  ctx.fillStyle = "#ef4b23";
  ctx.fillRect(Math.round(x - 14 * scale), Math.round(y - 18 * scale), Math.round(30 * scale), Math.round(36 * scale));
  ctx.fillStyle = "#ff9d2b";
  ctx.fillRect(Math.round(x - 8 * scale), Math.round(y - 12 * scale), Math.round(26 * scale), Math.round(26 * scale));
  ctx.fillStyle = "#ffe66d";
  ctx.fillRect(Math.round(x - 1 * scale), Math.round(y - 7 * scale), Math.round(15 * scale), Math.round(16 * scale));
  ctx.fillStyle = "#351924";
  ctx.fillRect(Math.round(x + 14 * scale), Math.round(y - 12 * scale), s, Math.round(24 * scale));
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState, isGameOver: boolean): void {
  const loopName: PlayerLoopName = state.playerFacing === "left" ? "left" : "default";
  const frames = playerSprites[loopName];
  const frame = frames[Math.floor(state.elapsed / PLAYER_FRAME_SECONDS) % frames.length];

  if (!frame.ready || !frame.image || frame.image.naturalWidth === 0) {
    drawProceduralPlayer(ctx, state.player, isGameOver);
    return;
  }

  const center = cellCenter(state.player);
  const bob = isGameOver ? 7 : 0;
  const width = Math.round(frame.image.naturalWidth * PLAYER_SPRITE_SCALE);
  const height = Math.round(frame.image.naturalHeight * PLAYER_SPRITE_SCALE);
  const footY = center.y + 27 + PLAYER_VERTICAL_OFFSET + bob;
  const x = Math.round(center.x - width / 2);
  const y = Math.round(footY - height);

  drawPlayerShadow(ctx, center.x, center.y + 24 + PLAYER_VERTICAL_OFFSET + bob);
  ctx.drawImage(frame.image, x, y, width, height);
}

function drawProceduralPlayer(ctx: CanvasRenderingContext2D, cell: Cell, isGameOver: boolean): void {
  const center = cellCenter(cell);
  const bob = isGameOver ? 7 : 0;
  const x = center.x;
  const y = center.y + PLAYER_VERTICAL_OFFSET + bob;

  drawPlayerShadow(ctx, x, y + 24);

  ctx.fillStyle = "#172231";
  ctx.fillRect(x - 25, y - 7, 50, 28);
  ctx.fillStyle = "#c85a2a";
  ctx.fillRect(x - 21, y - 14, 42, 32);
  ctx.fillStyle = "#f1a23a";
  ctx.fillRect(x - 16, y - 22, 32, 14);
  ctx.fillStyle = "#ffd86a";
  ctx.fillRect(x - 10, y - 27, 20, 8);
  ctx.fillStyle = "#30223a";
  ctx.fillRect(x - 11, y - 2, 7, 13);
  ctx.fillRect(x + 4, y - 2, 7, 13);
  ctx.fillStyle = isGameOver ? "#ffffff" : "#b9ff66";
  ctx.fillRect(x - 9, y - 6, 6, 5);
  ctx.fillRect(x + 3, y - 6, 6, 5);
  ctx.fillStyle = "#f8c14b";
  ctx.fillRect(x - 31, y - 10, 8, 25);
  ctx.fillRect(x + 23, y - 10, 8, 25);
  ctx.fillStyle = "#172231";
  ctx.fillRect(x - 19, y + 18, 10, 9);
  ctx.fillRect(x + 9, y + 18, 10, 9);
}

function drawPlayerShadow(ctx: CanvasRenderingContext2D, centerX: number, centerY: number): void {
  drawShadow(ctx, centerX, centerY, PLAYER_SHADOW_WIDTH);
}

function drawShadow(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, width: number): void {
  if (!playerShadow.ready || !playerShadow.image || playerShadow.image.naturalWidth === 0) {
    ctx.fillStyle = "rgba(16, 21, 29, 0.42)";
    ctx.fillRect(Math.round(centerX - width / 2), Math.round(centerY - width * 0.1), Math.round(width), Math.max(4, Math.round(width * 0.2)));
    return;
  }

  const height = Math.round((playerShadow.image.naturalHeight / playerShadow.image.naturalWidth) * width);

  ctx.save();
  ctx.globalAlpha = PLAYER_SHADOW_ALPHA;
  ctx.drawImage(
    playerShadow.image,
    Math.round(centerX - width / 2),
    Math.round(centerY - height / 2),
    width,
    height,
  );
  ctx.restore();
}

function drawGameOver(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "rgba(8, 14, 21, 0.62)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (!drawGameOverBanner(ctx)) {
    drawBanner(ctx, 35, 84, 350, 58);
    drawPixelText(ctx, "GAME OVER!", CANVAS_WIDTH / 2, 124, 38, "#cc2f61", "center", "#071019");
  }

  const didDrawScoreBanner = drawScoreBanner(ctx);

  if (didDrawScoreBanner) {
    drawScoreValue(ctx, state.score, SCORE_VALUE_X, 292);
    drawScoreValue(ctx, state.bestScore, SCORE_VALUE_X, 335);
    drawScoreValue(ctx, state.worldRecord, SCORE_VALUE_X, 378);
    return;
  }

  drawParchment(ctx, 52, 240, 316, 214);
  drawScoreRow(ctx, "Score", state.score, 96, 306);
  drawScoreRow(ctx, "Best", state.bestScore, 96, 358);
  drawScoreRow(ctx, "Record", state.worldRecord, 96, 410);
}

function drawBanner(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  ctx.fillStyle = "#071019";
  ctx.fillRect(x + 8, y + 10, width, height);
  ctx.fillStyle = "#172231";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#273649";
  ctx.fillRect(x + 10, y + 6, width - 20, 10);
}

function drawGameOverBanner(ctx: CanvasRenderingContext2D): boolean {
  if (!gameOverBanner.ready || !gameOverBanner.image || gameOverBanner.image.naturalWidth === 0) {
    return false;
  }

  ctx.drawImage(
    gameOverBanner.image,
    GAME_OVER_BANNER_X,
    GAME_OVER_BANNER_Y,
    GAME_OVER_BANNER_WIDTH,
    GAME_OVER_BANNER_HEIGHT,
  );
  return true;
}

function drawParchment(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  ctx.fillStyle = "#5a321d";
  ctx.fillRect(x - 9, y + 14, width + 18, height - 28);
  ctx.fillStyle = "#9f7b54";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#b08e62";
  ctx.fillRect(x + 18, y + 18, width - 36, height - 36);
  ctx.fillStyle = "#704020";
  ctx.fillRect(x + 10, y + 12, 20, height - 24);
  ctx.fillRect(x + width - 30, y + 12, 20, height - 24);
  ctx.fillStyle = "#87643e";
  ctx.fillRect(x + 22, y + 26, 12, 48);
  ctx.fillRect(x + width - 34, y + height - 74, 12, 48);
}

function drawScoreBanner(ctx: CanvasRenderingContext2D): boolean {
  if (!scoreBanner.ready || !scoreBanner.image || scoreBanner.image.naturalWidth === 0) {
    return false;
  }

  ctx.drawImage(scoreBanner.image, SCORE_BANNER_X, SCORE_BANNER_Y, SCORE_BANNER_WIDTH, SCORE_BANNER_HEIGHT);
  return true;
}

function drawScoreRow(ctx: CanvasRenderingContext2D, label: string, value: number, x: number, y: number): void {
  drawPixelText(ctx, label, x, y, 29, "#ffffff", "left", "#172231");
  drawScoreValue(ctx, value, x + 230, y);
}

function drawScoreValue(ctx: CanvasRenderingContext2D, value: number, x: number, y: number): void {
  drawPixelText(ctx, String(value), x, y, 31, "#ffffff", "right", "#172231");
}

function drawAnimatedCoin(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  targetHeight: number,
  elapsed: number,
): boolean {
  const frame = coinSprites[Math.floor(elapsed / COIN_FRAME_SECONDS) % coinSprites.length];

  if (!frame.ready || !frame.image || frame.image.naturalWidth === 0) {
    return false;
  }

  const width = Math.round((frame.image.naturalWidth / frame.image.naturalHeight) * targetHeight);
  const height = Math.round(targetHeight);
  const x = Math.round(centerX - width / 2);
  const y = Math.round(centerY - height / 2);

  ctx.drawImage(
    frame.image,
    x,
    y,
    width,
    height,
  );

  return true;
}

function drawMiniCoin(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, elapsed: number): void {
  const shine = Math.sin(elapsed * 9) > 0;
  const s = scale;

  ctx.fillStyle = "#96551e";
  ctx.fillRect(x + 2 * s, y + 2 * s, 10 * s, 10 * s);
  ctx.fillStyle = "#ffb331";
  ctx.fillRect(x, y, 10 * s, 10 * s);
  ctx.fillStyle = "#ffe879";
  ctx.fillRect(x + 2 * s, y + 2 * s, 6 * s, 6 * s);
  ctx.fillStyle = "#fff8d8";
  ctx.fillRect(x + 3 * s, y + 3 * s, 3 * s, 3 * s);
  ctx.fillStyle = "#d87a24";
  ctx.fillRect(x + 8 * s, y + 2 * s, 2 * s, 8 * s);
  ctx.fillRect(x + 2 * s, y + 8 * s, 8 * s, 2 * s);

  if (shine) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - s, y + 2 * s, s, 3 * s);
  }
}

function cellCenter(cell: Cell): { x: number; y: number } {
  return {
    x: GRID_LEFT + cell.col * GRID_STRIDE + CELL_SIZE / 2,
    y: GRID_TOP + cell.row * GRID_STRIDE + CELL_SIZE / 2,
  };
}

function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign,
  shadow = "#071019",
): void {
  ctx.font = `900 ${size}px "Courier New", Courier, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = shadow;
  ctx.fillText(text, x + 4, y + 4);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
