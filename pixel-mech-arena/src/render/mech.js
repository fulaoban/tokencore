// 机甲渲染：骨骼驱动 + 像素精确绘制（阶梯线段构成斜向肢体，保持复古硬边）
// 机体比例约 50px 高（占 320x180 视口高度约 1/3.6），接近街机格斗角色的视觉体量
import { rect } from './pixel.js';

export const WHITE_PAL = {
  outline: '#ffffff', armorDark: '#ffffff', armorMid: '#ffffff', armorLight: '#ffffff',
  accent: '#ffffff', glow: '#ffffff', metal: '#ffffff', metalLight: '#ffffff',
  visor: '#ffffff', beam: '#ffffff', core: '#ffffff',
};

/** 阶梯式像素线段（像素艺术中斜线的标准画法） */
export function limb(ctx, x0, y0, x1, y1, w, color) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const px = Math.round(x0 + (dx * i) / steps);
    const py = Math.round(y0 + (dy * i) / steps);
    ctx.fillRect(px - (w >> 1), py - (w >> 1), w, w);
  }
}

export function trapezoid(ctx, cx, yTop, yBot, halfTop, halfBot, color) {
  ctx.fillStyle = color;
  const h = Math.round(yBot - yTop);
  for (let i = 0; i < h; i++) {
    const t = h <= 1 ? 0 : i / (h - 1);
    const half = Math.round(halfTop + (halfBot - halfTop) * t);
    ctx.fillRect(Math.round(cx - half), Math.round(yTop + i), half * 2, 1);
  }
}

