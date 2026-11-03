import Phaser from 'phaser';
import {
  ARROW,
  BOARD_CY,
  BOARD_H,
  CENTER_X,
  COLS,
  DEPTH,
  EXIT_ARROW,
  FONT_SIZE,
  GAME_W,
  LANE_ARROWS,
  ROWS,
  TEXT_COLOR,
  WORLD_Y,
  type ArrowMarker,
} from '../constants';
import {
  ensureTreeTextures,
  makeBoardStoneTexture,
  makeBoardTileTexture,
  TREE_SHADOW_KEY,
} from '../gfx/surfaces';
import { cellCenter, isAdjacentToPath, isPath } from '../logic/board';
import { textStyle } from './common';

/** Plansza: jedna kamienna tekstura albo — bez CanvasTexture — kafelki komórka po komórce. */
export function drawMap(scene: Phaser.Scene, alpha: number, depthBase = 0) {
  const board = makeBoardStoneTexture(scene);
  if (board) {
    scene.add.image(CENTER_X, BOARD_CY, board).setDepth(depthBase + DEPTH.GRID).setAlpha(alpha);
    return;
  }
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const c = cellCenter(col, row);
      const road = isPath(col, row);
      scene.add
        .image(c.x, c.y, makeBoardTileTexture(scene, col, row))
        .setDepth(depthBase + (road ? DEPTH.PATH : DEPTH.GRID))
        .setAlpha(alpha);
    }
  }
}

