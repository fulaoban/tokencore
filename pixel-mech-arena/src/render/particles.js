// 粒子系统：火花、碎片、烟雾、冲击波
import { rect } from './pixel.js';

export class Particles {
  constructor() {
    this.list = [];
  }

  clear() {
    this.list.length = 0;
  }

  spawn(p) {
    if (this.list.length > 420) this.list.shift();
    this.list.push({
      x: p.x, y: p.y,
      vx: p.vx ?? 0, vy: p.vy ?? 0,
      life: p.life ?? 20, maxLife: p.life ?? 20,
      color: p.color ?? '#ffffff',
      size: p.size ?? 1,
      gravity: p.gravity ?? 0,
      kind: p.kind ?? 'spark',
      shrink: p.shrink ?? true,
    });
  }

  /** 命中火花 */
  hitSparks(x, y, dir, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = (Math.random() - 0.5) * 1.6;
      const sp = 1.5 + Math.random() * 2.6;
      this.spawn({
        x, y,
        vx: Math.cos(a) * sp * (0.6 + dir * 0.6),
        vy: Math.sin(a) * sp - 0.6,
        life: 10 + Math.random() * 14,
        color: Math.random() > 0.55 ? '#ffffff' : color,
        size: Math.random() > 0.7 ? 2 : 1,
        gravity: 0.08,
      });
    }
  }

  /** 防御火花 */
  guardSparks(x, y, dir) {
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      this.spawn({
        x, y,
        vx: Math.cos(a) * 1.6 * dir + (Math.random() - 0.5),
        vy: Math.sin(a) * 1.6,
        life: 8 + Math.random() * 8,
        color: Math.random() > 0.4 ? '#9ef2ff' : '#ffffff',
        size: 1,
        gravity: 0.05,
      });
    }
  }

  /** 冲击波环 */
  shockwave(x, y, color, radius = 14) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this.spawn({
        x, y,
        vx: Math.cos(a) * radius * 0.12,
        vy: Math.sin(a) * radius * 0.12,
        life: 9,
        color,
        size: 2,
        kind: 'ring',
      });
    }
  }

  /** 装甲碎片 */
  debris(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x, y,
        vx: (Math.random() - 0.5) * 3.4,
        vy: -1 - Math.random() * 2.4,
        life: 24 + Math.random() * 20,
        color,
        size: 2,
        gravity: 0.16,
      });
    }
  }

  /** 落地烟尘 */
  dust(x, y, color = '#6b5a8f') {
    for (let i = 0; i < 5; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 8,
        y,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -0.3 - Math.random() * 0.6,
        life: 16 + Math.random() * 10,
        color,
        size: 1 + Math.floor(Math.random() * 2),
        kind: 'smoke',
        shrink: false,
      });
    }
  }

  update() {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life--;
      if (p.kind === 'smoke') p.vx *= 0.92;
      if (p.life <= 0) list.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const t = p.life / p.maxLife;
      let size = p.size;
      if (p.shrink && p.kind !== 'smoke') size = Math.max(1, Math.round(p.size * t + 0.4));
      ctx.globalAlpha = p.kind === 'smoke' ? Math.min(1, t * 1.4) : Math.min(1, t * 1.8);
      rect(ctx, p.x, p.y, size, size, p.color);
    }
    ctx.globalAlpha = 1;
  }
}
