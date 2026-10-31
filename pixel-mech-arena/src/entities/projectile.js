// 投射物：必杀技的能量弹，脱离本体独立飞行
import { rect } from '../render/pixel.js';

export class Projectile {
  constructor({ x, y, dir, owner, palette, damage, knockback, hitstun, speed, size }) {
    this.x = x;
    this.y = y;
    this.vx = dir * speed;
    this.dir = dir;
    this.owner = owner;
    this.palette = palette;
    this.damage = damage;
    this.knockback = knockback;
    this.hitstun = hitstun;
    this.size = size;
    this.life = 120;
    this.dead = false;
    this.trail = [];
  }

  update(world) {
    this.x += this.vx;
    this.life--;
    if (this.life <= 0) this.dead = true;
    if (this.x < world.left - 24 || this.x > world.right + 24) this.dead = true;

    // 拖尾
    this.trail.push({ x: this.x, y: this.y, life: 10 });
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life--;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }
  }

  /** 命中盒 */
  hitbox() {
    const s = this.size;
    return { x: this.x - s / 2, y: this.y - s / 2, w: s, h: s };
  }

  draw(ctx) {
    const pal = this.palette;
    // 拖尾
    for (const t of this.trail) {
      ctx.globalAlpha = (t.life / 10) * 0.5;
      const r = Math.max(1, Math.round(this.size * 0.4 * (t.life / 10)));
      rect(ctx, t.x - r / 2, t.y - r / 2, r, r, pal.beam);
    }
    ctx.globalAlpha = 1;

    const s = this.size;
    const x = Math.round(this.x - s / 2);
    const y = Math.round(this.y - s / 2);
    // 外层辉光
    ctx.globalAlpha = 0.45;
    rect(ctx, x - 2, y - 2, s + 4, s + 4, pal.beam);
    ctx.globalAlpha = 1;
    // 能量核心
    rect(ctx, x, y, s, s, pal.glow);
    rect(ctx, x + 2, y + 2, s - 4, s - 4, '#ffffff');
    // 护罩描边
    rect(ctx, x - 1, y - 1, s + 2, 1, pal.outline);
    rect(ctx, x - 1, y + s, s + 2, 1, pal.outline);
    rect(ctx, x - 1, y - 1, 1, s + 2, pal.outline);
    rect(ctx, x + s, y - 1, 1, s + 2, pal.outline);
  }
}