/** 计算机甲当前姿态 */
export function computePose(f) {
  const heavy = f.build === 'heavy';
  const p = {
    lean: 0,
    crouch: 0,
    headTilt: 0,
    // 前臂/后臂角度（0 = 垂直向下，正 = 向前，负 = 向后）
    armFront: 0.25, armBack: -0.2,
    elbowFront: 0.35, elbowBack: 0.25,
    // 腿角度（0 = 垂直向下，正 = 向前）
    legFront: 0, legBack: 0,
    kneeFront: 0, kneeBack: 0,
    weaponRecoil: 0,
    glowCharge: 0,
    lying: false,
  };

  switch (f.state) {
    case 'walk': {
      const ph = (f.stateFrame % 32) / 32;
      const s = Math.sin(ph * Math.PI * 2);
      const c = Math.cos(ph * Math.PI * 2);
      p.legFront = s * 0.55;
      p.legBack = -s * 0.55;
      p.kneeFront = Math.max(0, -c) * 0.7 + 0.12;
      p.kneeBack = Math.max(0, c) * 0.7 + 0.12;
      p.armFront = 0.25 - s * 0.4;
      p.armBack = -0.2 + s * 0.4;
      p.elbowFront = 0.5;
      p.elbowBack = 0.4;
      p.crouch = Math.abs(s) * 1.4;
      break;
    }
    case 'jump':
      p.legFront = 0.5; p.legBack = -0.3;
      p.kneeFront = 0.9; p.kneeBack = 0.5;
      p.armFront = -0.5; p.armBack = -0.7;
      p.elbowFront = 0.7; p.elbowBack = 0.6;
      p.crouch = 1.5;
      break;
    case 'fall':
      p.legFront = 0.15; p.legBack = -0.5;
      p.kneeFront = 0.4; p.kneeBack = 0.8;
      p.armFront = -0.9; p.armBack = -1.0;
      p.elbowFront = 0.5; p.elbowBack = 0.5;
      break;
    case 'light': {
      const t = f.attackT;
      const total = f.attack.startup + f.attack.active + f.attack.recovery;
      if (t < f.attack.startup) {
        const k = t / f.attack.startup;
        p.armFront = 0.25 - k * 1.9;      // 蓄力后摆
        p.elbowFront = 0.9;
        p.armBack = -0.4 + k * 0.5;
        p.lean = -k * 2;
      } else if (t < f.attack.startup + f.attack.active) {
        const k = (t - f.attack.startup) / f.attack.active;
        p.armFront = -1.65 + k * 2.9;     // 快速前挥
        p.elbowFront = 0.25;
        p.lean = -2 + k * 5;
      } else {
        const k = (t - f.attack.startup - f.attack.active) / f.attack.recovery;
        p.armFront = 1.25 - k * 1.0;
        p.elbowFront = 0.6;
        p.lean = 3 - k * 3;
      }
      p.legFront = 0.25; p.legBack = -0.2;
      p.kneeFront = 0.3; p.kneeBack = 0.25;
      break;
    }
    case 'heavy': {
      const t = f.attackT;
      if (t < f.attack.startup) {
        const k = t / f.attack.startup;
        p.armFront = 0.3 - k * 2.3;       // 大幅后拉
        p.elbowFront = 1.0;
        p.armBack = -0.2 - k * 0.6;
        p.lean = -k * 4;
        p.crouch = k * 3;
      } else if (t < f.attack.startup + f.attack.active) {
        const k = (t - f.attack.startup) / f.attack.active;
        p.armFront = -2.0 + k * 3.2;
        p.elbowFront = 0.2;
        p.lean = -4 + k * 9;
        p.crouch = 3 - k * 3;
        p.weaponRecoil = heavy ? k : 0;
      } else {
        const k = (t - f.attack.startup - f.attack.active) / f.attack.recovery;
        p.armFront = 1.2 - k * 0.95;
        p.elbowFront = 0.7;
        p.lean = 5 - k * 5;
        p.crouch = k * 1.5;
      }
      p.legFront = 0.35; p.legBack = -0.3;
      p.kneeFront = 0.35; p.kneeBack = 0.3;
      break;
    }
    case 'special': {
      const t = f.attackT;
      if (t < f.attack.startup) {
        const k = t / f.attack.startup;
        p.armFront = 0.3 + k * 0.4;
        p.armBack = -0.2 - k * 0.4;
        p.elbowFront = 0.9 - k * 0.5;
        p.elbowBack = 0.9 - k * 0.5;
        p.crouch = k * 3;
        p.glowCharge = k;
      } else if (t < f.attack.startup + f.attack.active) {
        p.armFront = 0.75; p.armBack = -0.75;
        p.elbowFront = 0.1; p.elbowBack = 0.1;
        p.lean = -2;
        p.glowCharge = 1;
      } else {
        const k = (t - f.attack.startup - f.attack.active) / f.attack.recovery;
        p.armFront = 0.75 - k * 0.5;
        p.armBack = -0.75 + k * 0.5;
        p.elbowFront = 0.3 + k * 0.5;
        p.elbowBack = 0.3 + k * 0.5;
        p.glowCharge = 1 - k;
      }
      p.legFront = 0.2; p.legBack = -0.2;
      p.kneeFront = 0.3; p.kneeBack = 0.3;
      break;
    }
    case 'block':
      p.armFront = -2.5; p.armBack = -2.2;
      p.elbowFront = 0.55; p.elbowBack = 0.75;
      p.crouch = 3;
      p.lean = -1;
      p.legFront = 0.3; p.legBack = -0.35;
      p.kneeFront = 0.5; p.kneeBack = 0.5;
      break;
    case 'hurt':
      p.armFront = -1.1; p.armBack = -1.4;
      p.elbowFront = 0.4; p.elbowBack = 0.3;
      p.lean = -3;
      p.legFront = -0.3; p.legBack = 0.35;
      p.kneeFront = 0.5; p.kneeBack = 0.4;
      break;
    case 'ko':
      p.lying = true;
      p.armFront = -0.4; p.armBack = 0.6;
      p.elbowFront = 0.2; p.elbowBack = 0.2;
      p.legFront = -0.25; p.legBack = -0.1;
      p.kneeFront = 0.3; p.kneeBack = 0.2;
      break;
    case 'win':
      p.armFront = -2.9; p.armBack = -2.6;
      p.elbowFront = 0.3; p.elbowBack = 0.4;
      p.legFront = 0.15; p.legBack = -0.15;
      p.kneeFront = 0.15; p.kneeBack = 0.15;
      break;
    default: {
      const b = Math.floor(f.stateFrame / 22) % 2;
      p.crouch = b * 1.5;
      p.armFront = 0.25 + b * 0.05;
      p.armBack = -0.2 - b * 0.05;
      p.elbowFront = 0.4; p.elbowBack = 0.35;
      p.legFront = 0.06; p.legBack = -0.06;
      p.kneeFront = 0.12; p.kneeBack = 0.12;
    }
  }
  return p;
}

