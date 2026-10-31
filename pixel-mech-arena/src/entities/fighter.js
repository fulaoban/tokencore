// 机甲实体：状态机 + 物理 + 招式判定
import { ATTACKS, PHYSICS, RULES, WORLD_W, WALL } from '../data/config.js';

export const STATE = {
  IDLE: 'idle',
  WALK: 'walk',
  JUMP: 'jump',
  FALL: 'fall',
  LIGHT: 'light',
  HEAVY: 'heavy',
  SPECIAL: 'special',
  BLOCK: 'block',
  HURT: 'hurt',
  KO: 'ko',
  WIN: 'win',
};

export class Fighter {
  constructor({ id, name, tag, palette, build, x, facing, isAI = false }) {
    this.id = id;
    this.name = name;
    this.tag = tag;
    this.palette = palette;
    this.build = build;        // 'heavy' | 'light'
    this.isAI = isAI;
    this.facing = facing;
    this.homeX = x;
    this.reset(x, facing);
  }

  /** 重置到回合初始状态。keepWins=true 时保留已赢下的回合数。 */
  reset(x, facing, keepWins = false) {
    this.x = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.hp = RULES.maxHp;
    this.energy = RULES.startEnergy;
    this.guard = RULES.maxGuard;
    this.state = STATE.IDLE;
    this.stateFrame = 0;
    this.attack = null;
    this.attackT = 0;
    this.hasHit = false;
    this.fireProjectile = false;
    this.onGround = false;
    this.platform = null;
    this.flash = 0;
    this.hitstun = 0;
    this.guardCooldown = 0;
    this.blocking = false;
    this.altitude = 0;
    if (!keepWins) this.wins = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.walkPhase = 0;
  }

  get alive() { return this.state !== STATE.KO; }
  get busy() {
    return this.state === STATE.LIGHT || this.state === STATE.HEAVY ||
      this.state === STATE.SPECIAL || this.state === STATE.HURT || this.state === STATE.KO;
  }

  /** 受击盒（局部坐标：x 中心，y 为底部） */
  hurtbox() {
    const w = this.build === 'heavy' ? 17 : 15;
    const h = this.build === 'heavy' ? 46 : 43;
    return { x: this.x - w / 2, y: this.y - h, w, h };
  }

  /** 攻击判定盒。弹幕类招式不产生近身判定盒 */
  attackbox() {
    if (!this.attack || this.state !== this.attack.anim) return null;
    if (this.attack.projectile) return null;
    const total = this.attack.startup + this.attack.active;
    if (this.attackT < this.attack.startup || this.attackT >= total) return null;
    const reach = this.attack.reach;
    const w = reach;
    const h = this.attack.yBottom - this.attack.yTop;
    const x = this.facing > 0 ? this.x + 4 : this.x - 4 - w;
    return { x, y: this.y + this.attack.yTop, w, h };
  }

  canAct() {
    return this.alive && this.state !== STATE.HURT &&
      this.state !== STATE.LIGHT && this.state !== STATE.HEAVY && this.state !== STATE.SPECIAL;
  }

  startAttack(key) {
    const atk = ATTACKS[key];
    if (!atk) return false;
    if (atk.cost > this.energy) return false;
    this.energy -= atk.cost;
    this.attack = atk;
    this.attackT = 0;
    this.state = atk.anim;
    this.stateFrame = 0;
    this.hasHit = false;
    this.blocking = false;
    this.fireProjectile = false;
    return true;
  }

  takeDamage(amount, fromX, opts = {}) {
    if (!this.alive) return;
    const dir = Math.sign(this.x - fromX) || (this.facing * -1);
    this.hp = Math.max(0, this.hp - amount);
    this.flash = 6;

    if (this.hp <= 0) {
      this.state = STATE.KO;
      this.stateFrame = 0;
      this.vx = dir * 2.6;
      this.vy = -3.2;
      this.onGround = false;
      this.attack = null;
      this.blocking = false;
      return;
    }

    this.state = STATE.HURT;
    this.stateFrame = 0;
    this.hitstun = opts.hitstun ?? 12;
    this.vx = dir * (opts.knockback ?? 2);
    this.vy = opts.lift ? -opts.lift : Math.min(this.vy, 0);
    this.attack = null;
    this.blocking = false;
    this.onGround = false;
  }

  /** 是否处于有效防御姿态 */
  canBlock() {
    return this.alive && this.state === STATE.BLOCK;
  }

