// 对战场景：回合流程、相机、输入分发、结算
import { Fighter, STATE } from '../entities/fighter.js';
import { Projectile } from '../entities/projectile.js';
import { AIController } from '../systems/ai.js';
import { resolveCombat, resolveProjectiles } from '../systems/combat.js';
import { Particles } from '../render/particles.js';
import { drawMech } from '../render/mech.js';
import { initStage, drawStage, drawPlatforms } from '../render/stage.js';
import { drawHud, drawBanner, drawBigText, drawCombo, FloatingText } from '../render/hud.js';
import { drawText } from '../data/font.js';
import { PALETTES } from '../data/palette.js';
import { readPad, KEYMAP_P1, KEYMAP_P2 } from '../core/input.js';
import {
  VIEW_W, VIEW_H, WORLD_W, GROUND_Y, WALL, MAX_SEPARATION, ARENA_PLATFORMS, RULES, ATTACKS, SPAWN,
} from '../data/config.js';

const PHASE = {
  INTRO: 'intro',
  FIGHT: 'fight',
  KO: 'ko',
  ROUND_END: 'roundEnd',
  MATCH_END: 'matchEnd',
};

export class BattleScene {
  constructor({ audio, onMatchEnd }) {
    this.audio = audio;
    this.onMatchEnd = onMatchEnd;
    this.particles = new Particles();
    this.floating = new FloatingText();
    this.projectiles = [];
    this.camX = 0;
    this.shakeAmount = 0;
    this.hitstop = 0;
    this.timeScale = 1;
    this.world = { groundY: GROUND_Y, platforms: ARENA_PLATFORMS };

    this.p1 = new Fighter({
      id: 'p1', name: '赤焰', tag: 'CRIMSON',
      palette: PALETTES.crimson, build: 'heavy', x: 150, facing: 1,
    });
    this.p2 = new Fighter({
      id: 'p2', name: '苍岚', tag: 'AZURE',
      palette: PALETTES.azure, build: 'light', x: 260, facing: -1,
    });

    this.ai = new AIController('normal');
    this.mode = 'pvp';
    this.phase = PHASE.INTRO;
    this.phaseTimer = 0;
    this.round = 1;
    this.timeLeft = RULES.roundTime;
    this.banner = '';
    this.bannerSub = '';
    this.bannerAlpha = 1;
    this.bigText = '';
    this.bigTextColor = '#ff4d5e';
    this.slowMoFrames = 0;
    this.winner = null;
    this.startTime = 0;
    initStage();
  }

  start(mode, aiLevel) {
    this.mode = mode;
    this.ai.setLevel(aiLevel);
    this.p1.isAI = false;
    this.p2.isAI = mode === 'cpu';
    this.p1.reset(SPAWN.p1, 1);
    this.p2.reset(SPAWN.p2, -1);
    this.p1.wins = 0;
    this.p2.wins = 0;
    this.round = 1;
    this.phase = PHASE.INTRO;
    this.phaseTimer = 110;
    this.timeLeft = RULES.roundTime;
    this.banner = `ROUND ${this.round}`;
    this.bannerSub = mode === 'cpu' ? `CPU - ${this.ai.cfg.label}` : 'VERSUS';
    this.bannerAlpha = 1;
    this.bigText = '';
    this.winner = null;
    this.particles.clear();
    this.floating.clear();
    this.projectiles.length = 0;
    this.startTime = performance.now();

    // 特效桥接对象：让 combat 系统能够回写命中定格
    this.fx = {
      particles: this.particles,
      audio: this.audio,
      hitstop: 0,
      shake: (n) => this.shake(n),
    };
  }

  get phaseLabel() {
    return this.phase;
  }

  update(input) {
    // 命中定格（画面冻结若干帧，强化打击感）
    if (this.hitstop > 0) {
      this.hitstop--;
      this.updateCamera(1);
      return;
    }

    // KO 慢动作
    const scale = this.slowMoFrames > 0 ? RULES.koSlowMo : 1;
    if (this.slowMoFrames > 0) this.slowMoFrames--;

    const dt = scale;

    if (this.phase === PHASE.INTRO) {
      this.phaseTimer--;
      if (this.phaseTimer <= 0) {
        this.phase = PHASE.FIGHT;
        this.banner = 'FIGHT!';
        this.bannerSub = '';
        this.phaseTimer = 60;
        this.audio.roundStart();
      }
    } else if (this.phase === PHASE.FIGHT) {
      this.timeLeft -= dt / 60;
      if (this.phaseTimer > 0) this.phaseTimer--;
      if (this.banner && this.phaseTimer <= 0) this.banner = '';

      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.endRoundByTime();
      }
    }