/** 计算关节位置（脚底为原点，向上为负 y） */
function skeleton(f, p) {
  const heavy = f.build === 'heavy';
  const hipY = -21 + p.crouch;
  const chestY = -33 + p.crouch;
  const headY = -42 + p.crouch;
  const shoulderY = -35 + p.crouch;
  const lean = p.lean;

  const pelvis = { x: 0, y: hipY };
  const chest = { x: lean * 0.5, y: chestY };
  const head = { x: lean * 0.8, y: headY };
  const shoulderF = { x: lean * 0.5 + (heavy ? 6 : 5), y: shoulderY };
  const shoulderB = { x: lean * 0.5 - (heavy ? 6 : 5), y: shoulderY };
  const hipF = { x: 4, y: hipY };
  const hipB = { x: -4, y: hipY };

  const upperArm = heavy ? 9 : 8;
  const foreArm = heavy ? 9 : 8;
  const thigh = 10;
  const shin = 10;

  const armEnd = (sh, ang, elb) => {
    const ex = sh.x + Math.sin(ang) * upperArm;
    const ey = sh.y + Math.cos(ang) * upperArm;
    const hx = ex + Math.sin(ang + elb) * foreArm;
    const hy = ey + Math.cos(ang + elb) * foreArm;
    return { elbow: { x: ex, y: ey }, hand: { x: hx, y: hy } };
  };

  const legEnd = (hp, ang, knee) => {
    const kx = hp.x + Math.sin(ang) * thigh;
    const ky = hp.y + Math.cos(ang) * thigh;
    const fx = kx + Math.sin(ang + knee) * shin;
    const fy = ky + Math.cos(ang + knee) * shin;
    return { knee: { x: kx, y: ky }, foot: { x: fx, y: fy } };
  };

  return {
    pelvis, chest, head, shoulderF, shoulderB, hipF, hipB,
    armF: armEnd(shoulderF, p.armFront, p.elbowFront),
    armB: armEnd(shoulderB, p.armBack, p.elbowBack),
    legF: legEnd(hipF, p.legFront, p.kneeFront),
    legB: legEnd(hipB, p.legBack, p.kneeBack),
  };
}

/** 肩甲：上窄下宽的阶梯装甲板 */
function pauldron(ctx, cx, cy, half, color, outline, grow) {
  const g = outline ? grow : 0;
  rect(ctx, cx - half + 2 - g, cy - 5 - g, (half - 2) * 2 + g * 2, 4 + g * 2, color);
  rect(ctx, cx - half - g, cy - 2 - g, half * 2 + g * 2, 7 + g * 2, color);
}

