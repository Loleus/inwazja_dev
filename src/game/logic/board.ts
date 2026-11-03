import {
  ARROW,
  BOARD_H,
  BOARD_SKETCH,
  CELL,
  COLS,
  ENEMY_MOTION,
  GAME_W,
  LANE_ARROWS,
  LANE_ROUTES,
  PATH_CELL,
  PLAY_BOTTOM,
  ROWS,
  WORLD_Y,
} from '../constants';
import type { LanePath, Point } from '../types';

const BOARD_ROAD: boolean[][] = BOARD_SKETCH.map((row) => row.split('').map((ch) => ch !== '0'));

/** Czy gęsta komórka (25 px) jest jezdnią — decyduje jej blok 2×2. */
export function isPath(col: number, row: number): boolean {
  const block = BOARD_ROAD[Math.floor(row / 2)];
  return Boolean(block && block[Math.floor(col / 2)]);
}

/** Wieżę wolno stawiać tylko na trawie sąsiadującej z drogą (także po skosie). */
export function isAdjacentToPath(col: number, row: number): boolean {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if ((dx !== 0 || dy !== 0) && isPath(col + dx, row + dy)) return true;
    }
  }
  return false;
}

export function isInsideGrid(col: number, row: number): boolean {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

/** Środek gęstej komórki we współrzędnych ekranu. */
export function cellCenter(col: number, row: number): Point {
  return { x: col * CELL + CELL / 2, y: WORLD_Y + row * CELL + CELL / 2 };
}

export function pointerCell(x: number, y: number): { col: number; row: number } {
  return { col: Math.floor(x / CELL), row: Math.floor((y - WORLD_Y) / CELL) };
}

export function pointerOnBoard(x: number, y: number): boolean {
  return y >= WORLD_Y && y < PLAY_BOTTOM && x >= 0 && x <= GAME_W;
}

export function onBoard(x: number, y: number): boolean {
  return x >= 0 && x <= GAME_W && y >= WORLD_Y && y <= WORLD_Y + BOARD_H;
}

/* ----------------------------------- trasy wrogów ----------------------------------- */
function buildPath(id: string, coords: [number, number][]): LanePath {
  const rawPoints = coords.map(([c, r]) => ({
    x: c * PATH_CELL + PATH_CELL / 2,
    y: WORLD_Y + r * PATH_CELL + PATH_CELL / 2,
  }));
  const routePoints: Point[] = [rawPoints[0]];
  for (let i = 1; i < rawPoints.length - 1; i++) {
    const previous = rawPoints[i - 1];
    const current = rawPoints[i];
    const next = rawPoints[i + 1];
    const incomingX = current.x - previous.x;
    const incomingY = current.y - previous.y;
    const outgoingX = next.x - current.x;
    const outgoingY = next.y - current.y;
    const cross = incomingX * outgoingY - incomingY * outgoingX;
    const dot = incomingX * outgoingX + incomingY * outgoingY;
    if (Math.abs(cross) > 1e-6 || dot < 0) routePoints.push(current);
  }
  routePoints.push(rawPoints[rawPoints.length - 1]);

  const corners: Point[] = [routePoints[0]];
  for (let i = 1; i < routePoints.length - 1; i++) {
    const previous = routePoints[i - 1];
    const current = routePoints[i];
    const next = routePoints[i + 1];
    const incomingX = current.x - previous.x;
    const incomingY = current.y - previous.y;
    const outgoingX = next.x - current.x;
    const outgoingY = next.y - current.y;
    const incomingLength = Math.hypot(incomingX, incomingY);
    const outgoingLength = Math.hypot(outgoingX, outgoingY);
    const cross = incomingX * outgoingY - incomingY * outgoingX;
    const dot = incomingX * outgoingX + incomingY * outgoingY;

    if (Math.abs(cross) < 1e-6 || Math.abs(dot) > 1e-6) continue;

    const incoming = { x: incomingX / incomingLength, y: incomingY / incomingLength };
    const outgoing = { x: outgoingX / outgoingLength, y: outgoingY / outgoingLength };
    const radius = Math.min(ENEMY_MOTION.cornerRadius, incomingLength / 2, outgoingLength / 2);
    const start = { x: current.x - incoming.x * radius, y: current.y - incoming.y * radius };
    const end = { x: current.x + outgoing.x * radius, y: current.y + outgoing.y * radius };
    const center = {
      x: start.x + outgoing.x * radius,
      y: start.y + outgoing.y * radius,
    };
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const sweep = Math.sign(cross) * (Math.PI / 2);
    // On the quarter-circle, forward and lateral velocity components vary sinusoidally.
    corners.push(start);
    for (let step = 1; step <= ENEMY_MOTION.cornerSteps; step++) {
      const angle = startAngle + (sweep * step) / ENEMY_MOTION.cornerSteps;
      corners.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      });
    }
    corners[corners.length - 1] = end;
  }
  corners.push(routePoints[routePoints.length - 1]);

  const points: Point[] = [corners[0]];
  let length = 0;
  for (let i = 1; i < corners.length; i++) {
    const point = corners[i];
    const previous = points[points.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) < 1e-6) continue;
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    points.push(point);
  }
  return { id, points, length };
}

