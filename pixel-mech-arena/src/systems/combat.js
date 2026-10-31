// 战斗结算：招式判定、命中处理、连击计数
import { ATTACKS, RULES } from '../data/config.js';

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * 结算弹幕与受击盒的碰撞。
 * @param {Projectile[]} projectiles
 * @param {Fighter[]} fighters 所有战斗单位（用于查找攻击者与受害者）
 * @param {object} fx 特效系统
 */
export function resolveProjectiles(projectiles, fighters, fx) {
  const events = [];
  for (const pr of projectiles) {
    if (pr.dead) continue;
    const target = fighters.find((f) => f !== pr.owner && f.alive);
    if (!target) continue;
    if (!overlaps(pr.hitbox(), target.hurtbox())) continue;

    pr.dead = true;
    const atk = ATTACKS.special;
    const result = target.applyHit(pr.owner, atk);
    const cx = pr.x;
    const cy = pr.y;

    if (result.blocked) {
      fx.particles.guardSparks(cx, cy, result.dir);
      fx.audio.block();
      target.energy = Math.min(RULES.maxEnergy, target.energy + 4);
      events.push({ type: 'block', defender: target, attacker: pr.owner });
    } else {
      fx.particles.hitSparks(cx, cy, result.dir, target.palette.armorLight, 18);
      fx.particles.debris(cx, cy, target.palette.armorMid, 8);
      fx.particles.shockwave(cx, cy, pr.palette.beam, 20);
      fx.shake(5);
      fx.audio.hitHeavy();
      pr.owner.comboCount++;
      pr.owner.comboTimer = 90;
      events.push({
        type: 'hit', defender: target, attacker: pr.owner,
        damage: result.damage, dir: result.dir,
      });
    }
    fx.hitstop = Math.max(fx.hitstop, atk.hitstop);
  }
  return events;
}

/**
 * 结算一帧的战斗。
 * @param {Fighter} a 攻击方
 * @param {Fighter} b 防御方
 * @param {object} fx 特效系统（粒子 + 音频）
 */
export function resolveCombat(a, b, fx) {
  const events = [];

  const check = (attacker, defender) => {
    if (!attacker.attack || attacker.hasHit) return;
    const box = attacker.attackbox();
    if (!box) return;
    const hurt = defender.hurtbox();
    if (!overlaps(box, hurt)) return;

    attacker.hasHit = true;
    const atk = attacker.attack;
    const result = defender.applyHit(attacker, atk);
    const cx = (box.x + box.w / 2);
    const cy = (box.y + box.h / 2);

    if (result.blocked) {
      fx.particles.guardSparks(cx, cy, result.dir);
      fx.audio.block();
      defender.energy = Math.min(RULES.maxEnergy, defender.energy + 4);
      events.push({ type: 'block', defender, attacker });
    } else {
      fx.particles.hitSparks(cx, cy, result.dir, defender.palette.armorLight, atk.key === 'heavy' ? 16 : 10);
      fx.particles.debris(cx, cy, defender.palette.armorMid, atk.key === 'heavy' ? 8 : 4);
      fx.particles.shockwave(cx, cy, attacker.palette.beam, atk.key === 'heavy' ? 18 : 12);
      if (atk.key === 'heavy') fx.shake(4);
      else fx.shake(2);
      if (atk.key === 'heavy') fx.audio.hitHeavy();
      else fx.audio.hitLight();

      attacker.comboCount++;
      attacker.comboTimer = 90;
      events.push({ type: 'hit', defender, attacker, damage: result.damage, dir: result.dir });
    }
    fx.hitstop = Math.max(fx.hitstop, atk.hitstop);
  };

  check(a, b);
  check(b, a);
  return events;
}