/** 绘制机甲本体。outlinePass=true 时统一画描边层。 */
function drawBody(ctx, f, p, pal, outlinePass) {
  const heavy = f.build === 'heavy';
  const s = skeleton(f, p);
  const O = outlinePass;
  const grow = O ? 2 : 0;

  const colOutline = pal.outline;
  const colDark = O ? colOutline : pal.armorDark;
  const colMid = O ? colOutline : pal.armorMid;
  const colLight = O ? colOutline : pal.armorLight;
  const colMetal = O ? colOutline : pal.metal;
  const colMetalL = O ? colOutline : pal.metalLight;
  const colAccent = O ? colOutline : pal.accent;
  const colVisor = O ? colOutline : pal.visor;
  const colBeam = O ? colOutline : pal.beam;

  const armW = heavy ? 7 : 6;
  const legW = heavy ? 8 : 7;
  const chestHalf = heavy ? 9 : 7.5;
  const waistHalf = heavy ? 6.5 : 5.5;
  const headHalf = heavy ? 6 : 5;

  // --- 背包 / 推进器（机体背面，先画） ---
  if (heavy) {
    const bx = s.chest.x - chestHalf - 3;
    rect(ctx, bx - grow, s.chest.y - 7 - grow, 5 + grow * 2, 16 + grow * 2, colDark);
    if (!O) {
      rect(ctx, bx + 1, s.chest.y - 5, 3, 11, colMetal);
      rect(ctx, bx - 1, s.chest.y + 8, 7, 2, colMetalL);
      rect(ctx, bx, s.chest.y + 10, 5, 2, pal.glow);
    }
  }

  // --- 后腿 ---
  limb(ctx, s.hipB.x, s.hipB.y, s.legB.knee.x, s.legB.knee.y, legW + grow, colDark);
  limb(ctx, s.legB.knee.x, s.legB.knee.y, s.legB.foot.x, s.legB.foot.y, legW - 1 + grow, colDark);
  if (!O) {
    rect(ctx, s.legB.foot.x - 4, s.legB.foot.y - 2, 8, 3, colMetal);
    rect(ctx, s.legB.knee.x - 2, s.legB.knee.y - 2, 4, 3, colMetalL);
  }

  // --- 前腿 ---
  limb(ctx, s.hipF.x, s.hipF.y, s.legF.knee.x, s.legF.knee.y, legW + grow, colMid);
  limb(ctx, s.legF.knee.x, s.legF.knee.y, s.legF.foot.x, s.legF.foot.y, legW - 1 + grow, colMid);
  if (!O) {
    // 膝甲
    rect(ctx, s.legF.knee.x - 3, s.legF.knee.y - 3, 6, 5, colMetalL);
    rect(ctx, s.legF.knee.x - 3, s.legF.knee.y - 3, 6, 1, colAccent);
    // 脚掌
    rect(ctx, s.legF.foot.x - 4, s.legF.foot.y - 3, 9, 4, colMetalL);
    rect(ctx, s.legF.foot.x - 4, s.legF.foot.y - 3, 9, 1, colAccent);
  }

  // --- 后臂 ---
  limb(ctx, s.shoulderB.x, s.shoulderB.y, s.armB.elbow.x, s.armB.elbow.y, armW - 1 + grow, colDark);
  limb(ctx, s.armB.elbow.x, s.armB.elbow.y, s.armB.hand.x, s.armB.hand.y, armW - 2 + grow, colDark);

  // --- 躯干 ---
  trapezoid(ctx, s.chest.x, s.chest.y - 7 + (O ? -1 : 0), s.pelvis.y,
    chestHalf + grow, waistHalf + grow, colMid);
  if (!O) {
    // 上胸装甲板 + 高光
    trapezoid(ctx, s.chest.x, s.chest.y - 7, s.chest.y - 3, chestHalf - 1, chestHalf - 3, pal.armorLight);
    rect(ctx, s.chest.x - chestHalf + 1, s.chest.y - 7, chestHalf * 2 - 2, 1, '#ffffff44');
    // 胸口能源核心
    rect(ctx, s.chest.x - 3, s.chest.y - 1, 6, 5, colBeam);
    rect(ctx, s.chest.x - 2, s.chest.y, 4, 3, pal.core);
    rect(ctx, s.chest.x - 1, s.chest.y, 2, 1, '#ffffff');
    // 侧面散热格栅
    rect(ctx, s.chest.x - chestHalf + 1, s.chest.y + 1, 3, 1, colDark);
    rect(ctx, s.chest.x - chestHalf + 1, s.chest.y + 3, 3, 1, colDark);
    rect(ctx, s.chest.x + chestHalf - 4, s.chest.y + 1, 3, 1, colDark);
    rect(ctx, s.chest.x + chestHalf - 4, s.chest.y + 3, 3, 1, colDark);
  }

  // --- 腰甲 ---
  rect(ctx, s.pelvis.x - waistHalf - 1 - grow, s.pelvis.y - 4 - grow,
    (waistHalf + 1) * 2 + grow * 2, 6 + grow * 2, colDark);
  if (!O) {
    rect(ctx, s.pelvis.x - waistHalf - 1, s.pelvis.y - 4, (waistHalf + 1) * 2, 2, colMid);
    rect(ctx, s.pelvis.x - 2, s.pelvis.y - 4, 4, 2, colAccent);
  }

  // --- 后肩甲 ---
  const padB = heavy ? 6.5 : 5.5;
  pauldron(ctx, s.shoulderB.x, s.shoulderB.y, padB, colDark, O, grow);

  // --- 肩炮（重型专属，装在后肩） ---
  if (heavy) {
    rect(ctx, s.shoulderB.x - 3 - grow, s.shoulderB.y - 11 - grow, 7 + grow * 2, 7 + grow * 2, colMetal);
    if (!O) {
      rect(ctx, s.shoulderB.x - 3, s.shoulderB.y - 11, 7, 2, colMetalL);
      rect(ctx, s.shoulderB.x - 1, s.shoulderB.y - 12, 3, 2, colAccent);
    }
  }

  // --- 前肩甲 ---
  const padF = heavy ? 8 : 7;
  pauldron(ctx, s.shoulderF.x, s.shoulderF.y, padF, colMid, O, grow);
  if (!O) {
    rect(ctx, s.shoulderF.x - padF + 2, s.shoulderF.y - 5, (padF - 2) * 2, 2, pal.armorLight);
    rect(ctx, s.shoulderF.x - padF + 1, s.shoulderF.y - 2, 3, 3, colAccent);
    rect(ctx, s.shoulderF.x + padF - 4, s.shoulderF.y - 2, 3, 3, colAccent);
  }

  // --- 头部 ---
  rect(ctx, s.head.x - headHalf + (O ? -1 : 0), s.head.y - 4 + (O ? -1 : 0),
    headHalf * 2 + grow, 9 + grow, colMid);
  if (!O) {
    // 额甲
    rect(ctx, s.head.x - headHalf, s.head.y - 4, headHalf * 2, 3, pal.armorLight);
    rect(ctx, s.head.x - headHalf, s.head.y - 4, headHalf * 2, 1, '#ffffff55');
    // 光学面罩
    rect(ctx, s.head.x + 1, s.head.y - 2, headHalf - 1, 3, colVisor);
    rect(ctx, s.head.x + 2, s.head.y - 2, headHalf - 2, 1, '#ffffff');
    // 下颚装甲
    rect(ctx, s.head.x - headHalf, s.head.y + 2, headHalf * 2, 3, colDark);
    rect(ctx, s.head.x - headHalf + 1, s.head.y + 3, 3, 1, colMetalL);
    // 顶部散热鳍 / 天线
    if (heavy) {
      rect(ctx, s.head.x - 1, s.head.y - 8, 4, 4, colMetalL);
      rect(ctx, s.head.x - 1, s.head.y - 8, 2, 4, colAccent);
    } else {
      rect(ctx, s.head.x - 4, s.head.y - 7, 2, 5, colMetalL);
      rect(ctx, s.head.x - 4, s.head.y - 7, 2, 1, colAccent);
      // 背部推进翼
      rect(ctx, s.chest.x - chestHalf - 3, s.chest.y - 6, 4, 13, colMetal);
      rect(ctx, s.chest.x - chestHalf - 3, s.chest.y - 6, 4, 2, colAccent);
      rect(ctx, s.chest.x - chestHalf - 2, s.chest.y + 5, 2, 2, pal.glow);
    }
  }

  // --- 前臂 + 武器 ---
  limb(ctx, s.shoulderF.x, s.shoulderF.y, s.armF.elbow.x, s.armF.elbow.y, armW + grow, colMid);
  limb(ctx, s.armF.elbow.x, s.armF.elbow.y, s.armF.hand.x, s.armF.hand.y, armW - 1 + grow, colMid);
  if (!O) {
    // 前臂护板
    rect(ctx, s.armF.elbow.x - armW / 2, s.armF.elbow.y - 1, armW, 5, colMetalL);
    // 手部机械关节
    rect(ctx, s.armF.hand.x - 3, s.armF.hand.y - 3, 6, 5, colMetal);
    rect(ctx, s.armF.hand.x - 3, s.armF.hand.y - 3, 6, 1, colMetalL);
  }

  // 武器
  if (!O) {
    const hx = s.armF.hand.x;
    const hy = s.armF.hand.y;
    if (f.build === 'heavy') {
      // 融合炮
      const rec = Math.round(p.weaponRecoil * 4);
      rect(ctx, hx - 4 - rec, hy - 5, 15, 9, pal.metal);
      rect(ctx, hx - 4 - rec, hy - 5, 15, 3, pal.metalLight);
      rect(ctx, hx - 4 - rec, hy + 2, 15, 2, pal.armorDark);
      rect(ctx, hx + 9 - rec, hy - 4, 5, 7, pal.metalLight);
      rect(ctx, hx + 12 - rec, hy - 2, 3, 4, colAccent);
      if (p.glowCharge > 0) {
        rect(ctx, hx + 12 - rec, hy - 3, 4, 6, colBeam);
        rect(ctx, hx + 13 - rec, hy - 2, 2, 4, '#ffffff');
      }
    } else {
      // 等离子爪刃
      const rec = Math.round(p.weaponRecoil * 3);
      const gx = hx - rec;
      rect(ctx, gx, hy - 5, 5, 9, pal.metal);
      rect(ctx, gx + 1, hy - 4, 3, 7, pal.metalLight);
      rect(ctx, gx + 5, hy - 4, 7, 2, colBeam);
      rect(ctx, gx + 5, hy + 1, 7, 2, colBeam);
      rect(ctx, gx + 10, hy - 4, 3, 2, '#ffffff');
      rect(ctx, gx + 10, hy + 1, 3, 2, '#ffffff');
      if (p.glowCharge > 0) {
        rect(ctx, gx + 2, hy - 2, 2, 3, colBeam);
      }
    }
  }
}