export const PATHS: LanePath[] = Object.entries(LANE_ROUTES).map(([id, coords]) => buildPath(id, coords));

/** Dystans do bazy; odcinek za krawędzią planszy nie jest przebyty, bo wróg trafia do bazy przy x > GAME_W. */
export function pathLengthToBase(path: LanePath): number {
  const end = path.points[path.points.length - 1];
  return path.length - Math.max(0, end.x - GAME_W);
}

export function getPathById(id: string): LanePath {
  return PATHS.find((p) => p.id === id) ?? PATHS[0];
}

/** Identyfikator drogi, jeśli punkt leży na jednej z dwóch strzałek jej wjazdu. */
export function laneEntryArrowAt(x: number, y: number): string | null {
  const radiusSq = ARROW.hoverRadius * ARROW.hoverRadius;
  for (const entry of LANE_ARROWS) {
    for (let i = 0; i < 2; i++) {
      const dx = x - (entry.x + entry.dx * i * ARROW.spacing);
      const dy = y - (entry.y + entry.dy * i * ARROW.spacing);
      if (dx * dx + dy * dy <= radiusSq) return entry.id;
    }
  }
  return null;
}

/* ----------------------------------- zakręty dróg ----------------------------------- */
const BEND_OPPOSITE: Record<string, string> = { ne: 'sw', sw: 'ne', nw: 'se', se: 'nw' };

function bendCorner(col: number, row: number): string | null {
  let mask = 0;
  if (isPath(col, row - 1)) mask |= 1;
  if (isPath(col + 1, row)) mask |= 2;
  if (isPath(col, row + 1)) mask |= 4;
  if (isPath(col - 1, row)) mask |= 8;
  if (mask === 3) return 'ne';
  if (mask === 6) return 'se';
  if (mask === 9) return 'nw';
  if (mask === 12) return 'sw';
  return null;
}

/** Klucz zaokrąglonego kafelka zakrętu albo null, gdy wystarczy zwykły kafelek. */
function cornerTextureKey(col: number, row: number): string | null {
  if (!isInsideGrid(col, row)) return null;
  if (col === 0 || col === COLS - 1 || row === 0 || row === ROWS - 1) return null;
  const bend = bendCorner(col, row);
  if (!bend) return null;
  const on = isPath(col, row);
  const corner = on ? BEND_OPPOSITE[bend] : bend;
  return (on ? 'tile-corner-' : 'tile-inner-') + corner + tileToneSuffix(col, row);
}

/** Szachownica dwóch tonów trawy i piasku. */
function tileToneSuffix(col: number, row: number): string {
  return (col + row) % 2 === 0 ? '' : '-b';
}

/** Klucz kafelka komórki: zakręt, jezdnia albo podłoże zielone łamane brązem (pobocze i pod drzewami). */
export function tileTextureKey(col: number, row: number): string {
  const corner = cornerTextureKey(col, row);
  if (corner) return corner;
  const alt = (col + row) % 2 === 0;
  if (isPath(col, row)) return alt ? 'tile-path' : 'tile-path2';
  return alt ? 'tile-shoulder' : 'tile-shoulder2';
}