/** Para strzałek (większa i mniejsza za nią), opcjonalnie pulsująca. */
function drawArrowPair(
  scene: Phaser.Scene,
  marker: ArrowMarker,
  texture: string,
  alpha: number,
  pulse: boolean,
  depthBase: number,
) {
  for (let i = 0; i < 2; i++) {
    const scale = ARROW.scale[i];
    const img = scene.add
      .image(marker.x + marker.dx * i * ARROW.spacing, marker.y + marker.dy * i * ARROW.spacing, texture)
      .setRotation(marker.angle)
      .setDepth(depthBase + DEPTH.TREES + 1)
      .setAlpha(alpha * ARROW.alpha[i])
      .setScale(scale);
    if (!pulse) continue;
    scene.tweens.add({
      targets: img,
      alpha: { from: alpha * ARROW.pulseAlphaFrom[i], to: alpha * ARROW.pulseAlphaTo[i] },
      scale: { from: scale * ARROW.pulseScaleFrom, to: scale * ARROW.pulseScaleTo },
      duration: ARROW.pulseMs + i * ARROW.pulseStepMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

/** Białe strzałki przy wjazdach trzech dróg. */
export function drawLaneArrows(scene: Phaser.Scene, alpha: number, pulse: boolean, depthBase = 0) {
  for (const entry of LANE_ARROWS) drawArrowPair(scene, entry, 'lane-arrow', alpha, pulse, depthBase);
}

/** Czerwone strzałki wyjścia do bazy z literą bazy pod nimi. */
export function drawExitArrows(scene: Phaser.Scene, alpha: number, pulse: boolean, depthBase = 0) {
  scene.add
    .text(
      EXIT_ARROW.x + ARROW.exitLetterDx,
      EXIT_ARROW.y,
      ARROW.exitLetter,
      textStyle(FONT_SIZE.exitLetter, TEXT_COLOR.exitLetter, true),
    )
    .setOrigin(0.5)
    .setDepth(depthBase + DEPTH.TREES + 0.5)
    .setAlpha(alpha * ARROW.exitLetterAlpha);
  drawArrowPair(scene, EXIT_ARROW, 'lane-arrow-exit', alpha, pulse, depthBase);
}

/* ----------------------------------- las na planszy ----------------------------------- */
/** Stabilny hash komórki — ten sam las przy każdym uruchomieniu i restarcie sceny. */
function treeHash(x: number, y: number, salt: number): number {
  let h = Math.imul(x + 0x1f3a, 374761393) ^ Math.imul(y + 0x91bb, 668265263) ^ Math.imul(salt, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Miękki szum w siatce kilku kafelków — skupiska lasu zamiast równomiernego rozsypania. */
function treeGroveNoise(col: number, row: number): number {
  const size = 4.5;
  const x = col / size;
  const y = row / size;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const sx = smooth(tx);
  const sy = smooth(ty);
  const corner = (gx: number, gy: number) => treeHash(gx, gy, 0x51fa);
  const top = corner(x0, y0) * (1 - sx) + corner(x0 + 1, y0) * sx;
  const bottom = corner(x0, y0 + 1) * (1 - sx) + corner(x0 + 1, y0 + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

/** Środki kafelków pobocza — korona może na nie wejść tylko brzegiem. */
const SHOULDER_CENTERS: { x: number; y: number }[] = (() => {
  const centers: { x: number; y: number }[] = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      if (!isPath(col, row) && isAdjacentToPath(col, row)) centers.push(cellCenter(col, row));
    }
  }
  return centers;
})();

/** Liście sięgają tego ułamka wyświetlanego rozmiaru korony. */
const CROWN_RATIO = 0.44;
/** Tyle pikseli wokół środka kafelka pobocza musi zostać odkryte. */
const SHOULDER_CLEAR = 8;

function crownClearsShoulder(x: number, y: number, radius: number): boolean {
  const limit = radius + SHOULDER_CLEAR;
  const limitSq = limit * limit;
  for (const cell of SHOULDER_CENTERS) {
    const dx = x - cell.x;
    const dy = y - cell.y;
    if (dx * dx + dy * dy < limitSq) return false;
  }
  return true;
}

/**
 * Roślinność wyłącznie na trawie, która nie styka się z jezdnią (także po skosie).
 * Warstwa ma głębokość DEPTH.TREES — wyżej niż wieże gracza i wrogowie, niżej niż pociski,
 * efekty i paski zdrowia. Drzewa są czysto dekoracyjne i nie przechwytują kliknięć.
 * Korona jest duża, ale przy poboczu cofa się tak, by nie zasłonić całego kafelka.
 */
export function drawTrees(scene: Phaser.Scene, alpha = 1, depthBase = 0) {
  const sprites = ensureTreeTextures(scene);
  if (!sprites.length) return;
  const bushSprites = sprites.filter(
    (s) => s.key.startsWith('tree-bush') || s.key.startsWith('tree-shrub'),
  );
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      if (isPath(col, row) || isAdjacentToPath(col, row)) continue;
      const grove = treeGroveNoise(col, row) * 0.64 + treeHash(col, row, 0x7c1b) * 0.36;
      const inGrove = grove >= 0.48 && treeHash(col, row, 0x9d42) >= 0.08;
      const lone = treeHash(col, row, 0x2fa1) > 0.86;
      if (!inGrove && !lone) continue;

      // Częściej krzaki (wypełniają luki) niż duże rozety.
      const roll = treeHash(col, row, 0x3b7e);
      const index = Math.floor(treeHash(col, row, 0x4b21) * 1000);
      const sprite =
        roll < 0.5 && bushSprites.length
          ? bushSprites[index % bushSprites.length]
          : sprites[index % sprites.length];
      const center = cellCenter(col, row);
      let x = center.x + (treeHash(col, row, 0xc4d2) - 0.5) * 9;
      let y = center.y + (treeHash(col, row, 0xe61a) - 0.5) * 8;
      let size = sprite.display * (0.96 + treeHash(col, row, 0x8af1) * 0.18);

      // Duża korona przy drodze odsuwa się w głąb lasu, zamiast połykać pobocze.
      let nearest = SHOULDER_CENTERS[0];
      let nearestDist = Infinity;
      for (const cell of SHOULDER_CENTERS) {
        const dist = Math.hypot(x - cell.x, y - cell.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = cell;
        }
      }
      const wantedRadius = size * CROWN_RATIO;
      if (nearest && nearestDist < wantedRadius + SHOULDER_CLEAR) {
        const dx = x - nearest.x;
        const dy = y - nearest.y;
        const dist = nearestDist || 1;
        const push = Math.min(28, wantedRadius + SHOULDER_CLEAR - dist);
        x += (dx / dist) * push;
        y += (dy / dist) * push;
        x = Math.max(10, Math.min(GAME_W - 10, x));
        y = Math.max(WORLD_Y + 10, Math.min(WORLD_Y + BOARD_H - 10, y));
      }
      if (!crownClearsShoulder(x, y, size * CROWN_RATIO)) {
        let maxRadius = size * CROWN_RATIO;
        for (const cell of SHOULDER_CENTERS) {
          maxRadius = Math.min(maxRadius, Math.hypot(x - cell.x, y - cell.y) - SHOULDER_CLEAR);
        }
        if (maxRadius < 18) continue;
        size = maxRadius / CROWN_RATIO;
      }

      // Miękki cień pod koroną — leży nisko (nad planszą, pod wieżami), więc
      // przyciemnia kafelek w kolorze pobocza, ale nie zasłania broni. Celowo bez
      // obrotu: światło pada zawsze z tej samej strony.
      scene.add
        .image(x + size * 0.07, y + size * 0.09, TREE_SHADOW_KEY)
        .setDisplaySize(size * 1.02, size * 0.84)
        .setAlpha(alpha)
        .setDepth(depthBase + 0.5);

      const image = scene.add
        .image(x, y, sprite.key)
        .setDisplaySize(size, size)
        .setAlpha(alpha)
        .setDepth(depthBase + DEPTH.TREES + row * 0.01);
      image.setRotation(treeHash(col, row, 0xd0f7) * Math.PI * 2);
    }
  }
}