  update(input, opp, world) {
    this.stateFrame++;
    if (this.flash > 0) this.flash--;
    if (this.hitstun > 0) this.hitstun--;
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer === 0) this.comboCount = 0;
    }
    if (this.guardCooldown > 0) this.guardCooldown--;

    // 能量回复
    if (this.state !== STATE.SPECIAL && this.energy < RULES.maxEnergy) {
      this.energy = Math.min(RULES.maxEnergy, this.energy + RULES.energyRegen / 60);
    }
    // 防御值回复
    if (this.guardCooldown === 0 && !this.blocking && this.guard < RULES.maxGuard) {
      this.guard = Math.min(RULES.maxGuard, this.guard + RULES.guardRegen / 60);
    }

    switch (this.state) {
      case STATE.IDLE:
      case STATE.WALK:
      case STATE.BLOCK:
        this.handleGroundInput(input, opp);
        break;
      case STATE.JUMP:
      case STATE.FALL:
        this.handleAirInput(input);
        break;
      case STATE.LIGHT:
      case STATE.HEAVY:
      case STATE.SPECIAL:
        this.handleAttack(input, opp, world);
        break;
      case STATE.HURT:
        if (this.hitstun <= 0) this.setState(STATE.IDLE);
        break;
      case STATE.KO:
        break;
      case STATE.WIN:
        break;
    }

    this.applyPhysics(world);
  }

  setState(s) {
    this.state = s;
    this.stateFrame = 0;
  }

  handleGroundInput(input, opp) {
    const wantBlock = input.block && !this.busy;
    if (wantBlock) {
      this.setState(STATE.BLOCK);
      this.blocking = true;
      this.vx *= 0.5;
      return;
    }
    this.blocking = false;

    if (input.jump) {
      this.vy = PHYSICS.jumpVelocity;
      this.onGround = false;
      this.platform = null;
      this.setState(STATE.JUMP);
      return;
    }

    if (input.light && this.canAct()) { this.startAttack('light'); return; }
    if (input.heavy && this.canAct()) { this.startAttack('heavy'); return; }
    if (input.special && this.energy >= ATTACKS.special.cost) { this.startAttack('special'); return; }

    let move = 0;
    if (input.left) move -= 1;
    if (input.right) move += 1;

    // 转向：仅在未输入方向时朝向对手
    if (move !== 0) {
      this.facing = move > 0 ? 1 : -1;
      this.vx = move * PHYSICS.walkSpeed;
      this.setState(STATE.WALK);
      this.walkPhase = (this.walkPhase + 0.09) % 1;
    } else {
      this.vx *= PHYSICS.friction;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
      this.setState(STATE.IDLE);
      // 面向对手
      if (opp) this.facing = opp.x >= this.x ? 1 : -1;
    }
  }

  handleAirInput(input) {
    let move = 0;
    if (input.left) move -= 1;
    if (input.right) move += 1;
    if (move !== 0) {
      this.vx += move * PHYSICS.airControl * 0.35;
      this.vx = Math.max(-PHYSICS.walkSpeed * 1.35, Math.min(PHYSICS.walkSpeed * 1.35, this.vx));
      this.facing = move > 0 ? 1 : -1;
    }
    if (input.special && this.energy >= ATTACKS.special.cost && this.state === STATE.FALL) {
      this.startAttack('special');
    }
  }

  handleAttack(input, opp, world) {
    const atk = this.attack;
    this.attackT++;
    const total = atk.startup + atk.active + atk.recovery;

    // 出招瞬间前冲
    if (this.attackT === atk.startup) {
      const lunge = atk.key === 'light' ? 1.1 : atk.key === 'heavy' ? 2.0 : 0.4;
      this.vx = this.facing * lunge;
      // 弹幕招式在判定起始帧发射
      if (atk.projectile) this.fireProjectile = true;
    }

    if (this.attackT >= total) {
      this.attack = null;
      this.attackT = 0;
      this.setState(this.onGround ? STATE.IDLE : STATE.FALL);
      if (this.onGround && opp) this.facing = opp.x >= this.x ? 1 : -1;
    }
  }

  applyPhysics(world) {
    // 水平
    this.x += this.vx;
    // 垂直
    this.vy += PHYSICS.gravity;
    if (this.vy > PHYSICS.maxFall) this.vy = PHYSICS.maxFall;
    this.y += this.vy;

    // 边界
    if (this.x < WALL) { this.x = WALL; this.vx = 0; }
    if (this.x > WORLD_W - WALL) { this.x = WORLD_W - WALL; this.vx = 0; }

    const groundY = world.groundY;
    let landed = false;

    if (this.vy >= 0) {
      // 地面
      if (this.y >= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.onGround = true;
        this.platform = null;
        landed = true;
      } else {
        // 平台
        for (const pf of world.platforms) {
          const prevBottom = this.y - this.vy;
          if (this.x > pf.x - 4 && this.x < pf.x + pf.w + 4 &&
            prevBottom <= pf.y + 1 && this.y >= pf.y) {
            this.y = pf.y;
            this.vy = 0;
            this.onGround = true;
            this.platform = pf;
            landed = true;
            break;
          }
        }
      }
    }

    // 离开平台边缘
    if (this.onGround && this.platform && this.state !== STATE.KO) {
      const pf = this.platform;
      if (this.x < pf.x - 4 || this.x > pf.x + pf.w + 4) {
        this.onGround = false;
        this.platform = null;
      }
    }

    if (landed && this.state === STATE.FALL) {
      this.setState(STATE.IDLE);
    }
    if (!this.onGround && this.state === STATE.JUMP && this.vy > 0) {
      this.setState(STATE.FALL);
    }

    this.altitude = Math.max(0, groundY - this.y);
  }

  /** 承受伤害（考虑防御） */
  applyHit(attacker, atk, world) {
    const dir = Math.sign(this.x - attacker.x) || 1;
    const facingAttacker = this.facing === -dir;
    const guarding = this.canBlock() && facingAttacker;

    if (guarding) {
      // 防御：减伤 + 消耗防御值
      const dmg = atk.damage * atk.blockDamage;
      this.hp = Math.max(0, this.hp - dmg);
      this.guard -= atk.guardCost;
      this.guardCooldown = Math.round(RULES.guardRegenDelay * 60);
      this.vx = dir * (atk.knockback * 0.35);
      this.flash = 3;
      if (this.guard <= 0) {
        this.guard = 0;
        this.state = STATE.HURT;
        this.stateFrame = 0;
        this.hitstun = 30;
        this.vx = dir * 2.2;
      }
      return { blocked: true, damage: dmg, dir, guardBroken: this.guard <= 0 };
    }

    this.takeDamage(atk.damage, attacker.x, {
      knockback: atk.knockback,
      hitstun: atk.hitstun,
      lift: atk.key === 'heavy' ? 2.4 : 0.6,
    });
    attacker.energy = Math.min(RULES.maxEnergy, attacker.energy + atk.energyGain);
    return { blocked: false, damage: atk.damage, dir };
  }
}
