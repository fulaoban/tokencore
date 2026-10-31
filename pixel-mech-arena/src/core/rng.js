// 确定性随机数（mulberry32）——用于程序化生成背景，保证每次刷新画面一致
export function createRng(seed = 1337) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randRange = (rng, min, max) => min + rng() * (max - min);
export const randInt = (rng, min, max) => Math.floor(randRange(rng, min, max + 1));
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
