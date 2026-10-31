// 诊断：必杀弹幕为何没有命中
const { Canvas } = await import('/root/.nvm/versions/node/v24.1.0/lib/node_modules/skia-canvas/lib/index.mjs');

globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') return { style: {}, appendChild() {} };
    const c = new Canvas(1, 1);
    c.getContext('2d');
    return c;
  },
  getElementById() { return null; },
  addEventListener() {},
};
globalThis.window = { addEventListener() {}, AudioContext: undefined, performance };
globalThis.performance = globalThis.performance ?? { now: () => Date.now() };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

const { BattleScene } = await import('../src/scenes/battle.js');

const audio = { ui() {}, hitLight() {}, hitHeavy() {}, block() {}, jump() {}, land() {}, special() {}, ko() {}, roundStart() {} };
const battle = new BattleScene({ audio, onMatchEnd: () => {} });
const held = new Set();
const pressed = new Set();
const fakeInput = {
  isDown: (c) => held.has(c),
  wasPressed: (c) => pressed.has(c),
  anyPressed: (cs) => cs.some((c) => pressed.has(c)),
  endFrame: () => pressed.clear(),
};

battle.start('cpu', 'normal');
for (let i = 0; i < 130; i++) battle.update(fakeInput);

battle.p1.x = 120;
battle.p2.x = 240;
battle.p1.facing = 1;
battle.p2.facing = -1;
battle.p1.energy = 100;
console.log('startAttack ->', battle.p1.startAttack('special'), 'state=', battle.p1.state);

for (let i = 0; i < 90; i++) {
  battle.update(fakeInput);
  if (battle.projectiles.length > 0) {
    const pr = battle.projectiles[0];
    console.log(`frame ${i}: 弹幕 x=${pr.x.toFixed(1)} p2.x=${battle.p2.x.toFixed(1)} p2.state=${battle.p2.state} p2.hp=${battle.p2.hp.toFixed(1)}`);
  }
  if (i % 10 === 0) {
    console.log(`  [${i}] p1=(${battle.p1.x.toFixed(0)},${battle.p1.state}) p2=(${battle.p2.x.toFixed(0)},${battle.p2.state}) hp=${battle.p2.hp.toFixed(1)} 弹幕数=${battle.projectiles.length}`);
  }
}
console.log(`最终 p2.hp=${battle.p2.hp} 弹幕数=${battle.projectiles.length}`);
