// 场景：黄昏城市天际线，视差分层 + 前景地面
import { rect } from './pixel.js';
import { SCENE_COLORS as C } from '../data/palette.js';
import { createRng, randInt } from '../core/rng.js';

const LAYER_W = 320;
const LAYER_H = 180;

/** 生成远景天际线（单层可横向平铺） */
function buildFarLayer() {
  const cv = document.createElement('canvas');
  cv.width = LAYER_W;
  cv.height = LAYER_H;
  const ctx = cv.getContext('2d');
  const rng = createRng(20240);
  ctx.fillStyle = C.far;
  let x = -10;
  while (x < LAYER_W + 10) {
    const w = randInt(rng, 14, 30);
    const h = randInt(rng, 24, 58);
    const top = GROUND_BASE - h;
    ctx.fillRect(x, top, w, h);
    // 楼顶天线
    if (rng() > 0.65) {
      ctx.fillRect(x + Math.floor(w / 2), top - randInt(rng, 3, 8), 1, 8);
    }
    x += w + randInt(rng, 2, 7);
  }
  return cv;
}

/** 中景建筑（带窗户） */
function buildMidLayer() {
  const cv = document.createElement('canvas');
  cv.width = LAYER_W;
  cv.height = LAYER_H;
  const ctx = cv.getContext('2d');
  const rng = createRng(777);
  ctx.fillStyle = C.mid;
  let x = -14;
  while (x < LAYER_W + 14) {
    const w = randInt(rng, 22, 44);
    const h = randInt(rng, 40, 78);
    const top = GROUND_BASE - h;
    ctx.fillRect(x, top, w, h);
    // 屋顶结构
    if (rng() > 0.5) {
      ctx.fillRect(x + randInt(rng, 2, w - 8), top - randInt(rng, 3, 10), randInt(rng, 3, 8), 10);
    }
    // 窗户
    for (let wy = top + 4; wy < GROUND_BASE - 4; wy += 5) {
      for (let wx = x + 3; wx < x + w - 3; wx += 5) {
        const r = rng();
        if (r > 0.72) {
          ctx.fillStyle = r > 0.93 ? C.windowAlt : C.window;
        } else {
          ctx.fillStyle = '#1d1440';
        }
        ctx.fillRect(wx, wy, 2, 3);
      }
    }
    x += w + randInt(rng, 3, 9);
  }
  return cv;
}

/** 前景剪影（管道与支架） */
function buildNearLayer() {
  const cv = document.createElement('canvas');
  cv.width = LAYER_W;
  cv.height = LAYER_H;
  const ctx = cv.getContext('2d');
  const rng = createRng(4242);
  ctx.fillStyle = C.near;
  let x = 0;
  while (x < LAYER_W) {
    const kind = rng();
    if (kind > 0.62) {
      // 管道
      const h = randInt(rng, 18, 34);
      const w = randInt(rng, 3, 5);
      ctx.fillRect(x, GROUND_BASE - h, w, h);
      ctx.fillRect(x - 2, GROUND_BASE - h, w + 4, 3);
    } else if (kind > 0.3) {
      // 支架
      const h = randInt(rng, 24, 44);
      ctx.fillRect(x, GROUND_BASE - h, 2, h);
      ctx.fillRect(x + 9, GROUND_BASE - h, 2, h);
      ctx.fillRect(x, GROUND_BASE - h + 6, 11, 2);
    } else {
      // 箱体
      const w = randInt(rng, 10, 18);
      const h = randInt(rng, 8, 16);
      ctx.fillRect(x, GROUND_BASE - h, w, h);
      ctx.fillRect(x + 2, GROUND_BASE - h + 3, w - 4, 1);
    }
    x += randInt(rng, 26, 52);
  }
  return cv;
}

const GROUND_BASE = 150;
let farLayer, midLayer, nearLayer, stars;

