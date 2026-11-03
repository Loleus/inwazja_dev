// /* =========================================================================================
//    Faktury i cienie generowane na canvasie: kamienna plansza, kamień kart i pasków,
//    cień kart menu, tytuł w zimowym kamuflażu i miękki cień wokół ikon.
//    ========================================================================================= */
// import Phaser from 'phaser';
// import { BOARD_H, CARD, COLS, CELL, GAME_W, ROWS, TEXTURE, UI_RESOLUTION } from '../constants';
// import { tileTextureKey } from '../logic/board';

// /* =========================================================================================
//    TYTUŁ W ZIMOWYM KAMUFLAŻU (wojska górskie).
//    Litery są wypełnione biało-szarym wzorem moro: rysujemy plamy na canvasie, a potem
//    przycinamy je do kształtu napisu (`destination-in`). Powstaje zwykła tekstura, więc
//    w pętli gry nie ma żadnego dodatkowego kosztu ani pracy dla GC.
//    ========================================================================================= */

// /** Deterministyczny generator — wzór moro jest zawsze ten sam przy każdym uruchomieniu. */
// function camoRandom(seed: number): () => number {
//   let a = seed >>> 0;
//   return () => {
//     a = (a + 0x6d2b79f5) >>> 0;
//     let t = Math.imul(a ^ (a >>> 15), 1 | a);
//     t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
//     return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
//   };
// }

// /**
//  * Rozlana ciecz: „grzbiecik" zbudowany z nakładających się kropli o losowych promieniach
//  * i przesunięciach. Krawędzie są faliste i nierówne, jak płyn rozlany na powierzchni,
//  * a nie regularny wielokąt.
//  */
// function camoBlob(
//   ctx: CanvasRenderingContext2D,
//   rnd: () => number,
//   cx: number,
//   cy: number,
//   radius: number,
// ) {
//   // krople główne + od 2 do 4 satelitów „rozlanych" w losowych kierunkach
//   const drops = 3 + Math.floor(rnd() * 3);
//   for (let d = 0; d < drops; d++) {
//     const angle = d === 0 ? 0 : rnd() * Math.PI * 2;
//     // pierwsza kropla siedzi w środku, kolejne są coraz mniejsze i dalej
//     const drift = d === 0 ? 0 : radius * (0.45 + rnd() * 0.85);
//     const cx2 = cx + Math.cos(angle) * drift;
//     const cy2 = cy + Math.sin(angle) * drift * 0.62;
//     const r2 = d === 0 ? radius * (0.85 + rnd() * 0.4) : radius * (0.3 + rnd() * 0.5);

//     // obwód z falowaniem o dwóch częstotliwościach (duża fala + drobne nerwowości)
//     const points = 22;
//     const phase = rnd() * Math.PI * 2;
//     const wob = 0.24 + rnd() * 0.2;
//     ctx.beginPath();
//     for (let i = 0; i <= points; i++) {
//       const t = (i / points) * Math.PI * 2;
//       const wave =
//         1 +
//         wob * 0.5 * Math.sin(t * 3 + phase) +
//         wob * 0.28 * Math.sin(t * 5 - phase * 1.7) +
//         wob * 0.16 * Math.sin(t * 8 + phase * 2.3);
//       // rozciągnięcie poziome: ciecz rozlewa się szerzej niż w pionie
//       const rx = r2 * wave * 1.3;
//       const ry = r2 * wave * 0.78;
//       const px = cx2 + Math.cos(t) * rx;
//       const py = cy2 + Math.sin(t) * ry;
//       if (i === 0) ctx.moveTo(px, py);
//       else ctx.lineTo(px, py);
//     }
//     ctx.closePath();
//     ctx.fill();
//   }
// }


// interface PatternGrid {
//   width: number;
//   height: number;
//   values: Float32Array;
// }

// function makePatternGrid(width: number, height: number, rnd: () => number): PatternGrid {
//   const values = new Float32Array(width * height);
//   for (let i = 0; i < values.length; i++) values[i] = rnd() * 2 - 1;
//   return { width, height, values };
// }

// function samplePatternGrid(grid: PatternGrid, x: number, y: number, width: number, height: number): number {
//   const gx = (x / width) * grid.width;
//   const gy = (y / height) * grid.height;
//   const x0 = Math.floor(gx) % grid.width;
//   const y0 = Math.floor(gy) % grid.height;
//   const x1 = (x0 + 1) % grid.width;
//   const y1 = (y0 + 1) % grid.height;
//   const tx0 = gx - Math.floor(gx);
//   const ty0 = gy - Math.floor(gy);
//   const tx = tx0 * tx0 * (3 - 2 * tx0);
//   const ty = ty0 * ty0 * (3 - 2 * ty0);
//   const a = grid.values[y0 * grid.width + x0];
//   const b = grid.values[y0 * grid.width + x1];
//   const c = grid.values[y1 * grid.width + x0];
//   const d = grid.values[y1 * grid.width + x1];
//   const top = a + (b - a) * tx;
//   const bottom = c + (d - c) * tx;
//   return top + (bottom - top) * ty;
// }

// /**
//  * Jedna tekstura całej planszy: zachowuje geometrię i dwie tonacje trawy/piasku,
//  * ale kamienne ziarno liczy z GLOBALNYCH współrzędnych 800×600. Nie powtarza się
//  * co 25 px ani co szerokość kart/pasków. Powstaje raz i jest współdzielona przez sceny.
//  */
// export function makeBoardStoneTexture(scene: Phaser.Scene): string {
//   const key = 'board-stone-unique-v1';
//   if (scene.textures.exists(key)) return key;
//   const height = BOARD_H;
//   const texture = scene.textures.createCanvas(key, GAME_W, height);
//   if (!texture) return '';
//   const ctx = texture.getContext();

//   // Mapa składana z kafelków, włącznie z zaokrągleniami dróg.
//   for (let col = 0; col < COLS; col++) {
//     for (let row = 0; row < ROWS; row++) {
//       const tileKey = tileTextureKey(col, row);
//       ctx.drawImage(scene.textures.get(tileKey).getSourceImage() as CanvasImageSource, col * CELL, row * CELL);
//     }
//   }

//   const image = ctx.getImageData(0, 0, GAME_W, height);
//   const pixels = image.data;
//   const rnd = camoRandom(0x6f726f6a);
//   // Wszystkie oktawy rozpięte na CAŁEJ planszy; nie są kafelkowane między polami.
//   const coarse = makePatternGrid(37, 29, rnd);
//   const medium = makePatternGrid(129, 99, rnd);
//   const fine = makePatternGrid(379, 283, rnd);

//   for (let y = 0; y < height; y++) {
//     for (let x = 0; x < GAME_W; x++) {
//       const offset = (y * GAME_W + x) * 4;
//       const stone =
//         samplePatternGrid(coarse, x, y, GAME_W, height) * 0.36 +
//         samplePatternGrid(medium, x, y, GAME_W, height) * 0.32 +
//         samplePatternGrid(fine, x, y, GAME_W, height) * 0.24;
//       // Niezależny pył w każdym pikselu; również jego wzór nie ma okresu kafelka.
//       let hash = Math.imul(x + 16411, 374761393) ^ Math.imul(y + 24133, 668265263);
//       hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
//       const dust = ((hash >>> 0) / 4294967295 - 0.5) * 0.07;
//       const pathTone = pixels[offset] > pixels[offset + 1] * 1.08;
//       // Plansza ma mieć widoczne, ale subtelne ziarno — faktura nie może konkurować
//       // z drogami, wieżami i wrogami. Paski/menu zachowują osobną, mocniejszą fakturę.
//       const strength = pathTone ? 0.12 : 0.16;
//       const multiplier = Math.max(0.88, Math.min(1.12, 1 + (stone + dust) * strength));
//       pixels[offset] = Math.round(pixels[offset] * multiplier);
//       pixels[offset + 1] = Math.round(pixels[offset + 1] * multiplier);
//       pixels[offset + 2] = Math.round(pixels[offset + 2] * multiplier);
//     }
//   }
//   ctx.putImageData(image, 0, 0);
//   texture.refresh();
//   return key;
// }