    // 输入
    const pad1 = readPad(input, KEYMAP_P1);
    const pad2 = this.p2.isAI
      ? this.ai.decide(this.p2, this.p1, Math.random)
      : readPad(input, KEYMAP_P2);

    const frozen = this.phase !== PHASE.FIGHT;
    const p1Input = frozen ? EMPTY_INPUT : pad1;
    const p2Input = frozen ? EMPTY_INPUT : pad2;

    this.p1.update(p1Input, this.p2, this.world);
    this.p2.update(p2Input, this.p1, this.world);

    // 互相推挤
    this.separate();

    // 弹幕生成
    this.spawnProjectiles();

    // 战斗结算
    const events = resolveCombat(this.p1, this.p2, this.fx);
    events.push(...resolveProjectiles(this.projectiles, [this.p1, this.p2], this.fx));
    if (this.fx.hitstop > 0) {
      this.hitstop = Math.max(this.hitstop, this.fx.hitstop);
      this.fx.hitstop = 0;
    }

    for (const ev of events) {
      if (ev.type === 'hit') {
        const isP1 = ev.defender === this.p2;
        this.floating.add(ev.defender.x, ev.defender.y - 52,
          String(Math.round(ev.damage)), isP1 ? '#ffc247' : '#5ee6ff');
        if (ev.defender.hp <= 0) this.onKo(ev.defender);
      } else if (ev.type === 'block') {
        this.floating.add(ev.defender.x, ev.defender.y - 50, 'GUARD', '#a06fe0');
      }
    }

