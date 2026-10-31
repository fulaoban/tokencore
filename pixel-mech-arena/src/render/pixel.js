// 像素绘制工具集：所有绘制都对齐到整数像素，保证复古硬边质感

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** 粗线段（用于机甲的四肢），沿路径绘制方块 */
export function thickLine(ctx, x0, y0, x1, y1, thickness, color) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const t = Math.max(1, Math.round(thickness));
  const half = (t - 1) / 2;
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const px = x0 + (dx * i) / steps;
    const py = y0 + (dy * i) / steps;
    ctx.fillRect(Math.round(px - half), Math.round(py - half), t, t);
  }
}

/** 镜像绘制一张离屏画布（水平翻转） */
export function drawFlipped(ctx, img, x, y, flip = false, scale = 1) {
  const w = img.width * scale;
  const h = img.height * scale;
  if (!flip) {
    ctx.drawImage(img, Math.round(x), Math.round(y), w, h);
  } else {
    ctx.save();
    ctx.translate(Math.round(x + w), Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
  }
}

/** 创建离屏画布 */
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

/**
 * 由字符画生成像素画布。
 * rows: 字符串数组，字符到颜色由 map 定义；'.' 与 ' ' 为透明。
 */
export function spriteFromChars(rows, map, scale = 1) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const { canvas, ctx } = makeCanvas(w * scale, h * scale);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = map[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return canvas;
}

/** 生成纯白剪影（受击闪白用） */
export function silhouette(src, color = '#ffffff') {
  const { canvas, ctx } = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}
