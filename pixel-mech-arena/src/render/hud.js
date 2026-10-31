// HUD：血条、能量条、护盾条、计时器、回合灯、连击提示
import { rect } from './pixel.js';
import { drawText, textWidth } from '../data/font.js';
import { RULES } from '../data/config.js';

/** 描边框（只画四条边，避免实心矩形盖住内部填充） */
function frame(ctx, x, y, w, h, color, topColor) {
  rect(ctx, x, y, w, 1, color);
  rect(ctx, x, y + h - 1, w, 1, color);
  rect(ctx, x, y, 1, h, color);
  rect(ctx, x + w - 1, y, 1, h, color);
  if (topColor) rect(ctx, x, y, w, 1, topColor);
}

/**
 * 水平条。dir=1 从左向右填充，dir=-1 从右向左填充。
 */
function bar(ctx, x, y, w, h, ratio, fill, back, dir = 1, segment = 0) {
  rect(ctx, x, y, w, h, back);
  const fw = Math.round(w * Math.max(0, Math.min(1, ratio)));
  if (fw > 0) {
    const fx = dir > 0 ? x : x + w - fw;
    rect(ctx, fx, y, fw, h, fill);
    rect(ctx, fx, y, fw, 1, '#ffffff33');
  }
  if (segment > 0) {
    ctx.fillStyle = '#00000066';
    for (let i = segment; i < w; i += segment) ctx.fillRect(x + i, y, 1, h);
  }
  frame(ctx, x - 1, y - 1, w + 2, h + 2, '#0b0814', '#6b5a8f');
}

function drawFighterPanel(ctx, f, side) {
  const isLeft = side === 'left';
  const w = 120;
  const x = isLeft ? 8 : 320 - 8 - w;
  const nameX = isLeft ? x : x + w;

  // 名称（画布内使用 ASCII 代号，中文名在 DOM 覆盖层展示）
  drawText(ctx, f.tag, nameX, 5, {
    color: f.palette.armorLight, scale: 1, align: isLeft ? 'left' : 'right', shadow: '#000000',
  });
  const tagW = textWidth(f.tag, 1);
  drawText(ctx, isLeft ? 'P1' : 'P2', nameX + (isLeft ? tagW + 6 : -tagW - 6), 5, {
    color: '#8d84a8', scale: 1, align: isLeft ? 'left' : 'right',
  });

  // 血条
  const barY = 15;
  const hpRatio = f.hp / RULES.maxHp;
  const hpColor = hpRatio > 0.5 ? '#4ce07a' : hpRatio > 0.22 ? '#ffc247' : '#ff4d5e';
  bar(ctx, x, barY, w, 6, hpRatio, hpColor, '#3a2140', isLeft ? 1 : -1, 12);

  // 能量条
  const enY = barY + 9;
  const enRatio = f.energy / RULES.maxEnergy;
  bar(ctx, x, enY, w, 4, enRatio, '#5ee6ff', '#1b2c48', isLeft ? 1 : -1);

  // 护盾条
  const gdY = enY + 7;
  const gdRatio = f.guard / RULES.maxGuard;
  bar(ctx, x, gdY, w, 3, gdRatio, '#a06fe0', '#2a1e44', isLeft ? 1 : -1);

  // 回合胜场标记
  for (let i = 0; i < RULES.roundsToWin; i++) {
    const px = isLeft ? x + w - 7 - i * 9 : x + i * 9;
    const won = i < f.wins;
    rect(ctx, px, 4, 7, 7, won ? '#ffc247' : '#2a1e44');
    if (won) {
      rect(ctx, px, 4, 7, 2, '#fff0c0');
      rect(ctx, px + 2, 6, 3, 3, '#ff8b3d');
    } else {
      rect(ctx, px, 4, 7, 1, '#453a63');
    }
  }
}

/** 主 HUD */
export function drawHud(ctx, p1, p2, timeLeft) {
  drawFighterPanel(ctx, p1, 'left');
  drawFighterPanel(ctx, p2, 'right');

  // 中央计时器
  const cx = 160;
  const secs = Math.max(0, Math.ceil(timeLeft));
  const urgent = secs <= 10;
  const blink = urgent && Math.floor(timeLeft * 4) % 2 === 0;
  rect(ctx, cx - 21, 3, 42, 26, '#140f22');
  frame(ctx, cx - 21, 3, 42, 26, '#0b0814', '#4a3a6b');
  drawText(ctx, String(secs).padStart(2, '0'), cx, 7, {
    color: urgent ? (blink ? '#ff4d5e' : '#ffc247') : '#f2ecff',
    scale: 2, align: 'center', shadow: '#000000',
  });
  drawText(ctx, 'TIME', cx, 22, { color: '#6b5a8f', scale: 1, align: 'center' });
}

/** 回合开始横幅（置于画面上部，避免遮挡机甲） */
export function drawBanner(ctx, text, sub, alpha = 1, scale = 3) {
  ctx.globalAlpha = alpha;
  const w = textWidth(text, scale);
  const h = scale * 7 + 10;
  const y = 42;
  rect(ctx, 160 - w / 2 - 8, y, w + 16, h, '#0b0814dd');
  rect(ctx, 160 - w / 2 - 8, y, w + 16, 1, '#ffc247');
  rect(ctx, 160 - w / 2 - 8, y + h - 1, w + 16, 1, '#ffc247');
  drawText(ctx, text, 160, y + 4, { color: '#ffc247', scale, align: 'center', shadow: '#7a4a00' });
  if (sub) {
    drawText(ctx, sub, 160, y + scale * 7 + 4, { color: '#c9bfe0', scale: 1, align: 'center' });
  }
  ctx.globalAlpha = 1;
}

/** 大字提示（KO / TIME UP 等） */
export function drawBigText(ctx, text, color = '#ff4d5e', scale = 4) {
  const w = textWidth(text, scale);
  rect(ctx, 160 - w / 2 - 10, 40, w + 20, scale * 7 + 14, '#0b0814e0');
  frame(ctx, 160 - w / 2 - 10, 40, w + 20, scale * 7 + 14, '#0b0814', color);
  drawText(ctx, text, 160, 46, { color, scale, align: 'center', shadow: '#000000' });
}

/** 连击计数 */
export function drawCombo(ctx, f, camX) {
  if (f.comboCount < 2) return;
  const x = Math.round(f.x - camX);
  const y = Math.round(f.y - 56);
  const t = f.comboTimer / 90;
  ctx.globalAlpha = Math.min(1, t * 2.5);
  drawText(ctx, `${f.comboCount} HIT`, x, y, {
    color: '#ffc247', scale: 1, align: 'center', shadow: '#000000',
  });
  ctx.globalAlpha = 1;
}

/** 伤害飘字 */
export class FloatingText {
  constructor() { this.list = []; }
  clear() { this.list.length = 0; }
  add(x, y, text, color) {
    this.list.push({ x, y, text, color, life: 46 });
  }
  update() {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.y -= 0.42;
      t.life--;
      if (t.life <= 0) this.list.splice(i, 1);
    }
  }
  draw(ctx, camX) {
    for (const t of this.list) {
      ctx.globalAlpha = Math.min(1, t.life / 18);
      drawText(ctx, t.text, Math.round(t.x - camX), Math.round(t.y), {
        color: t.color, scale: 1, align: 'center', shadow: '#000000',
      });
    }
    ctx.globalAlpha = 1;
  }
}