// /**
//  * Tworzy ziarnisty kamienny wzór z obrazu jako achromatyczną modulację jasności.
//  * Bazowy kolor karty pozostaje bez zmian (oblicza go cardBackground); kolorem źródłowego
//  * zdjęcia w ogóle nie malujemy. Kilka zawijanych oktaw szumu daje drobne kruszywo,
//  * a odejmowanie średniej utrzymuje średnią jasność karty i jej obecną barwę.
//  * `textureDarkness` zwiększa tylko kontrast ciemnych drobinek na wskazanej teksturze;
//  * nie przyciemnia bazowego koloru powierzchni.
//  * `cornerRadius` przycina fakturę do kształtu okienka o zaokrąglonych narożnikach
//  * (0 = prostokąt — plansza, paski i inne powierzchnie bez zaokrągleń).
//  */
// export function makeMenuStoneTexture(
//   scene: Phaser.Scene,
//   baseColor: number,
//   logicalWidth: number,
//   logicalHeight: number,
//   grainStrength: number = TEXTURE.stoneGrain,
//   textureDarkness = 0,
//   cornerRadius = 0,
// ): string {
//   const dpr = UI_RESOLUTION;
//   const width = Math.max(1, Math.round(logicalWidth * dpr));
//   const height = Math.max(1, Math.round(logicalHeight * dpr));
//   const key = `menu-stone-${baseColor.toString(16).padStart(6, '0')}-${width}x${height}-g${Math.round(grainStrength * 100)}-d${Math.round(textureDarkness * 100)}-r${cornerRadius}`;
//   if (scene.textures.exists(key)) return key;

//   const canvas = document.createElement('canvas');
//   canvas.width = width;
//   canvas.height = height;
//   const ctx = canvas.getContext('2d');
//   if (!ctx) return '';

//   const seed = (baseColor ^ (width * 374761393) ^ (height * 668265263)) >>> 0;
//   const rnd = camoRandom(seed);
//   const grids = [
//     { grid: makePatternGrid(7, 6, rnd), weight: 0.42 },
//     { grid: makePatternGrid(19, 16, rnd), weight: 0.29 },
//     { grid: makePatternGrid(53, 46, rnd), weight: 0.19 },
//     { grid: makePatternGrid(Math.max(1, Math.floor(width / 3)), Math.max(1, Math.floor(height / 3)), rnd), weight: 0.1 },
//   ];

//   const noise = new Float32Array(width * height);
//   let mean = 0;
//   let pixel = 0;
//   for (let y = 0; y < height; y++) {
//     for (let x = 0; x < width; x++) {
//       let value = 0;
//       for (const layer of grids) value += samplePatternGrid(layer.grid, x, y, width, height) * layer.weight;
//       noise[pixel++] = value;
//       mean += value;
//     }
//   }
//   mean /= noise.length;

//   const image = ctx.createImageData(width, height);
//   const sourceR = (baseColor >>> 16) & 255;
//   const sourceG = (baseColor >>> 8) & 255;
//   const sourceB = baseColor & 255;
//   // Only deepen the negative/noise grains; keep the mean at 1 so the base color stays put.
//   let shapedMean = 0;
//   for (let i = 0; i < noise.length; i++) {
//     const delta = noise[i] - mean;
//     shapedMean += delta < 0 ? delta * (1 + textureDarkness) : delta;
//   }
//   shapedMean /= noise.length;

//   // Neutral luminance-only modulation preserves hue; darkening affects only the pattern.
//   for (let i = 0; i < noise.length; i++) {
//     const delta = noise[i] - mean;
//     const shaped = (delta < 0 ? delta * (1 + textureDarkness) : delta) - shapedMean;
//     const luminanceMix = Math.max(0.55, Math.min(1.32, 1 + shaped * grainStrength));
//     const offset = i * 4;
//     image.data[offset] = Math.min(255, Math.max(0, Math.round(sourceR * luminanceMix)));
//     image.data[offset + 1] = Math.min(255, Math.max(0, Math.round(sourceG * luminanceMix)));
//     image.data[offset + 2] = Math.min(255, Math.max(0, Math.round(sourceB * luminanceMix)));
//     image.data[offset + 3] = 255;
//   }
//   ctx.putImageData(image, 0, 0);

//   /* Zaokrąglone narożniki: faktura przycięta do kształtu okienka (`destination-in`),
//      tak samo jak kamuflaż przycinany do liter tytułu. */
//   if (cornerRadius > 0) {
//     ctx.globalCompositeOperation = 'destination-in';
//     ctx.beginPath();
//     ctx.roundRect(0, 0, width, height, cornerRadius * dpr);
//     ctx.fill();
//     ctx.globalCompositeOperation = 'source-over';
//   }

//   const texture = scene.textures.addCanvas(key, canvas);
//   texture?.refresh();
//   return key;
// }

// /** Reuses the exact menu-card grain at its original scale, cached for each surface size. */
// export function makeStoneSurfaceTexture(
//   scene: Phaser.Scene,
//   baseColor: number,
//   logicalWidth: number,
//   logicalHeight: number,
//   sourceWidth: number,
//   sourceHeight: number,
//   grainStrength: number = TEXTURE.stoneGrain,
//   cornerRadius = 0,
// ): string {
//   const sourceKey = makeMenuStoneTexture(scene, baseColor, sourceWidth, sourceHeight, grainStrength);
//   if (!sourceKey) return '';
//   if (logicalWidth === sourceWidth && logicalHeight === sourceHeight && cornerRadius === 0) return sourceKey;

//   // makeMenuStoneTexture always uses an HTMLCanvasElement as its source.
//   const source = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement;
//   const width = Math.max(1, Math.round(logicalWidth * source.width / sourceWidth));
//   const height = Math.max(1, Math.round(logicalHeight * source.height / sourceHeight));
//   const radius = Math.max(0, Math.round(cornerRadius * UI_RESOLUTION));
//   const key = `${sourceKey}-surface-${width}x${height}-r${radius}`;
//   if (scene.textures.exists(key)) return key;

//   const texture = scene.textures.createCanvas(key, width, height);
//   if (!texture) return '';
//   const ctx = texture.getContext();
//   for (let y = 0; y < height; y += source.height) {
//     for (let x = 0; x < width; x += source.width) {
//       ctx.drawImage(source, x, y);
//     }
//   }
//   if (radius > 0) {
//     // Karta ma zaokrąglone narożniki — przycinamy do nich fakturę kamienia.
//     ctx.globalCompositeOperation = 'destination-in';
//     ctx.beginPath();
//     ctx.roundRect(0, 0, width, height, Math.min(radius, width / 2, height / 2));
//     ctx.fill();
//     ctx.globalCompositeOperation = 'source-over';
//   }
//   texture.refresh();
//   return key;
// }

// /** Cień karty menu: miękka, ciemna krawędź rozłożona pod całą kartą, nie płaska plama. */
// export function makeMenuCardShadow(
//   scene: Phaser.Scene,
//   cardWidth: number,
//   cardHeight: number,
//   cornerRadius: number = CARD.shadowRadius,
// ): string {
//   const dpr = UI_RESOLUTION;
//   const pad = Math.ceil(CARD.shadowPad * dpr);
//   const width = Math.round((cardWidth + CARD.shadowPad * 2) * dpr);
//   const height = Math.round((cardHeight + CARD.shadowPad * 2) * dpr);
//   const key = `menu-card-shadow-${cardWidth}x${cardHeight}-r${Math.round(cornerRadius * 100)}-d${dpr}`;
//   if (scene.textures.exists(key)) return key;

//   const texture = scene.textures.createCanvas(key, width, height);
//   if (!texture) return '';
//   const ctx = texture.getContext();
//   const x = pad;
//   const y = pad;
//   const w = cardWidth * dpr;
//   const h = cardHeight * dpr;
//   const radius = Math.max(0, cornerRadius) * dpr;

//   // Rozmycie rozchodzi się na boki, z lekkim ciężarem cienia w dół.
//   ctx.save();
//   ctx.shadowColor = CARD.shadowColor;
//   ctx.shadowBlur = CARD.shadowBlur * dpr;
//   ctx.shadowOffsetX = 0;
//   ctx.shadowOffsetY = CARD.shadowOffsetY * dpr;
//   ctx.fillStyle = CARD.shadowFill;
//   ctx.beginPath();
//   ctx.roundRect(x, y, w, h, radius);
//   ctx.fill();
//   ctx.restore();
//   texture.refresh();
//   return key;
// }

// interface CamoTextTexture {
//   width: number;
//   height: number;
//   shadowWidth: number;
//   shadowHeight: number;
// }

// /**
//  * Buduje teksturę napisu wypełnionego zimowym kamuflażem (bez obwódki).
//  * Zwraca logiczny rozmiar (w px ekranu) albo null, gdy canvas jest niedostępny.
//  */
// export function makeCamoTextTexture(
//   scene: Phaser.Scene,
//   key: string,
//   text: string,
//   fontPx: number,
//   fontFamily: string,
//   resolution: number,
// ): CamoTextTexture | null {
//   const scale = Math.max(1, Math.min(3, resolution));
//   const font = `${Math.round(fontPx * scale)}px ${fontFamily}`;

