// 无头渲染自测：用 skia-canvas 在 Node 中跑真实游戏代码，导出 PNG 帧
// 用途：CI / 无浏览器环境下验证渲染管线与游戏逻辑
import { Canvas } from '/root/.nvm/versions/node/v24.1.0/lib/node_modules/skia-canvas/lib/index.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// ---- 浏览器 API 垫片 ----
globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') return { style: {}, appendChild() {} };
    const c = new Canvas(1, 1);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return c;
  },
  getElementById() { return null; },
  addEventListener() {},
};
globalThis.window = {
  addEventListener() {},
  AudioContext: undefined,
  performance,
};
globalThis.performance = globalThis.performance ?? { now: () => Date.now() };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

const { BattleScene } = await import('../src/scenes/battle.js');
const { VIEW_W, VIEW_H, ATTACKS } = await import('../src/data/config.js');
const { STATE } = await import('../src/entities/fighter.js');

const OUT = new URL('../.artifacts/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const canvas = new Canvas(VIEW_W, VIEW_H);
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const sfx = [];
const audio = {
  ui() {}, hitLight() {}, hitHeavy() {}, block() {}, jump() {}, land() {},
  special() { sfx.push('special'); }, ko() {}, roundStart() {},
};

const battle = new BattleScene({ audio, onMatchEnd: (r) => console.log('  match end, winner:', r.winner?.tag) });

const shots = [];
async function shot(name) {
  battle.render(ctx);
  const file = join(OUT, `${name}.png`);
  await writeFile(file, await canvas.toBuffer('image/png'));
  shots.push(file);
  return file;
}

// 假输入：实现 Input 接口的子集
const held = new Set();
const pressed = new Set();
const fakeInput = {
  isDown: (code) => held.has(code),
  wasPressed: (code) => pressed.has(code),
  anyPressed: (codes) => codes.some((c) => pressed.has(c)),
  endFrame: () => pressed.clear(),
};

console.log('▶ 渲染自测');

// 1. 待机画面
battle.attractUpdate();
for (let i = 0; i < 30; i++) battle.attractUpdate();
console.log('  ✓ idle:', await shot('01-idle'));

// 2. 开局
battle.start('cpu', 'normal');
for (let i = 0; i < 120; i++) battle.update(fakeInput);
console.log('  ✓ round-start:', await shot('02-round1'));

// 3. 轻击动作
battle.p1.state = STATE.LIGHT;
battle.p1.attack = ATTACKS.light;
battle.p1.attackT = 7;
battle.p1.stateFrame = 7;
console.log('  ✓ light-attack:', await shot('03-light'));

// 4. 重击动作
battle.p1.state = STATE.HEAVY;
battle.p1.attack = ATTACKS.heavy;
battle.p1.attackT = 16;
battle.p1.stateFrame = 16;
console.log('  ✓ heavy-attack:', await shot('04-heavy'));

// 5. 防御姿态
battle.p1.state = STATE.BLOCK;
battle.p1.stateFrame = 4;
battle.p1.facing = 1;
console.log('  ✓ block:', await shot('05-block'));

// 6. 必杀蓄力
battle.p1.state = STATE.SPECIAL;
battle.p1.attack = ATTACKS.special;
battle.p1.attackT = 24;
battle.p1.stateFrame = 24;
console.log('  ✓ special-charge:', await shot('06-special'));

// 7. 击倒姿态
battle.p1.state = STATE.KO;
battle.p1.stateFrame = 30;
battle.p1.vy = 0;
battle.p1.y = 150;
console.log('  ✓ ko:', await shot('07-ko'));

// 8. 跳跃
battle.p1.state = STATE.JUMP;
battle.p1.y = 120;
battle.p1.stateFrame = 5;
battle.p1.attack = null;
console.log('  ✓ jump:', await shot('08-jump'));

// 9. 弹幕飞行：赤焰发射能量弹，苍岚起跳闪避
battle.start('cpu', 'normal');
for (let i = 0; i < 130; i++) battle.update(fakeInput);
battle.banner = '';
battle.phaseTimer = 0;
battle.p2.isAI = false;
battle.p1.x = 110; battle.p1.y = 150; battle.p1.vy = 0; battle.p1.vx = 0; battle.p1.onGround = true;
battle.p2.x = 205; battle.p2.y = 150; battle.p2.vy = 0; battle.p2.vx = 0; battle.p2.onGround = true;
battle.p1.facing = 1;
battle.p2.facing = -1;
battle.p1.energy = 100;
battle.p1.startAttack('special');
for (let i = 0; i < 30; i++) battle.update(fakeInput);
// 让苍岚腾空躲过弹道
battle.p2.y = 108;
battle.p2.vy = 0;
battle.p2.setState(STATE.JUMP);
battle.p2.stateFrame = 4;
console.log('  ✓ projectile:', await shot('09-projectile'),
  `弹幕数=${battle.projectiles.length}`);

// 10. 战斗运行，检查 AI、伤害与弹幕命中
battle.start('cpu', 'normal');
for (let i = 0; i < 130; i++) battle.update(fakeInput);
let hpLow = false, moved = false;
const startP2 = battle.p2.x;
for (let i = 0; i < 900; i++) {
  battle.update(fakeInput);
  battle.tickRoundEnd();
  if (battle.p1.hp < 100 || battle.p2.hp < 100) hpLow = true;
  if (Math.abs(battle.p2.x - startP2) > 20) moved = true;
}
console.log(`    P1 hp=${Math.round(battle.p1.hp)} P2 hp=${Math.round(battle.p2.hp)} 造成伤害=${hpLow} 位置变化=${moved}`);
console.log(`    phase=${battle.phase} round=${battle.round} p1wins=${battle.p1.wins} p2wins=${battle.p2.wins}`);

// 10b. 构造确定性的交战瞬间作为展示图：赤焰重击格挡中的苍岚
battle.start('cpu', 'normal');
for (let i = 0; i < 130; i++) battle.update(fakeInput);
battle.banner = '';
battle.phaseTimer = 0;
battle.p2.isAI = false;
held.add('ArrowDown'); // P2 持续按住防御

battle.p1.x = 150;
battle.p2.x = 182;
battle.p1.y = 150; battle.p1.vy = 0; battle.p1.vx = 0; battle.p1.onGround = true;
battle.p2.y = 150; battle.p2.vy = 0; battle.p2.vx = 0; battle.p2.onGround = true;
battle.p1.facing = 1;
battle.p2.facing = -1;
battle.p1.hp = 68;
battle.p2.hp = 44;
battle.p1.energy = 72;
battle.p2.energy = 30;
battle.p2.guard = 62;
battle.p1.startAttack('heavy');
// 推进到判定生效的那一帧
for (let i = 0; i < 14; i++) battle.update(fakeInput);
held.delete('ArrowDown');
// 闪白会盖住角色，展示图里还原为护盾火花
battle.p2.flash = 0;
battle.p2.setState(STATE.BLOCK);
battle.p2.blocking = true;
battle.p2.y = 150;
battle.particles.guardSparks(184, 118, 1);
battle.particles.hitSparks(176, 124, 1, '#ffd166', 12);
battle.floating.add(186, 98, 'GUARD', '#a06fe0');
battle.floating.add(150, 92, 'HEAVY', '#ffc247');
console.log('  ✓ battle-action:', await shot('10-battle'));

// 11. 必杀实测：确定性验证弹幕的发射、命中与跳跃闪避
//     关闭 P2 的 AI 控制并锁定其位置，保证用例可重复
function setupSpecial(targetY = null) {
  battle.start('cpu', 'normal');
  for (let i = 0; i < 130; i++) battle.update(fakeInput);
  battle.banner = '';
  battle.phaseTimer = 0;
  battle.p2.isAI = false;
  battle.p1.x = 120;
  battle.p2.x = 240;
  battle.p1.facing = 1;
  battle.p2.facing = -1;
  battle.p1.energy = 100;
  battle.p1.startAttack('special');
  return () => {
    battle.p2.isAI = true;
    if (targetY !== null) battle.p2.y = targetY;
  };
}

// 11a. 站立对手应当被命中
let restore = setupSpecial();
const hpBefore = battle.p2.hp;
let projFired = false;
for (let i = 0; i < 90; i++) {
  battle.update(fakeInput);
  if (battle.projectiles.length > 0) projFired = true;
}
const hpAfter = battle.p2.hp;
restore();
console.log(`    必杀发射=${projFired} 对手血量 ${Math.round(hpBefore)} → ${Math.round(hpAfter)} 命中=${hpAfter < hpBefore}`);

// 11b. 起跳到弹道高度以上的对手应当躲过弹幕
restore = setupSpecial();
battle.p2.y = 96;
const hpBeforeDodge = battle.p2.hp;
for (let i = 0; i < 90; i++) {
  battle.update(fakeInput);
  battle.p2.y = 96; // 持续定高，模拟跳跃闪避
  battle.p2.vy = 0;
}
const hpAfterDodge = battle.p2.hp;
restore();
console.log(`    跳跃闪避=${hpAfterDodge === hpBeforeDodge} 血量 ${Math.round(hpBeforeDodge)} → ${Math.round(hpAfterDodge)}`);

console.log('\n生成图片：');
for (const s of shots) console.log('  ' + s);
