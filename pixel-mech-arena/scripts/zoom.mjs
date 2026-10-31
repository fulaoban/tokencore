// 把 .artifacts 下的帧放大 3 倍（最近邻），便于肉眼审查像素细节
import { Canvas, loadImage } from '/root/.nvm/versions/node/v24.1.0/lib/node_modules/skia-canvas/lib/index.mjs';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = new URL('../.artifacts/', import.meta.url).pathname;
const files = (await readdir(OUT)).filter((f) => /^\d\d-.*\.png$/.test(f));

for (const f of files) {
  const img = await loadImage(join(OUT, f));
  const S = 3;
  const c = new Canvas(img.width * S, img.height * S);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, img.width * S, img.height * S);
  await writeFile(join(OUT, `big-${f}`), await c.toBuffer('image/png'));
  console.log('  big-' + f);
}