//   const probe = document.createElement('canvas').getContext('2d');
//   if (!probe) return null;
//   probe.font = font;
//   const metrics = probe.measureText(text);
//   const ascent = metrics.actualBoundingBoxAscent || fontPx * scale * 0.8;
//   const descent = metrics.actualBoundingBoxDescent || fontPx * scale * 0.25;
//   const pad = Math.round(6 * scale);
//   const width = Math.ceil(metrics.width) + pad * 2;
//   const height = Math.ceil(ascent + descent) + pad * 2;
//   if (width <= 0 || height <= 0) return null;

//   if (scene.textures.exists(key)) scene.textures.remove(key);
//   const canvasTexture = scene.textures.createCanvas(key, width, height);
//   if (!canvasTexture) return null;
//   const ctx = canvasTexture.getContext();

//   // 1. Tło: kolor podstawowy z lekkim pionowym przejściem.
//   const base = ctx.createLinearGradient(0, 0, 0, height);
//   base.addColorStop(0, TEXTURE.camo.base);
//   base.addColorStop(1, TEXTURE.camo.tones[0]);
//   ctx.fillStyle = base;
//   ctx.fillRect(0, 0, width, height);

//   // 2. Plamy moro: od największych (jasna szarość) po najmniejsze (chłodny cień).
//   const rnd = camoRandom(0x5eed_2024);
//   // Warstwy od ciemniejszych do jaśniejszych — biel jest ostatnia i najrzadsza,
//   // więc pozostaje akcentem, a nie tłem wzoru.
//   const layers = [
//     { color: TEXTURE.camo.dark, count: 12, min: 0.3, max: 0.5 },
//     { color: TEXTURE.camo.tones[2], count: 8, min: 0.26, max: 0.44 },
//     { color: TEXTURE.camo.tones[1], count: 5, min: 0.2, max: 0.34 },
//     { color: TEXTURE.camo.accent, count: 3, min: 0.12, max: 0.2 },
//   ];
//   for (const layer of layers) {
//     ctx.fillStyle = layer.color;
//     for (let i = 0; i < layer.count; i++) {
//       const cx = rnd() * width;
//       const cy = rnd() * height;
//       const radius = height * (layer.min + rnd() * (layer.max - layer.min));
//       camoBlob(ctx, rnd, cx, cy, radius);
//     }
//   }

//   // 3. Drobne punkty — głównie jasne, co trzeci ciemniejszy — głębia w drobnej skali.
//   for (let i = 0; i < 90; i++) {
//     ctx.fillStyle = i % 3 === 2 ? TEXTURE.camo.tones[3] : TEXTURE.camo.accent;
//     const r = (0.6 + rnd() * 1.6) * scale;
//     ctx.beginPath();
//     ctx.arc(rnd() * width, rnd() * height, r, 0, Math.PI * 2);
//     ctx.fill();
//   }

//   // 4. Przycięcie wzoru do kształtu liter — bez obrysu i bez cienia.
//   ctx.globalCompositeOperation = 'destination-in';
//   ctx.font = font;
//   ctx.textAlign = 'center';
//   ctx.textBaseline = 'alphabetic';
//   ctx.fillStyle = '#000000';
//   ctx.fillText(text, width / 2, pad + ascent);
//   ctx.globalCompositeOperation = 'source-over';

//   canvasTexture.refresh();

//   // Wyraźniejszy cień typograficzny: głęboka szarość, większe przesunięcie i mocniejsze
//   // rozmycie — kontrastuje z zielonym tłem, bez czarnej obwódki. Druga warstwa dodaje
//   // poświatę przy krawędziach, żeby litery mocniej odcinały się od planszy.
//   const shadowPad = Math.round(16 * scale);
//   const shadowOffsetY = Math.round(3.5 * scale);
//   const shadowCanvas = document.createElement('canvas');
//   shadowCanvas.width = width + shadowPad * 2;
//   shadowCanvas.height = height + shadowPad * 2;
//   const shadowCtx = shadowCanvas.getContext('2d');
//   if (shadowCtx) {
//     shadowCtx.filter = `blur(${Math.round(6.5 * scale)}px)`;
//     shadowCtx.globalAlpha = 0.92;
//     shadowCtx.drawImage(ctx.canvas, shadowPad, shadowPad + shadowOffsetY);
//     shadowCtx.filter = 'none';
//     shadowCtx.globalAlpha = 1;
//     shadowCtx.globalCompositeOperation = 'source-in';
//     shadowCtx.fillStyle = TEXTURE.camo.shadow;
//     shadowCtx.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
//     shadowCtx.globalCompositeOperation = 'source-over';

//     // warstwa poświaty na krawędziach — dodatkowo odcina litery od zielonego tła
//     shadowCtx.globalAlpha = 0.75;
//     shadowCtx.filter = `blur(${Math.round(2.5 * scale)}px)`;
//     shadowCtx.drawImage(ctx.canvas, shadowPad, shadowPad + shadowOffsetY);
//     shadowCtx.filter = 'none';
//     shadowCtx.globalAlpha = 1;
//     shadowCtx.globalCompositeOperation = 'source-in';
//     shadowCtx.fillStyle = TEXTURE.camo.shadow;
//     shadowCtx.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
//     shadowCtx.globalCompositeOperation = 'source-over';

//     const shadowKey = key + '-shadow';
//     if (scene.textures.exists(shadowKey)) scene.textures.remove(shadowKey);
//     const shadowTexture = scene.textures.createCanvas(shadowKey, shadowCanvas.width, shadowCanvas.height);
//     if (shadowTexture) {
//       shadowTexture.getContext().drawImage(shadowCanvas, 0, 0);
//       shadowTexture.refresh();
//     }
//   }

//   return {
//     width: width / scale,
//     height: height / scale,
//     shadowWidth: shadowCanvas.width / scale,
//     shadowHeight: shadowCanvas.height / scale,
//   };
// }

// /* =========================================================================================
//    MIĘKKI CIEŃ WOKÓŁ IKONY (poświata naokoło, nie plama spod ikony).
//    Kopia tekstury jest rozmywana i przyciemniana — powstaje poświata otaczająca ikonę
//    z każdej strony. Generowana raz, jak wszystkie tekstury gry.
//    ========================================================================================= */
// export function makeIconShadowTexture(
//   scene: Phaser.Scene,
//   sourceKey: string,
//   shadowKey: string,
//   blur: number,
//   fill: number,
//   alpha: number,
//   passes = 1,
// ): boolean {
//   if (scene.textures.exists(shadowKey)) return true;
//   const src = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
//   if (!src || !src.width || !src.height) return false;

//   const pad = Math.ceil(blur * 2.5);
//   const width = src.width + pad * 2;
//   const height = src.height + pad * 2;
//   const canvas = document.createElement('canvas');
//   canvas.width = width;
//   canvas.height = height;
//   const ctx = canvas.getContext('2d');
//   if (!ctx) return false;

//   // Każde kolejne nałożenie rozmytej sylwetki zagęszcza cień: alfa narasta
//   // jak 1-(1-a)^passes, więc rdzeń jest kryjący, a brzeg nadal łagodnie gaśnie.
//   ctx.filter = `blur(${blur}px)`;
//   for (let i = 0; i < Math.max(1, passes); i++) {
//     ctx.drawImage(src as CanvasImageSource, pad, pad);
//   }
//   ctx.filter = 'none';
//   ctx.globalCompositeOperation = 'source-in';
//   const r = (fill >> 16) & 255;
//   const g = (fill >> 8) & 255;
//   const b = fill & 255;
//   ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
//   ctx.fillRect(0, 0, width, height);
//   ctx.globalCompositeOperation = 'source-over';

//   const texture = scene.textures.addCanvas(shadowKey, canvas);
//   texture?.refresh();
//   return Boolean(texture);
// }

/* =========================================================================================
   Faktury i cienie generowane na canvasie: kamienna plansza, kamień kart i pasków,
   cień kart menu, tytuł w zimowym kamuflażu i miękki cień wokół ikon.
   ========================================================================================= */
import Phaser from 'phaser';
import { BOARD_H, CARD, CELL, COLS, ENEMY_STYLE, GAME_W, ROWS, TEXTURE, UI_RESOLUTION } from '../constants';
import { isPath, tileTextureKey } from '../logic/board';
import { cardBackground } from '../utils/color';