/**
 * 绘制一台机甲
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} f fighter 实例
 * @param {object} pal 调色板
 */
export function drawMech(ctx, f, pal) {
  const p = computePose(f);
  const sk = skeleton(f, p);

  // 影子
  if (!p.lying) {
    const shadowH = Math.max(1, 4 - Math.round(f.altitude / 6));
    ctx.globalAlpha = 0.3;
    rect(ctx, f.x - 9, f.y - shadowH, 18, shadowH, '#000000');
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(Math.round(f.x), Math.round(f.y));
  if (p.lying) ctx.rotate(f.facing > 0 ? -Math.PI / 2 : Math.PI / 2);
  else ctx.scale(f.facing, 1);

  // 蓄力光环
  if (p.glowCharge > 0) {
    ctx.globalAlpha = 0.35 + p.glowCharge * 0.45;
    const r = 5 + Math.round(p.glowCharge * 5);
    rect(ctx, sk.chest.x - r, sk.chest.y - 4 - r, r * 2, 2, pal.beam);
    rect(ctx, sk.chest.x - r, sk.chest.y + 2, r * 2, 2, pal.beam);
    rect(ctx, sk.chest.x - r, sk.chest.y - 4, 2, r * 2, pal.beam);
    rect(ctx, sk.chest.x + r - 2, sk.chest.y - 4, 2, r * 2, pal.beam);
    ctx.globalAlpha = 1;
  }

  drawBody(ctx, f, p, pal, true);
  drawBody(ctx, f, p, pal, false);

  // 受击闪白
  if (f.flash > 0) {
    drawBody(ctx, f, p, WHITE_PAL, false);
  }

  ctx.restore();
}