/** 生成星空（一次性） */
function buildStars() {
  const cv = document.createElement('canvas');
  cv.width = LAYER_W;
  cv.height = 120;
  const ctx = cv.getContext('2d');
  const rng = createRng(909);
  for (let i = 0; i < 90; i++) {
    const x = randInt(rng, 0, LAYER_W - 1);
    const y = randInt(rng, 0, 118);
    ctx.fillStyle = rng() > 0.8 ? '#ffffff' : C.star;
    ctx.globalAlpha = 0.4 + rng() * 0.6;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
  return cv;
}

export function initStage() {
  farLayer = buildFarLayer();
  midLayer = buildMidLayer();
  nearLayer = buildNearLayer();
  stars = buildStars();
}

/** 绘制天空渐变 */
function drawSky(ctx) {
  const bands = 26;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const y = Math.floor(t * GROUND_BASE);
    const h = Math.ceil(GROUND_BASE / bands) + 1;
    let col;
    if (t < 0.45) {
      col = mix(C.skyTop, C.skyMid, t / 0.45);
    } else if (t < 0.8) {
      col = mix(C.skyMid, C.skyLow, (t - 0.45) / 0.35);
    } else {
      col = mix(C.skyLow, C.skyGlow, (t - 0.8) / 0.2);
    }
    ctx.fillStyle = col;
    ctx.fillRect(0, y, LAYER_W, h);
  }
  // 月亮
  ctx.fillStyle = '#ffe9b8';
  ctx.fillRect(228, 20, 14, 14);
  ctx.fillStyle = '#e8c88a';
  ctx.fillRect(232, 17, 9, 12);
  ctx.fillRect(227, 23, 16, 8);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}

/**
 * 绘制背景（视差由 camX 驱动）
 */
export function drawStage(ctx, camX, time) {
  drawSky(ctx);

  // 星星（极慢视差）
  const starOff = -Math.floor(camX * 0.04) % LAYER_W;
  ctx.globalAlpha = 0.85;
  ctx.drawImage(stars, starOff, 0);
  ctx.drawImage(stars, starOff + LAYER_W, 0);
  ctx.globalAlpha = 1;

  // 远景
  const farOff = -((camX * 0.18) % LAYER_W);
  ctx.drawImage(farLayer, farOff, 0);
  ctx.drawImage(farLayer, farOff + LAYER_W, 0);

  // 中景
  const midOff = -((camX * 0.42) % LAYER_W);
  ctx.drawImage(midLayer, midOff, 0);
  ctx.drawImage(midLayer, midOff + LAYER_W, 0);

  // 地面
  rect(ctx, 0, GROUND_BASE, LAYER_W, LAYER_H - GROUND_BASE, C.ground);
  rect(ctx, 0, GROUND_BASE, LAYER_W, 2, C.groundTop);
  rect(ctx, 0, GROUND_BASE + 2, LAYER_W, 1, C.groundLip);
  rect(ctx, 0, GROUND_BASE + 3, LAYER_W, 3, C.groundDark);

  // 地砖纹理
  ctx.fillStyle = '#241c46';
  for (let x = -(camX % 16); x < LAYER_W; x += 16) {
    ctx.fillRect(x, GROUND_BASE + 8, 1, 6);
  }
  ctx.fillStyle = '#3a2d63';
  for (let x = -((camX + 8) % 16); x < LAYER_W; x += 16) {
    ctx.fillRect(x, GROUND_BASE + 14, 1, 4);
  }

  // 前景
  const nearOff = -((camX * 1.1) % LAYER_W);
  ctx.drawImage(nearLayer, nearOff, 0);
  ctx.drawImage(nearLayer, nearOff + LAYER_W, 0);
}

/** 绘制可站立的平台 */
export function drawPlatforms(ctx, platforms, camX) {
  for (const pf of platforms) {
    const x = Math.round(pf.x - camX);
    const y = Math.round(pf.y);
    rect(ctx, x, y, pf.w, 4, '#5b3f96');
    rect(ctx, x, y, pf.w, 1, '#a06fe0');
    rect(ctx, x, y + 4, pf.w, 3, '#2e2158');
    // 支撑柱
    rect(ctx, x + 4, y + 7, 3, 8, '#241c46');
    rect(ctx, x + pf.w - 7, y + 7, 3, 8, '#241c46');
  }
}

export const STAGE_GROUND_Y = GROUND_BASE;
