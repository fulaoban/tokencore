// 键盘输入管理：记录按下状态 + 本帧的"刚按下"边沿事件
const PREVENT_DEFAULT = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Slash', 'Quote',
  'Enter', 'KeyP',
]);

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.justPressed = new Set();
    this.justReleased = new Set();
    this.anyKeyFlag = false;

    target.addEventListener('keydown', (e) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.justPressed.add(e.code);
      this.anyKeyFlag = true;
    });

    target.addEventListener('keyup', (e) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      this.down.delete(e.code);
      this.justReleased.add(e.code);
    });

    // 失焦时清空，避免"卡住一直往前走"
    target.addEventListener('blur', () => this.down.clear());
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.justPressed.has(code);
  }

  anyPressed(codes) {
    for (const c of codes) if (this.justPressed.has(c)) return true;
    return false;
  }

  // 每个固定步长结束后调用，清理边沿事件
  endFrame() {
    this.justPressed.clear();
    this.justReleased.clear();
    this.anyKeyFlag = false;
  }
}

// 键位表：返回玩家在某一步的动作意图
export const KEYMAP_P1 = {
  left: 'KeyA',
  right: 'KeyD',
  jump: 'KeyW',
  block: 'KeyS',
  light: 'KeyJ',
  heavy: 'KeyK',
  special: 'KeyL',
};

export const KEYMAP_P2 = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'ArrowUp',
  block: 'ArrowDown',
  light: 'Comma',
  heavy: 'Period',
  special: 'Slash',
};

/** 从键位表读取原始按键状态 */
export function readPad(input, map) {
  return {
    left: input.isDown(map.left),
    right: input.isDown(map.right),
    jump: input.wasPressed(map.jump),
    jumpHeld: input.isDown(map.jump),
    block: input.isDown(map.block),
    light: input.wasPressed(map.light),
    heavy: input.wasPressed(map.heavy),
    special: input.wasPressed(map.special),
  };
}