    // 弹幕推进
    for (const pr of this.projectiles) {
      pr.update({ left: WALL, right: WORLD_W - WALL });
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].dead) this.projectiles.splice(i, 1);
    }

    this.particles.update();
    this.floating.update();
    this.updateCamera(dt);

    if (this.shakeAmount > 0) this.shakeAmount *= 0.86;
    if (this.bannerAlpha < 1 && this.phase !== PHASE.INTRO) {
      this.bannerAlpha = Math.max(0, this.bannerAlpha - 0.02);
    }
  }

  /** 生成弹幕：必杀技判定起始帧释放能量弹 */
  spawnProjectiles() {
    for (const f of [this.p1, this.p2]) {
      if (!f.fireProjectile) continue;
      f.fireProjectile = false;
      const atk = f.attack;
      if (!atk || !atk.projectile) continue;
      const speed = atk.projectileSpeed ?? 5;
      const size = atk.projectileSize ?? 9;
      this.projectiles.push(new Projectile({
        x: f.x + f.facing * 18,
        y: f.y - 28,
        dir: f.facing,
        owner: f,
        palette: f.palette,
        damage: atk.damage,
        knockback: atk.knockback,
        hitstun: atk.hitstun,
        speed,
        size,
      }));
      this.audio.special();
      this.particles.shockwave(f.x + f.facing * 16, f.y - 28, f.palette.beam, 16);
    }
  }

  /** 两个机甲之间的推挤：过近时互相推开，过远时拉回，保证始终同框 */
  separate() {
    const minDist = 26;
    const dx = this.p2.x - this.p1.x;
    const ad = Math.abs(dx);
    const dir = Math.sign(dx) || 1;

    if (ad < minDist && ad > 0.01) {
      const push = (minDist - ad) / 2;
      this.p1.x -= dir * push;
      this.p2.x += dir * push;
    } else if (ad > MAX_SEPARATION) {
      const pull = (ad - MAX_SEPARATION) / 2;
      this.p1.x += dir * pull;
      this.p2.x -= dir * pull;
    }

    this.p1.x = Math.max(WALL, Math.min(WORLD_W - WALL, this.p1.x));
    this.p2.x = Math.max(WALL, Math.min(WORLD_W - WALL, this.p2.x));
  }

  onKo(loser) {
    if (this.phase !== PHASE.FIGHT) return;
    this.phase = PHASE.KO;
    this.slowMoFrames = 70;
    this.shake(6);
    this.audio.ko();
    this.particles.shockwave(loser.x, loser.y - 18, loser.palette.beam, 26);
    this.particles.debris(loser.x, loser.y - 18, loser.palette.armorMid, 14);
    this.particles.dust(loser.x, loser.y, '#6b5a8f');
    const winner = loser === this.p1 ? this.p2 : this.p1;
    this.winner = winner;
    this.bigText = 'K.O.';
    this.bigTextColor = '#ff4d5e';
    this.phaseTimer = 130;
  }

  endRoundByTime() {
    this.phase = PHASE.KO;
    this.bigText = 'TIME UP';
    this.bigTextColor = '#ffc247';
    this.phaseTimer = 120;
    if (this.p1.hp > this.p2.hp) this.winner = this.p1;
    else if (this.p2.hp > this.p1.hp) this.winner = this.p2;
    else this.winner = null;
  }

  updateCamera(dt) {
    const mid = (this.p1.x + this.p2.x) / 2;
    const targetCam = mid - VIEW_W / 2;
    this.camX += (targetCam - this.camX) * 0.12;
    this.camX = Math.max(0, Math.min(WORLD_W - VIEW_W, this.camX));
  }

  shake(n) {
    this.shakeAmount = Math.max(this.shakeAmount, n);
  }

  render(ctx) {
    const shakeX = this.shakeAmount > 0.2 ? (Math.random() - 0.5) * this.shakeAmount * 2 : 0;
    const shakeY = this.shakeAmount > 0.2 ? (Math.random() - 0.5) * this.shakeAmount * 2 : 0;

    const camX = Math.round(this.camX - shakeX);

    drawStage(ctx, camX, 0);
    drawPlatforms(ctx, ARENA_PLATFORMS, camX);

    // 角色（后面的先画）
    const order = this.p1.z < this.p2.z ? [this.p1, this.p2] : [this.p2, this.p1];
    for (const f of order) {
      ctx.save();
      ctx.translate(-camX, 0);
      drawMech(ctx, f, f.palette);
      ctx.restore();
    }

    // 弹幕
    ctx.save();
    ctx.translate(-camX, 0);
    for (const pr of this.projectiles) pr.draw(ctx);
    ctx.restore();

    this.particles.draw(ctx);
    this.floating.draw(ctx, camX);

    // 连击提示
    for (const f of [this.p1, this.p2]) {
      ctx.save();
      ctx.translate(-camX, 0);
      drawCombo(ctx, f, 0);
      ctx.restore();
    }

    drawHud(ctx, this.p1, this.p2, this.timeLeft);

    if (this.banner && this.bannerAlpha > 0) {
      drawBanner(ctx, this.banner, this.bannerSub, this.bannerAlpha);
    }
    if (this.bigText) {
      drawBigText(ctx, this.bigText, this.bigTextColor);
    }

    // 阶段进度提示
    if (this.phase === PHASE.KO && this.phaseTimer < 90 && this.winner) {
      drawText(ctx, `${this.winner.tag} WINS`, 160, 100, {
        color: this.winner.palette.armorLight, scale: 1, align: 'center', shadow: '#000000',
      });
    }
  }

  /** 标题界面的待机演出：两台机甲原地待机 */
  attractUpdate() {
    this.attractTimer = (this.attractTimer || 0) + 1;
    this.p1.state = STATE.IDLE;
    this.p2.state = STATE.IDLE;
    this.p1.stateFrame = this.attractTimer;
    this.p2.stateFrame = this.attractTimer;
    this.p1.x = SPAWN.p1;
    this.p2.x = SPAWN.p2;
    this.p1.y = GROUND_Y;
    this.p2.y = GROUND_Y;
    this.p1.facing = 1;
    this.p2.facing = -1;
    this.p1.vx = 0;
    this.p2.vx = 0;
    // 相机跟随两者中点，保证两台机甲都在画面内
    this.camX = (SPAWN.p1 + SPAWN.p2) / 2 - VIEW_W / 2;
    this.particles.update();
  }

  /** 回合结束后的处理，由 main 调用 */
  tickRoundEnd() {
    if (this.phase === PHASE.KO) {
      this.phaseTimer--;
      if (this.phaseTimer <= 0) {
        if (this.winner) this.winner.wins++;
        if (this.winner && this.winner.wins >= RULES.roundsToWin) {
          this.phase = PHASE.MATCH_END;
          this.onMatchEnd({
            winner: this.winner,
            p1: this.p1,
            p2: this.p2,
            mode: this.mode,
          });
        } else {
          this.round++;
          this.phase = PHASE.INTRO;
          this.phaseTimer = 110;
          this.timeLeft = RULES.roundTime;
          this.banner = `ROUND ${this.round}`;
          this.bannerSub = '';
          this.bigText = '';
          this.resetRoundPositions();
        }
      }
    }
  }

  resetRoundPositions() {
    this.p1.reset(SPAWN.p1, 1, true);
    this.p2.reset(SPAWN.p2, -1, true);
    this.particles.clear();
    this.floating.clear();
    this.projectiles.length = 0;
  }
}

const EMPTY_INPUT = {
  left: false, right: false, jump: false, jumpHeld: false,
  block: false, light: false, heavy: false, special: false,
};