/* =========================================================================================
   TYTUŁ W ZIMOWYM KAMUFLAŻU (wojska górskie).
   Litery są wypełnione biało-szarym wzorem moro: rysujemy plamy na canvasie, a potem
   przycinamy je do kształtu napisu (`destination-in`). Powstaje zwykła tekstura, więc
   w pętli gry nie ma żadnego dodatkowego kosztu ani pracy dla GC.
   ========================================================================================= */

/** Deterministyczny generator — wzór moro jest zawsze ten sam przy każdym uruchomieniu. */
function camoRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rozlana ciecz: „grzbiecik" zbudowany z nakładających się kropli o losowych promieniach
 * i przesunięciach. Krawędzie są faliste i nierówne, jak płyn rozlany na powierzchni,
 * a nie regularny wielokąt.
 */
function camoBlob(
  ctx: CanvasRenderingContext2D,
  rnd: () => number,
  cx: number,
  cy: number,
  radius: number,
) {
  // krople główne + od 2 do 4 satelitów „rozlanych" w losowych kierunkach
  const drops = 3 + Math.floor(rnd() * 3);
  for (let d = 0; d < drops; d++) {
    const angle = d === 0 ? 0 : rnd() * Math.PI * 2;
    // pierwsza kropla siedzi w środku, kolejne są coraz mniejsze i dalej
    const drift = d === 0 ? 0 : radius * (0.45 + rnd() * 0.85);
    const cx2 = cx + Math.cos(angle) * drift;
    const cy2 = cy + Math.sin(angle) * drift * 0.62;
    const r2 = d === 0 ? radius * (0.85 + rnd() * 0.4) : radius * (0.3 + rnd() * 0.5);

    // obwód z falowaniem o dwóch częstotliwościach (duża fala + drobne nerwowości)
    const points = 22;
    const phase = rnd() * Math.PI * 2;
    const wob = 0.24 + rnd() * 0.2;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = (i / points) * Math.PI * 2;
      const wave =
        1 +
        wob * 0.5 * Math.sin(t * 3 + phase) +
        wob * 0.28 * Math.sin(t * 5 - phase * 1.7) +
        wob * 0.16 * Math.sin(t * 8 + phase * 2.3);
      // rozciągnięcie poziome: ciecz rozlewa się szerzej niż w pionie
      const rx = r2 * wave * 1.3;
      const ry = r2 * wave * 0.78;
      const px = cx2 + Math.cos(t) * rx;
      const py = cy2 + Math.sin(t) * ry;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}


interface PatternGrid {
  width: number;
  height: number;
  values: Float32Array;
}

function makePatternGrid(width: number, height: number, rnd: () => number): PatternGrid {
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) values[i] = rnd() * 2 - 1;
  return { width, height, values };
}

function samplePatternGrid(grid: PatternGrid, x: number, y: number, width: number, height: number): number {
  const gx = (x / width) * grid.width;
  const gy = (y / height) * grid.height;
  const x0 = Math.floor(gx) % grid.width;
  const y0 = Math.floor(gy) % grid.height;
  const x1 = (x0 + 1) % grid.width;
  const y1 = (y0 + 1) % grid.height;
  const tx0 = gx - Math.floor(gx);
  const ty0 = gy - Math.floor(gy);
  const tx = tx0 * tx0 * (3 - 2 * tx0);
  const ty = ty0 * ty0 * (3 - 2 * ty0);
  const a = grid.values[y0 * grid.width + x0];
  const b = grid.values[y0 * grid.width + x1];
  const c = grid.values[y1 * grid.width + x0];
  const d = grid.values[y1 * grid.width + x1];
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

/** Plansza z fakturą pasków, zachowanymi kolorami podłoża i żwirem na jezdni. */
export function makeBoardStoneTexture(scene: Phaser.Scene): string {
  const key = 'board-stone-bars-gravel-8x8-v2';
  if (scene.textures.exists(key)) return key;
  const height = BOARD_H;
  const texture = scene.textures.createCanvas(key, GAME_W, height);
  if (!texture) return '';
  const ctx = texture.getContext();

  // Mapa składana z kafelków, włącznie z zaokrągleniami dróg.
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const tileKey = tileTextureKey(col, row);
      ctx.drawImage(scene.textures.get(tileKey).getSourceImage() as CanvasImageSource, col * CELL, row * CELL);
    }
  }

  applyBarStoneGrain(scene, ctx);
  overlayRoadGravel(scene, ctx);
  texture.refresh();
  return key;
}

const barGrainCache = new WeakMap<HTMLCanvasElement, ImageData>();

/** Ta sama faktura i skala co drawStoneBar, bez przenoszenia szarej barwy pasków. */
function applyBarStoneGrain(scene: Phaser.Scene, ctx: CanvasRenderingContext2D, offsetX = 0, offsetY = 0) {
  const color = cardBackground(ENEMY_STYLE.tank.color);
  const { width, height } = TEXTURE.barStoneSource;
  const key = makeMenuStoneTexture(scene, color, width, height);
  if (!key) return;
  const source = scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
  let grain = barGrainCache.get(source);
  if (!grain) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const grainCtx = canvas.getContext('2d');
    if (!grainCtx) return;
    // Dopasowanie rozdzielczosci HiDPI do pikseli planszy, nie rozciaganie wzoru.
    grainCtx.drawImage(source, 0, 0, width, height);
    grain = grainCtx.getImageData(0, 0, width, height);
    barGrainCache.set(source, grain);
  }

  const baseBrightness = ((color >>> 16) & 255) + ((color >>> 8) & 255) + (color & 255);
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const pixels = image.data;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const sample = (((y + offsetY) % height) * width + ((x + offsetX) % width)) * 4;
      const multiplier = (grain.data[sample] + grain.data[sample + 1] + grain.data[sample + 2]) / baseBrightness;
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        pixels[offset + channel] = Math.round(pixels[offset + channel] * multiplier);
      }
    }
  }
  ctx.putImageData(image, 0, 0);
}

/* =========================================================================================
   ŻWIR NA JEZDNI: 64 kafelki 25x25 px, wspólny powtarzalny blok 8x8 (200x200 px),
   generowane proceduralnie i zszyte bez widocznych łączeń: kamyki rysowane są na torusie,
   więc blok powiela się w nieskończoność. Nakładane z alfą 0.3 w trybie "luminosity":
   kamyki zmieniają tylko jasność, a żółtawy odcień piasku (TEXTURE.sand) zostaje nietknięty.
   ========================================================================================= */
export const GRAVEL_TILE_SPAN = 8;
export const GRAVEL_TILE_KEYS = Array.from(
  { length: GRAVEL_TILE_SPAN * GRAVEL_TILE_SPAN },
  (_, i) => `tile-gravel-${GRAVEL_TILE_SPAN}x${GRAVEL_TILE_SPAN}-${i % GRAVEL_TILE_SPAN}-${Math.floor(i / GRAVEL_TILE_SPAN)}`,
);
export const GRAVEL_ALPHA = 0.3;
const GRAVEL_BLOCK = CELL * GRAVEL_TILE_SPAN;

/** Blok 8x8 powtarzany w siatce planszy, bez skalowania pojedynczych kafelków. */
export function gravelTileKey(col: number, row: number): string {
  return GRAVEL_TILE_KEYS[(col % GRAVEL_TILE_SPAN) + (row % GRAVEL_TILE_SPAN) * GRAVEL_TILE_SPAN];
}

/** Naturalna, lekko ciepła szarość kamienia o zadanej jasności 0..255. */
function stoneGrey(l: number): string {
  const v = Math.max(0, Math.min(255, Math.round(l)));
  return `rgb(${v},${Math.round(v * 0.97)},${Math.round(v * 0.92)})`;
}

/** Jeden kamyk tłucznia: kanciasty wielokąt, jaśniejszy u góry po lewej, z ciemną krawędzią. */
function drawPebble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  squash: number,
  rot: number,
  lum: number,
  corners: number[],
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, squash);
  const base = lum * 255;
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, stoneGrey(base + 34));
  g.addColorStop(0.5, stoneGrey(base));
  g.addColorStop(1, stoneGrey(base - 58));
  ctx.fillStyle = g;
  ctx.beginPath();
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * corners[i];
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = 'rgba(40,36,30,0.6)';
  ctx.stroke();
  ctx.restore();
}

