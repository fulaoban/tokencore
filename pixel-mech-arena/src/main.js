// 入口：画布初始化、场景调度、UI 绑定、主循环
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { BattleScene } from './scenes/battle.js';
import { VIEW_W, VIEW_H } from './data/config.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const titleScreen = document.getElementById('title-screen');
const resultScreen = document.getElementById('result-screen');
const pauseScreen = document.getElementById('pause-screen');
const resultTitle = document.getElementById('result-title');
const resultSub = document.getElementById('result-sub');

const input = new Input();
const audio = new AudioEngine();

const state = {
  scene: 'title',      // title | battle | result
  paused: false,
  muted: false,
};

const battle = new BattleScene({
  audio,
  onMatchEnd: (result) => showResult(result),
});

const engine = new Engine({
  update: () => tick(),
  render: () => render(),
});

function tick() {
  if (state.scene === 'battle' && !state.paused) {
    battle.update(input);
    battle.tickRoundEnd();
  } else if (state.scene === 'title' || state.scene === 'result') {
    battle.attractUpdate();
  }
  input.endFrame();
}

function render() {
  // 标题/结算界面也渲染战场作为动态背景
  if (state.scene === 'title' || state.scene === 'result') {
    battle.render(ctx);
    ctx.fillStyle = 'rgba(8,6,16,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  } else {
    battle.render(ctx);
  }
}

// ---------- UI ----------
function showTitle() {
  state.scene = 'title';
  titleScreen.classList.remove('hidden');
  resultScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
}

function startMatch(mode, aiLevel = 'normal') {
  audio.ensure();
  audio.ui();
  titleScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  state.scene = 'battle';
  state.paused = false;
  battle.start(mode, aiLevel);
}

function showResult({ winner, mode }) {
  state.scene = 'result';
  const p1Name = '赤焰';
  const p2Name = '苍岚';
  if (winner) {
    const isP1 = winner.id === 'p1';
    resultTitle.textContent = isP1 ? '赤焰 胜利' : '苍岚 胜利';
    resultTitle.style.color = isP1 ? '#ff4d7e' : '#5ee6ff';
    resultSub.textContent = mode === 'cpu'
      ? (isP1 ? '你击败了 CPU，漂亮！' : 'CPU 获胜，再来一次？')
      : `玩家${isP1 ? 1 : 2} 获胜`;
  } else {
    resultTitle.textContent = '平局';
    resultTitle.style.color = '#ffc247';
    resultSub.textContent = '双方战成平手';
  }
  resultScreen.classList.remove('hidden');
}

function togglePause() {
  if (state.scene !== 'battle') return;
  state.paused = !state.paused;
  pauseScreen.classList.toggle('hidden', !state.paused);
  audio.ui();
}

document.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (mode === 'cpu-hard') startMatch('cpu', 'hard');
    else startMatch(mode, 'normal');
  });
});

document.getElementById('btn-again').addEventListener('click', () => {
  startMatch(battle.mode, battle.ai.level);
});

document.getElementById('btn-back').addEventListener('click', showTitle);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-quit').addEventListener('click', () => {
  state.paused = false;
  pauseScreen.classList.add('hidden');
  showTitle();
});

const muteBtn = document.getElementById('btn-mute');
muteBtn.addEventListener('click', () => {
  state.muted = !state.muted;
  audio.setMuted(state.muted);
  muteBtn.textContent = `音效：${state.muted ? '关' : '开'}`;
});

// 全局快捷键
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'Enter') {
    if (state.scene === 'title') startMatch('cpu', 'normal');
    else if (state.scene === 'result') startMatch(battle.mode, battle.ai.level);
  }
});

// 首次交互解锁音频
window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
window.addEventListener('keydown', () => audio.ensure(), { once: true });

// 标题界面让机甲做待机动作
showTitle();
engine.start();
