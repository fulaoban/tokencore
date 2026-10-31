// 5x7 点阵字体：每个字形 7 行，每行 5 bit（用十进制表示）
const G = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [31, 4, 4, 4, 4, 4, 31],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14],
  1: [4, 12, 4, 4, 4, 4, 14],
  2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14],
  4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14],
  7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  ':': [0, 4, 4, 0, 4, 4, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4],
  '-': [0, 0, 0, 31, 0, 0, 0],
  '_': [0, 0, 0, 0, 0, 0, 31],
  '/': [1, 2, 2, 4, 8, 8, 16],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '=': [0, 0, 31, 0, 31, 0, 0],
  '*': [0, 10, 4, 31, 4, 10, 0],
  '%': [25, 26, 4, 8, 22, 11, 16],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '<': [2, 4, 8, 16, 8, 4, 2],
  '>': [8, 4, 2, 1, 2, 4, 8],
  '#': [10, 31, 10, 10, 31, 10, 0],
};

const GLYPH_W = 5;
const GLYPH_H = 7;

export function textWidth(text, scale = 1, tracking = 1) {
  if (!text.length) return 0;
  return (text.length * (GLYPH_W + tracking) - tracking) * scale;
}

/**
 * 绘制像素文字。
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x 左上角
 * @param {number} y
 * @param {object} opts color / scale / align / shadow / tracking
 */
export function drawText(ctx, text, x, y, opts = {}) {
  const {
    color = '#ffffff',
    scale = 1,
    tracking = 1,
    align = 'left',
    shadow = null,
    shadowOffset = 1,
  } = opts;

  const str = String(text).toUpperCase();
  const w = textWidth(str, scale, tracking);
  let originX = Math.round(x);
  if (align === 'center') originX = Math.round(x - w / 2);
  else if (align === 'right') originX = Math.round(x - w);
  const originY = Math.round(y);

  const paint = (px, py, col) => {
    ctx.fillStyle = col;
    let cursor = px;
    for (let i = 0; i < str.length; i++) {
      const glyph = G[str[i]] ?? G['?'];
      for (let row = 0; row < GLYPH_H; row++) {
        const bits = glyph[row];
        for (let col = 0; col < GLYPH_W; col++) {
          if (bits & (1 << (GLYPH_W - 1 - col))) {
            ctx.fillRect(cursor + col * scale, py + row * scale, scale, scale);
          }
        }
      }
      cursor += (GLYPH_W + tracking) * scale;
    }
  };

  if (shadow) paint(originX + shadowOffset * scale, originY + shadowOffset * scale, shadow);
  paint(originX, originY, color);
  return w;
}