/** Buduje raz blok 8x8 kafelków żwiru. Zwraca false, gdy canvas jest niedostępny. */
export function ensureGravelTiles(scene: Phaser.Scene): boolean {
  if (GRAVEL_TILE_KEYS.every((key) => scene.textures.exists(key))) return true;
  const B = GRAVEL_BLOCK;
  const block = document.createElement('canvas');
  block.width = B;
  block.height = B;
  const ctx = block.getContext('2d');
  if (!ctx) return false;
  const rnd = camoRandom(0x67726176);

  // pył między kamykami
  ctx.fillStyle = stoneGrey(116);
  ctx.fillRect(0, 0, B, B);
  const areaScale = (B * B) / (50 * 50);
  for (let i = 0; i < Math.round(260 * areaScale); i++) {
    ctx.fillStyle = stoneGrey(92 + rnd() * 56);
    ctx.fillRect(Math.floor(rnd() * B), Math.floor(rnd() * B), 1, 1);
  }

  // Drobny, gęsty żwir: mniejsze kamyki (promień 0.7–1.6 px) i ok. 2,5× więcej na tym samym bloku.
  for (let i = 0; i < Math.round(480 * areaScale); i++) {
    const x = rnd() * B;
    const y = rnd() * B;
    const r = 0.7 + rnd() * 0.9;
    const squash = 0.62 + rnd() * 0.38;
    const rot = rnd() * Math.PI;
    const lum = 0.54 + rnd() * 0.44;
    const corners: number[] = [];
    const sides = 5 + Math.floor(rnd() * 3);
    for (let s = 0; s < sides; s++) corners.push(0.72 + rnd() * 0.28);
    for (let oy = -B; oy <= B; oy += B) {
      for (let ox = -B; ox <= B; ox += B) {
        if (x + ox + r + 1 < 0 || x + ox - r - 1 > B || y + oy + r + 1 < 0 || y + oy - r - 1 > B) continue;
        drawPebble(ctx, x + ox, y + oy, r, squash, rot, lum, corners);
      }
    }
  }

  GRAVEL_TILE_KEYS.forEach((key, i) => {
    if (scene.textures.exists(key)) return;
    const tile = document.createElement('canvas');
    tile.width = CELL;
    tile.height = CELL;
    const tctx = tile.getContext('2d');
    if (!tctx) return;
    const x = (i % GRAVEL_TILE_SPAN) * CELL;
    const y = Math.floor(i / GRAVEL_TILE_SPAN) * CELL;
    tctx.drawImage(block, x, y, CELL, CELL, 0, 0, CELL, CELL);
    scene.textures.addCanvas(key, tile)?.refresh();
  });
  return GRAVEL_TILE_KEYS.every((key) => scene.textures.exists(key));
}

type GravelCornerDir = 'ne' | 'nw' | 'se' | 'sw';

function canvasCornerPath(ctx: CanvasRenderingContext2D, corner: GravelCornerDir, inverted = false) {
  const S = CELL;
  const R = TEXTURE.cornerRadius;
  ctx.beginPath();
  if (inverted) ctx.rect(0, 0, S, S);
  if (corner === 'sw') {
    ctx.moveTo(0, 0);
    ctx.lineTo(S, 0);
    ctx.lineTo(S, S);
    ctx.lineTo(R, S);
    ctx.arc(R, S - R, R, Math.PI / 2, Math.PI, false);
  } else if (corner === 'se') {
    ctx.moveTo(0, 0);
    ctx.lineTo(S, 0);
    ctx.lineTo(S, S - R);
    ctx.arc(S - R, S - R, R, 0, Math.PI / 2, false);
    ctx.lineTo(0, S);
  } else if (corner === 'nw') {
    ctx.moveTo(0, S);
    ctx.lineTo(S, S);
    ctx.lineTo(S, 0);
    ctx.lineTo(R, 0);
    ctx.arc(R, R, R, -Math.PI / 2, -Math.PI, true);
  } else {
    ctx.moveTo(0, 0);
    ctx.lineTo(S - R, 0);
    ctx.arc(S - R, R, R, -Math.PI / 2, 0, false);
    ctx.lineTo(S, S);
    ctx.lineTo(0, S);
  }
  ctx.closePath();
}

/**
 * Kładzie kafelki żwiru na jezdni (z wycięciem klina na zakrętach). Tryb „luminosity"
 * przenosi na piasek wyłącznie jasność kamyków — barwa i nasycenie żółtawej drogi
 * zostają dokładnie takie, jakie definiuje TEXTURE.sand.
 */
function overlayRoadGravel(scene: Phaser.Scene, ctx: CanvasRenderingContext2D) {
  if (!ensureGravelTiles(scene)) return;
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      drawRoadGravelTile(scene, ctx, col, row, col * CELL, row * CELL);
    }
  }
}

function drawRoadGravelTile(
  scene: Phaser.Scene,
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  x: number,
  y: number,
) {
  const tileKey = tileTextureKey(col, row);
  const inner = tileKey.startsWith('tile-inner-');
  if (!isPath(col, row) && !inner) return;
  const tile = scene.textures.get(gravelTileKey(col, row)).getSourceImage() as HTMLCanvasElement;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = GRAVEL_ALPHA;
  ctx.globalCompositeOperation = 'luminosity';
  if (inner || tileKey.startsWith('tile-corner-')) {
    const dir = tileKey.split('-')[2] as GravelCornerDir;
    canvasCornerPath(ctx, dir, inner);
    ctx.clip('evenodd');
  }
  ctx.drawImage(tile, 0, 0);
  ctx.restore();
}

/** Zapasowy kafelek ma te same kolory, fakturę i wycięcia co cała plansza. */
export function makeBoardTileTexture(scene: Phaser.Scene, col: number, row: number): string {
  const key = `board-stone-bars-gravel-8x8-v2-${col}-${row}`;
  if (scene.textures.exists(key)) return key;
  const baseKey = tileTextureKey(col, row);
  const canvas = document.createElement('canvas');
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext('2d');
  if (!ctx) return baseKey;
  ctx.drawImage(scene.textures.get(baseKey).getSourceImage() as CanvasImageSource, 0, 0);
  applyBarStoneGrain(scene, ctx, col * CELL, row * CELL);
  if (ensureGravelTiles(scene)) drawRoadGravelTile(scene, ctx, col, row, 0, 0);
  const texture = scene.textures.addCanvas(key, canvas);
  texture?.refresh();
  return texture ? key : baseKey;
}

/**
 * Tworzy ziarnisty kamienny wzór z obrazu jako achromatyczną modulację jasności.
 * Bazowy kolor karty pozostaje bez zmian (oblicza go cardBackground); kolorem źródłowego
 * zdjęcia w ogóle nie malujemy. Kilka zawijanych oktaw szumu daje drobne kruszywo,
 * a odejmowanie średniej utrzymuje średnią jasność karty i jej obecną barwę.
 * `textureDarkness` zwiększa tylko kontrast ciemnych drobinek na wskazanej teksturze;
 * nie przyciemnia bazowego koloru powierzchni.
 * `cornerRadius` przycina fakturę do kształtu okienka o zaokrąglonych narożnikach
 * (0 = prostokąt — plansza, paski i inne powierzchnie bez zaokrągleń).
 */
export function makeMenuStoneTexture(
  scene: Phaser.Scene,
  baseColor: number,
  logicalWidth: number,
  logicalHeight: number,
  grainStrength: number = TEXTURE.stoneGrain,
  textureDarkness = 0,
  cornerRadius = 0,
): string {
  const dpr = UI_RESOLUTION;
  const width = Math.max(1, Math.round(logicalWidth * dpr));
  const height = Math.max(1, Math.round(logicalHeight * dpr));
  const key = `menu-stone-${baseColor.toString(16).padStart(6, '0')}-${width}x${height}-g${Math.round(grainStrength * 100)}-d${Math.round(textureDarkness * 100)}-r${cornerRadius}`;
  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const seed = (baseColor ^ (width * 374761393) ^ (height * 668265263)) >>> 0;
  const rnd = camoRandom(seed);
  const grids = [
    { grid: makePatternGrid(7, 6, rnd), weight: 0.42 },
    { grid: makePatternGrid(19, 16, rnd), weight: 0.29 },
    { grid: makePatternGrid(53, 46, rnd), weight: 0.19 },
    { grid: makePatternGrid(Math.max(1, Math.floor(width / 3)), Math.max(1, Math.floor(height / 3)), rnd), weight: 0.1 },
  ];

  const noise = new Float32Array(width * height);
  let mean = 0;
  let pixel = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (const layer of grids) value += samplePatternGrid(layer.grid, x, y, width, height) * layer.weight;
      noise[pixel++] = value;
      mean += value;
    }
  }
  mean /= noise.length;

  const image = ctx.createImageData(width, height);
  const sourceR = (baseColor >>> 16) & 255;
  const sourceG = (baseColor >>> 8) & 255;
  const sourceB = baseColor & 255;
  // Only deepen the negative/noise grains; keep the mean at 1 so the base color stays put.
  let shapedMean = 0;
  for (let i = 0; i < noise.length; i++) {
    const delta = noise[i] - mean;
    shapedMean += delta < 0 ? delta * (1 + textureDarkness) : delta;
  }
  shapedMean /= noise.length;

  // Neutral luminance-only modulation preserves hue; darkening affects only the pattern.
  for (let i = 0; i < noise.length; i++) {
    const delta = noise[i] - mean;
    const shaped = (delta < 0 ? delta * (1 + textureDarkness) : delta) - shapedMean;
    const luminanceMix = Math.max(0.55, Math.min(1.32, 1 + shaped * grainStrength));
    const offset = i * 4;
    image.data[offset] = Math.min(255, Math.max(0, Math.round(sourceR * luminanceMix)));
    image.data[offset + 1] = Math.min(255, Math.max(0, Math.round(sourceG * luminanceMix)));
    image.data[offset + 2] = Math.min(255, Math.max(0, Math.round(sourceB * luminanceMix)));
    image.data[offset + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  /* Zaokrąglone narożniki: faktura przycięta do kształtu okienka (`destination-in`),
     tak samo jak kamuflaż przycinany do liter tytułu. */
  if (cornerRadius > 0) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, cornerRadius * dpr);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  const texture = scene.textures.addCanvas(key, canvas);
  texture?.refresh();
  return key;
}

