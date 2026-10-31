// 全局配置：视口、世界尺寸、物理与战斗数值
export const VIEW_W = 320;
export const VIEW_H = 180;

export const WORLD_W = 640;
export const GROUND_Y = 150;
export const WALL = 26;
/** 双方最大间距：超过则互相拉回，保证两台机甲始终同框 */
export const MAX_SEPARATION = 210;

export const PHYSICS = {
  gravity: 0.42,
  jumpVelocity: -7.4,
  walkSpeed: 1.35,
  airControl: 0.62,
  friction: 0.78,
  maxFall: 8,
};

export const RULES = {
  maxHp: 100,
  maxEnergy: 100,
  maxGuard: 100,
  startEnergy: 60,
  energyRegen: 1.6,       // 每秒回能
  guardRegen: 9,         // 每秒回盾
  guardRegenDelay: 0.9,  // 受击后延迟再生
  roundTime: 60,         // 每回合秒数
  roundsToWin: 2,        // 三局两胜
  koSlowMo: 0.28,        // KO 慢动作倍率
};

/**
 * 招式表。startup 起手 / active 判定 / recovery 收招（单位：帧，60FPS）
 */
export const ATTACKS = {
  light: {
    key: 'light',
    startup: 5, active: 4, recovery: 10,
    damage: 6, knockback: 1.7, hitstun: 12, hitstop: 5,
    reach: 26, yTop: -40, yBottom: -22,
    energyGain: 8, cost: 0,
    blockDamage: 0.12, guardCost: 12,
    sfx: 'hitLight', anim: 'light',
  },
  heavy: {
    key: 'heavy',
    startup: 13, active: 6, recovery: 22,
    damage: 15, knockback: 4.4, hitstun: 22, hitstop: 9,
    reach: 36, yTop: -42, yBottom: -16,
    energyGain: 14, cost: 0,
    blockDamage: 0.3, guardCost: 34,
    sfx: 'hitHeavy', anim: 'heavy',
  },
  special: {
    key: 'special',
    startup: 26, active: 6, recovery: 26,
    damage: 22, knockback: 4.0, hitstun: 26, hitstop: 8,
    reach: 0, yTop: -34, yBottom: -22,
    energyGain: 0, cost: 50,
    blockDamage: 0.45, guardCost: 46,
    sfx: 'special', anim: 'special', projectile: true,
    projectileSpeed: 5.2, projectileSize: 9,
  },
};

/** 可站立平台（避开出生点区域，保证开局双方位于同一地面高度） */
export const ARENA_PLATFORMS = [
  { x: 58, y: 116, w: 56 },
  { x: 330, y: 100, w: 64 },
  { x: 418, y: 120, w: 54 },
  { x: 524, y: 104, w: 58 },
];

/** 回合出生点 */
export const SPAWN = { p1: 140, p2: 250 };

export const STAGE_FLOOR = GROUND_Y;
