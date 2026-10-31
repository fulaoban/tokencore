// CPU 对手：基于距离与状态的简单行为树，带反应延迟与难度系数
export const AI_LEVELS = {
  easy: { react: 16, aggro: 0.45, blockChance: 0.18, jumpChance: 0.03, specialChance: 0.15, label: 'EASY' },
  normal: { react: 10, aggro: 0.65, blockChance: 0.4, jumpChance: 0.06, specialChance: 0.3, label: 'NORMAL' },
  hard: { react: 5, aggro: 0.85, blockChance: 0.68, jumpChance: 0.1, specialChance: 0.5, label: 'HARD' },
};

export class AIController {
  constructor(level = 'normal') {
    this.setLevel(level);
    this.cooldown = 0;
    this.think = 0;
    this.wantBlock = false;
    this.plan = 'approach';
    this.planTimer = 0;
  }

  setLevel(level) {
    this.level = level;
    this.cfg = AI_LEVELS[level] || AI_LEVELS.normal;
  }

  /**
   * 生成 AI 的虚拟输入
   * @returns {{left,right,jump,block,light,heavy,special}}
   */
  decide(self, opp, rnd) {
    const cfg = this.cfg;
    const input = { left: false, right: false, jump: false, block: false, light: false, heavy: false, special: false };

    if (!self.alive || !opp.alive) return input;

    if (this.cooldown > 0) this.cooldown--;
    if (this.planTimer > 0) this.planTimer--;

    this.think--;
    if (this.think <= 0) {
      this.think = cfg.react;
      this.replan(self, opp, rnd);
    }

    const dx = opp.x - self.x;
    const dist = Math.abs(dx);
    const dir = Math.sign(dx) || 1;

    switch (this.plan) {
      case 'approach': {
        if (dist > 26) {
          if (dir > 0) input.right = true; else input.left = true;
        }
        if (dist < 40 && rnd() < cfg.aggro) {
          this.plan = 'attack';
          this.planTimer = 20;
        }
        if (rnd() < cfg.jumpChance) input.jump = true;
        break;
      }
      case 'retreat': {
        if (dir > 0) input.left = true; else input.right = true;
        if (this.planTimer <= 0) { this.plan = 'approach'; this.planTimer = 30; }
        break;
      }
      case 'attack': {
        // 保持距离，出招
        if (dist > 30) {
          if (dir > 0) input.right = true; else input.left = true;
        } else if (dist < 18) {
          if (dir > 0) input.left = true; else input.right = true;
        }
        if (this.cooldown === 0 && dist < 36) {
          const roll = rnd();
          if (self.energy >= 50 && roll < cfg.specialChance && dist > 20) {
            input.special = true;
            this.cooldown = 70;
          } else if (roll < 0.34) {
            input.heavy = true;
            this.cooldown = 55;
          } else {
            input.light = true;
            this.cooldown = 26;
          }
          this.planTimer = 24;
        }
        if (this.planTimer <= 0) { this.plan = 'approach'; this.planTimer = 40; }
        break;
      }
      case 'guard': {
        input.block = true;
        if (this.planTimer <= 0) { this.plan = 'approach'; this.planTimer = 20; }
        break;
      }
      default:
        this.plan = 'approach';
    }

    // 防守判断：对手正在出招且距离较近
    if (self.guard > 25 && dist < 46) {
      const oppAttacking = opp.state === 'light' || opp.state === 'heavy' || opp.state === 'special';
      if (oppAttacking && rnd() < cfg.blockChance) {
        input.block = true;
        input.left = false;
        input.right = false;
        input.light = false;
        input.heavy = false;
      }
    }

    // 低血量时后撤
    if (self.hp < 25 && dist < 30 && rnd() < 0.02) {
      this.plan = 'retreat';
      this.planTimer = 30;
    }

    return input;
  }

  replan(self, opp, rnd) {
    const cfg = this.cfg;
    const dist = Math.abs(opp.x - self.x);
    const oppAttacking = opp.state === 'light' || opp.state === 'heavy' || opp.state === 'special';

    if (oppAttacking && dist < 50 && rnd() < cfg.blockChance) {
      this.plan = 'guard';
      this.planTimer = 8 + Math.floor(rnd() * 10);
      return;
    }
    if (dist > 110) {
      this.plan = 'approach';
      this.planTimer = 60;
      return;
    }
    const roll = rnd();
    if (roll < cfg.aggro) {
      this.plan = 'attack';
      this.planTimer = 30 + Math.floor(rnd() * 30);
    } else {
      this.plan = 'approach';
      this.planTimer = 30;
    }
  }
}