/** Reuses the exact menu-card grain at its original scale, cached for each surface size. */
export function makeStoneSurfaceTexture(
  scene: Phaser.Scene,
  baseColor: number,
  logicalWidth: number,
  logicalHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  grainStrength: number = TEXTURE.stoneGrain,
  cornerRadius = 0,
): string {
  const sourceKey = makeMenuStoneTexture(scene, baseColor, sourceWidth, sourceHeight, grainStrength);
  if (!sourceKey) return '';
  if (logicalWidth === sourceWidth && logicalHeight === sourceHeight && cornerRadius === 0) return sourceKey;

  // makeMenuStoneTexture always uses an HTMLCanvasElement as its source.
  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement;
  const width = Math.max(1, Math.round(logicalWidth * source.width / sourceWidth));
  const height = Math.max(1, Math.round(logicalHeight * source.height / sourceHeight));
  const radius = Math.max(0, Math.round(cornerRadius * UI_RESOLUTION));
  const key = `${sourceKey}-surface-${width}x${height}-r${radius}`;
  if (scene.textures.exists(key)) return key;

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return '';
  const ctx = texture.getContext();
  for (let y = 0; y < height; y += source.height) {
    for (let x = 0; x < width; x += source.width) {
      ctx.drawImage(source, x, y);
    }
  }
  if (radius > 0) {
    // Karta ma zaokrąglone narożniki — przycinamy do nich fakturę kamienia.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, Math.min(radius, width / 2, height / 2));
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  texture.refresh();
  return key;
}

/** Cień karty menu: miękka, ciemna krawędź rozłożona pod całą kartą, nie płaska plama. */
export function makeMenuCardShadow(
  scene: Phaser.Scene,
  cardWidth: number,
  cardHeight: number,
  cornerRadius: number = CARD.shadowRadius,
): string {
  const dpr = UI_RESOLUTION;
  const pad = Math.ceil(CARD.shadowPad * dpr);
  const width = Math.round((cardWidth + CARD.shadowPad * 2) * dpr);
  const height = Math.round((cardHeight + CARD.shadowPad * 2) * dpr);
  const key = `menu-card-shadow-${cardWidth}x${cardHeight}-r${Math.round(cornerRadius * 100)}-d${dpr}`;
  if (scene.textures.exists(key)) return key;

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return '';
  const ctx = texture.getContext();
  const x = pad;
  const y = pad;
  const w = cardWidth * dpr;
  const h = cardHeight * dpr;
  const radius = Math.max(0, cornerRadius) * dpr;

  // Rozmycie rozchodzi się na boki, z lekkim ciężarem cienia w dół.
  ctx.save();
  ctx.shadowColor = CARD.shadowColor;
  ctx.shadowBlur = CARD.shadowBlur * dpr;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = CARD.shadowOffsetY * dpr;
  ctx.fillStyle = CARD.shadowFill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.restore();
  texture.refresh();
  return key;
}

interface CamoTextTexture {
  width: number;
  height: number;
  shadowWidth: number;
  shadowHeight: number;
}

/**
 * Buduje teksturę napisu wypełnionego zimowym kamuflażem (bez obwódki).
 * Zwraca logiczny rozmiar (w px ekranu) albo null, gdy canvas jest niedostępny.
 */
export function makeCamoTextTexture(
  scene: Phaser.Scene,
  key: string,
  text: string,
  fontPx: number,
  fontFamily: string,
  resolution: number,
): CamoTextTexture | null {
  const scale = Math.max(1, Math.min(3, resolution));
  const font = `${Math.round(fontPx * scale)}px ${fontFamily}`;

  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return null;
  probe.font = font;
  const metrics = probe.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || fontPx * scale * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontPx * scale * 0.25;
  const pad = Math.round(6 * scale);
  const width = Math.ceil(metrics.width) + pad * 2;
  const height = Math.ceil(ascent + descent) + pad * 2;
  if (width <= 0 || height <= 0) return null;

  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvasTexture = scene.textures.createCanvas(key, width, height);
  if (!canvasTexture) return null;
  const ctx = canvasTexture.getContext();

  // 1. Tło: kolor podstawowy z lekkim pionowym przejściem.
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, TEXTURE.camo.base);
  base.addColorStop(1, TEXTURE.camo.tones[0]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // 2. Plamy moro: od największych (jasna szarość) po najmniejsze (chłodny cień).
  const rnd = camoRandom(0x5eed_2024);
  // Warstwy od ciemniejszych do jaśniejszych — biel jest ostatnia i najrzadsza,
  // więc pozostaje akcentem, a nie tłem wzoru.
  const layers = [
    { color: TEXTURE.camo.dark, count: 12, min: 0.3, max: 0.5 },
    { color: TEXTURE.camo.tones[2], count: 8, min: 0.26, max: 0.44 },
    { color: TEXTURE.camo.tones[1], count: 5, min: 0.2, max: 0.34 },
    { color: TEXTURE.camo.accent, count: 3, min: 0.12, max: 0.2 },
  ];
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    for (let i = 0; i < layer.count; i++) {
      const cx = rnd() * width;
      const cy = rnd() * height;
      const radius = height * (layer.min + rnd() * (layer.max - layer.min));
      camoBlob(ctx, rnd, cx, cy, radius);
    }
  }

  // 3. Drobne punkty — głównie jasne, co trzeci ciemniejszy — głębia w drobnej skali.
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = i % 3 === 2 ? TEXTURE.camo.tones[3] : TEXTURE.camo.accent;
    const r = (0.6 + rnd() * 1.6) * scale;
    ctx.beginPath();
    ctx.arc(rnd() * width, rnd() * height, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Przycięcie wzoru do kształtu liter — bez obrysu i bez cienia.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000000';
  ctx.fillText(text, width / 2, pad + ascent);
  ctx.globalCompositeOperation = 'source-over';

  canvasTexture.refresh();

  // Wyraźniejszy cień typograficzny: głęboka szarość, większe przesunięcie i mocniejsze
  // rozmycie — kontrastuje z zielonym tłem, bez czarnej obwódki. Druga warstwa dodaje
  // poświatę przy krawędziach, żeby litery mocniej odcinały się od planszy.
  const shadowPad = Math.round(16 * scale);
  const shadowOffsetY = Math.round(3.5 * scale);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = width + shadowPad * 2;
  shadowCanvas.height = height + shadowPad * 2;
  const shadowCtx = shadowCanvas.getContext('2d');
  if (shadowCtx) {
    shadowCtx.filter = `blur(${Math.round(6.5 * scale)}px)`;
    shadowCtx.globalAlpha = 0.92;
    shadowCtx.drawImage(ctx.canvas, shadowPad, shadowPad + shadowOffsetY);
    shadowCtx.filter = 'none';
    shadowCtx.globalAlpha = 1;
    shadowCtx.globalCompositeOperation = 'source-in';
    shadowCtx.fillStyle = TEXTURE.camo.shadow;
    shadowCtx.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
    shadowCtx.globalCompositeOperation = 'source-over';

    // warstwa poświaty na krawędziach — dodatkowo odcina litery od zielonego tła
    shadowCtx.globalAlpha = 0.75;
    shadowCtx.filter = `blur(${Math.round(2.5 * scale)}px)`;
    shadowCtx.drawImage(ctx.canvas, shadowPad, shadowPad + shadowOffsetY);
    shadowCtx.filter = 'none';
    shadowCtx.globalAlpha = 1;
    shadowCtx.globalCompositeOperation = 'source-in';
    shadowCtx.fillStyle = TEXTURE.camo.shadow;
    shadowCtx.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
    shadowCtx.globalCompositeOperation = 'source-over';

    const shadowKey = key + '-shadow';
    if (scene.textures.exists(shadowKey)) scene.textures.remove(shadowKey);
    const shadowTexture = scene.textures.createCanvas(shadowKey, shadowCanvas.width, shadowCanvas.height);
    if (shadowTexture) {
      shadowTexture.getContext().drawImage(shadowCanvas, 0, 0);
      shadowTexture.refresh();
    }
  }

  return {
    width: width / scale,
    height: height / scale,
    shadowWidth: shadowCanvas.width / scale,
    shadowHeight: shadowCanvas.height / scale,
  };
}

/* =========================================================================================
   MIĘKKI CIEŃ WOKÓŁ IKONY (poświata naokoło, nie plama spod ikony).
   Kopia tekstury jest rozmywana i przyciemniana — powstaje poświata otaczająca ikonę
   z każdej strony. Generowana raz, jak wszystkie tekstury gry.
   ========================================================================================= */
export function makeIconShadowTexture(
  scene: Phaser.Scene,
  sourceKey: string,
  shadowKey: string,
  blur: number,
  fill: number,
  alpha: number,
  passes = 1,
): boolean {
  if (scene.textures.exists(shadowKey)) return true;
  const src = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  if (!src || !src.width || !src.height) return false;

  const pad = Math.ceil(blur * 2.5);
  const width = src.width + pad * 2;
  const height = src.height + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  // Każde kolejne nałożenie rozmytej sylwetki zagęszcza cień: alfa narasta
  // jak 1-(1-a)^passes, więc rdzeń jest kryjący, a brzeg nadal łagodnie gaśnie.
  ctx.filter = `blur(${blur}px)`;
  for (let i = 0; i < Math.max(1, passes); i++) {
    ctx.drawImage(src as CanvasImageSource, pad, pad);
  }
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  const r = (fill >> 16) & 255;
  const g = (fill >> 8) & 255;
  const b = fill & 255;
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';

  const texture = scene.textures.addCanvas(shadowKey, canvas);
  texture?.refresh();
  return Boolean(texture);
}

/* =========================================================================================
   DRZEWA I KRZEWY — proceduralna roślinność planszy.
   Rysowana wyłącznie kodem (canvas), bez plików graficznych: gęste, ciemnozielone rozety
   liściaste i niskie krzewy. Tekstury powstają raz
   w menedżerze tekstur sceny, a plansza tylko wstawia je na trawę z dala od dróg.
   ========================================================================================= */

export interface TreeSprite {
  key: string;
  /** Rozmiar pnia/korony w pikselach logicznych planszy. */
  display: number;
}

interface TreePalette {
  deep: string;
  mid: string;
  tip: string;
  vein: string;
  rim: string;
}

type TreeKind = 'rosette' | 'bush' | 'sapling';

interface TreeVariant {
  key: string;
  kind: TreeKind;
  display: number;
  seed: number;
  leaves: number;
  palette: TreePalette;
  flowers?: boolean;
}

const TREE_TEXTURE_PX = 220;

/**
 * Ciemnozielone, CIEPŁE odcienie — w każdym składowa czerwona przewyższa niebieską,
 * więc las nie wpada w zimne, niebieskozielone tony.
 */
const TREE_PALETTES: TreePalette[] = [
  { deep: '#142b10', mid: '#2f511e', tip: '#527a2f', vein: '#a8c880', rim: '#7a9c50' },
  { deep: '#122a14', mid: '#275226', tip: '#457a38', vein: '#9cc487', rim: '#6f9c58' },
  { deep: '#1a2e0f', mid: '#3d5a1b', tip: '#66832c', vein: '#bcc88a', rim: '#9aa85e' },
  { deep: '#132916', mid: '#2a5528', tip: '#4b7d3a', vein: '#a3c88f', rim: '#74a360' },
  { deep: '#102714', mid: '#234f24', tip: '#3f7433', vein: '#98c085', rim: '#6c9a58' },
];

const TREE_VARIANTS: readonly TreeVariant[] = [
  { key: 'tree-broad-1', kind: 'rosette', display: 118, seed: 11, leaves: 16, palette: TREE_PALETTES[0] },
  { key: 'tree-broad-2', kind: 'rosette', display: 110, seed: 23, leaves: 17, palette: TREE_PALETTES[1] },
  { key: 'tree-broad-3', kind: 'rosette', display: 102, seed: 37, leaves: 14, palette: TREE_PALETTES[2] },
  { key: 'tree-broad-4', kind: 'rosette', display: 114, seed: 51, leaves: 18, palette: TREE_PALETTES[3] },
  { key: 'tree-broad-5', kind: 'rosette', display: 112, seed: 127, leaves: 15, palette: TREE_PALETTES[2] },
  { key: 'tree-bush-1', kind: 'bush', display: 90, seed: 67, leaves: 22, palette: TREE_PALETTES[1] },
  { key: 'tree-bush-2', kind: 'bush', display: 84, seed: 79, leaves: 18, palette: TREE_PALETTES[2], flowers: true },
  { key: 'tree-bush-3', kind: 'bush', display: 80, seed: 83, leaves: 15, palette: TREE_PALETTES[3] },
  { key: 'tree-fern-1', kind: 'rosette', display: 96, seed: 97, leaves: 14, palette: TREE_PALETTES[0] },
  { key: 'tree-fern-2', kind: 'rosette', display: 88, seed: 103, leaves: 13, palette: TREE_PALETTES[3] },
  { key: 'tree-shrub-1', kind: 'bush', display: 66, seed: 131, leaves: 24, palette: TREE_PALETTES[0] },
  { key: 'tree-shrub-2', kind: 'bush', display: 60, seed: 139, leaves: 20, palette: TREE_PALETTES[4] },
];

/** Deterministyczny generator — las na planszy jest identyczny po każdym uruchomieniu. */
function treeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shadeHex(hex: string, factor: number): string {
  const value = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((value >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((value >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((value & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

/** Strzyki gęstej, ciemnej trawy wokół pnia — podszywka korony. */
function drawUndergrowth(ctx: CanvasRenderingContext2D, variant: TreeVariant) {
  const S = TREE_TEXTURE_PX;
  const cx = S / 2;
  const cy = S * 0.55;
  const rnd = treeRandom(variant.seed + 5);
  const palette = variant.palette;

  // Strzyki ciemnej trawy przy pniu — miękki cień na kafelku dokłada osobna
  // warstwa (tree-shadow), rysowana nisko, pod wieżami.
  for (let i = 0; i < 15; i++) {
    const angle = rnd() * Math.PI * 2;
    const dist = S * (0.2 + rnd() * 0.27);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist * 0.72 + S * 0.03;
    const color = rnd() > 0.5 ? palette.deep : shadeHex(palette.mid, 0.55);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    const spikes = 3 + Math.floor(rnd() * 3);
    for (let s = 0; s < spikes; s++) {
      const sway = (s - spikes / 2) * 0.34 + (rnd() - 0.5) * 0.2;
      const len = S * (0.045 + rnd() * 0.045);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(sway * 3, -len * 0.6, sway * 6, -len);
      ctx.quadraticCurveTo(sway * 3 + 1.4, -len * 0.45, 2.2, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function treeShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.save();
  ctx.filter = 'blur(3px)';
  ctx.fillStyle = 'rgba(10,22,8,0.42)';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 2, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Jeden liść: sercowaty, ząbkowany na brzegach, z jasną wiązką i podkreśloną krawędzią.
 * Rośnie od (0,0) w kierunku osi -Y; wywołujący obraca go wokół środka rozety.
 */
function drawLeaf(
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number,
  curve: number,
  palette: TreePalette,
  darkness: number,
) {
  const steps = 14;
  const bend = (t: number) => curve * length * t * t;
  const half = (t: number) => {
    const profile = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0.02, t))), 1.15);
    const serration = 1 + 0.1 * Math.sin(t * Math.PI * 11);
    return width * profile * serration;
  };

  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    ctx.lineTo(bend(t) - half(t), -length * t);
  }
  ctx.lineTo(bend(1), -length * 1.025);
  for (let i = steps; i >= 1; i--) {
    const t = i / steps;
    ctx.lineTo(bend(t) + half(t), -length * t);
  }
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, 0, bend(0.8), -length);
  gradient.addColorStop(0, shadeHex(palette.deep, darkness));
  gradient.addColorStop(0.55, shadeHex(palette.mid, darkness));
  gradient.addColorStop(1, shadeHex(palette.tip, darkness));
  ctx.fillStyle = gradient;
  ctx.fill();

  // delikatna, jaśniejsza krawędź liścia
  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.lineWidth = Math.max(0.8, width * 0.06);
  ctx.strokeStyle = shadeHex(palette.rim, Math.min(1.15, darkness + 0.05));
  ctx.stroke();
  ctx.restore();

  // główna wiązka i nerwy boczne
  ctx.save();
  ctx.lineWidth = Math.max(0.75, width * 0.045);
  ctx.strokeStyle = palette.vein;
  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  ctx.moveTo(0, -length * 0.04);
  ctx.quadraticCurveTo(bend(0.5) * 0.65, -length * 0.5, bend(1), -length * 0.96);
  ctx.stroke();
  ctx.globalAlpha = 0.36;
  ctx.lineWidth = Math.max(0.55, width * 0.03);
  for (let i = 1; i <= 4; i++) {
    const t = 0.18 + i * 0.15;
    const x = bend(t);
    const y = -length * t;
    const reach = half(t) * 0.82;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - reach * 0.55, y - length * 0.055, x - reach, y - length * 0.115);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + reach * 0.55, y - length * 0.055, x + reach, y - length * 0.115);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRosette(ctx: CanvasRenderingContext2D, variant: TreeVariant) {
  const S = TREE_TEXTURE_PX;
  const cx = S / 2;
  const cy = S * 0.53;
  const rnd = treeRandom(variant.seed);
  const maxLength = S * 0.42;
  const sapling = variant.kind === 'sapling';

  treeShadow(ctx, cx, cy + S * 0.13, S * 0.23, S * 0.085);
  drawUndergrowth(ctx, variant);

  // trzy pierścienie liści: tył ciemniejszy i dłuższy, przód krótszy i jaśniejszy
  const rings = sapling
    ? [
        { count: variant.leaves, scale: 1, darkness: 0.72 },
        { count: 5, scale: 0.62, darkness: 1.02 },
      ]
    : [
        { count: variant.leaves, scale: 1, darkness: 0.58 },
        { count: Math.max(6, variant.leaves - 3), scale: 0.74, darkness: 0.8 },
        { count: Math.max(4, Math.round(variant.leaves * 0.5)), scale: 0.48, darkness: 1.08 },
      ];

  for (const ring of rings) {
    const start = rnd() * Math.PI * 2;
    const step = (Math.PI * 2) / ring.count;
    for (let i = 0; i < ring.count; i++) {
      const angle = start + i * step + (rnd() - 0.5) * step * 0.42;
      const length =
        maxLength *
        ring.scale *
        (sapling ? 0.84 + rnd() * 0.26 : 0.94 + Math.sin(i * 2.1 + variant.seed) * 0.075 + rnd() * 0.1);
      const width = length * (sapling ? 0.28 : 0.22 + rnd() * 0.06);
      const curve = (rnd() - 0.5) * 0.42;
      const baseR = S * (sapling ? 0.014 : 0.02);
      ctx.save();
      ctx.translate(cx + Math.cos(angle) * baseR, cy + Math.sin(angle) * baseR);
      ctx.rotate(angle + Math.PI / 2);
      drawLeaf(ctx, length, width, curve, variant.palette, ring.darkness);
      ctx.restore();
    }
  }

  // ciemny, gęsty środek rozety
  ctx.save();
  const core = ctx.createRadialGradient(cx - S * 0.02, cy - S * 0.02, 1, cx, cy, S * 0.13);
  core.addColorStop(0, variant.palette.tip);
  core.addColorStop(0.45, variant.palette.mid);
  core.addColorStop(1, variant.palette.deep);
  ctx.fillStyle = core;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.ellipse(cx, cy, S * 0.098, S * 0.075, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // kilka jasnych końcówek w środku — rozbija jednolitą plamę
  ctx.save();
  ctx.strokeStyle = variant.palette.rim;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const angle = rnd() * Math.PI * 2;
    const r = S * (0.035 + rnd() * 0.07);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r * 0.3, cy + Math.sin(angle) * r * 0.3);
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.stroke();
  }
  ctx.restore();

  // rozrzucone listki u podstawy
  if (!sapling) {
    ctx.save();
    for (let i = 0; i < 9; i++) {
      const angle = rnd() * Math.PI * 2;
      const dist = S * (0.2 + rnd() * 0.2);
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist * 0.55 + S * 0.09;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = rnd() > 0.5 ? variant.palette.deep : variant.palette.mid;
      ctx.beginPath();
      ctx.ellipse(0, 0, S * 0.028, S * 0.011, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawBush(ctx: CanvasRenderingContext2D, variant: TreeVariant) {
  const S = TREE_TEXTURE_PX;
  const cx = S / 2;
  const cy = S * 0.55;
  const rnd = treeRandom(variant.seed);

  treeShadow(ctx, cx, cy + S * 0.1, S * 0.21, S * 0.075);

  // ciemna masa krzewu pod liśćmi
  ctx.save();
  ctx.fillStyle = variant.palette.deep;
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 9; i++) {
    const angle = rnd() * Math.PI * 2;
    const dist = S * rnd() * 0.12;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.7, S * (0.06 + rnd() * 0.06), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  for (let ring = 0; ring < 3; ring++) {
    const count = Math.max(5, Math.round(variant.leaves / (ring + 1.25)));
    const start = rnd() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = start + (i / count) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
      const length = S * (0.22 - ring * 0.045) * (0.8 + rnd() * 0.35);
      const width = length * (0.42 + rnd() * 0.14);
      const dist = S * (0.055 - ring * 0.013);
      ctx.save();
      ctx.translate(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
      ctx.rotate(angle + Math.PI / 2);
      drawLeaf(ctx, length, width, (rnd() - 0.5) * 0.5, variant.palette, 0.68 + ring * 0.14);
      ctx.restore();
    }
  }

  if (variant.flowers) {
    ctx.save();
    for (let i = 0; i < 8; i++) {
      const angle = rnd() * Math.PI * 2;
      const dist = S * (0.04 + rnd() * 0.14);
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist * 0.8 - S * 0.08;
      ctx.fillStyle = i % 3 === 0 ? '#d9c38a' : '#c4aa6a';
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.arc(x, y, S * 0.011, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Klucz tekstury miękkiego cienia pod koroną (rysowany NISKO, pod wieżami). */
export const TREE_SHADOW_KEY = 'tree-shadow';

/**
 * Miękki, ciepły cień pod koroną — przyciemniony owal zlewający się z kafelkiem.
 * Rysowany osobno i bez obrotu (jedno stałe światło), więc — w przeciwieństwie do
 * plamy wpitej w teksturę korony — nie kręci się razem z drzewem i wystaje spod
 * liści na kafelek w kolorze pobocza.
 */
function ensureTreeShadow(scene: Phaser.Scene): boolean {
  if (scene.textures.exists(TREE_SHADOW_KEY)) return true;
  const S = 180;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(6,16,5,0.55)');
  g.addColorStop(0.55, 'rgba(8,20,6,0.38)');
  g.addColorStop(0.8, 'rgba(10,24,8,0.16)');
  g.addColorStop(1, 'rgba(10,24,8,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const texture = scene.textures.addCanvas(TREE_SHADOW_KEY, canvas);
  texture?.refresh();
  return Boolean(texture);
}

/** Buduje (raz) tekstury roślinności i zwraca listę kluczy wraz z docelowym rozmiarem. */
export function ensureTreeTextures(scene: Phaser.Scene): TreeSprite[] {
  const sprites: TreeSprite[] = [];
  ensureTreeShadow(scene);
  for (const variant of TREE_VARIANTS) {
    if (scene.textures.exists(variant.key)) {
      sprites.push({ key: variant.key, display: variant.display });
      continue;
    }
    const canvas = document.createElement('canvas');
    canvas.width = TREE_TEXTURE_PX;
    canvas.height = TREE_TEXTURE_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    if (variant.kind === 'bush') drawBush(ctx, variant);
    else drawRosette(ctx, variant);
    const texture = scene.textures.addCanvas(variant.key, canvas);
    texture?.refresh();
    if (texture) sprites.push({ key: variant.key, display: variant.display });
  }
  return sprites;
}
