// 固定步长游戏循环：逻辑 60FPS，渲染跟随 requestAnimationFrame
export class Engine {
  constructor({ update, render, step = 1 / 60, maxFrameTime = 0.25 }) {
    this.update = update;
    this.render = render;
    this.step = step;
    this.maxFrameTime = maxFrameTime;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.frameId = 0;
    this.time = 0;
    this._loop = this._loop.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  _loop(now) {
    if (!this.running) return;
    let frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frameTime > this.maxFrameTime) frameTime = this.maxFrameTime;
    this.accumulator += frameTime;

    let steps = 0;
    while (this.accumulator >= this.step && steps < 5) {
      this.update(this.step);
      this.accumulator -= this.step;
      this.time += this.step;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;

    this.render(this.accumulator / this.step);
    this.frameId = requestAnimationFrame(this._loop);
  }
}
