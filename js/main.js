import { Game } from './game.js';
import { loadHighScore, saveHighScore } from './storage.js';

const canvas = document.getElementById('game-canvas');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMessage = document.getElementById('overlay-message');
const startBtn = document.getElementById('start-btn');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const levelEl = document.getElementById('level');

let highScore = loadHighScore();
highScoreEl.textContent = highScore;

const game = new Game(canvas, {
  onScoreChange(score) {
    scoreEl.textContent = score;
    if (score > highScore) {
      highScore = saveHighScore(score);
      highScoreEl.textContent = highScore;
    }
  },
  onLevelChange(level) {
    levelEl.textContent = level;
  },
  onGameOver({ score, level, won }) {
    highScore = saveHighScore(score);
    highScoreEl.textContent = highScore;

    if (won) {
      overlayTitle.textContent = 'Победа!';
      overlayMessage.textContent = `Вы заполнили всё поле! Счёт: ${score}, уровень: ${level}.`;
    } else {
      overlayTitle.textContent = 'Игра окончена';
      overlayMessage.textContent = `Счёт: ${score}. Уровень: ${level}. Попробуйте ещё раз!`;
    }

    startBtn.textContent = 'Играть снова';
    showOverlay();
  },
});

function showOverlay() {
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function handleStartClick() {
  hideOverlay();
  if (game.isRunning() && game.isPaused()) {
    game.togglePause();
  } else {
    game.start();
  }
}

startBtn.addEventListener('click', handleStartClick);

document.addEventListener('keydown', (event) => {
  const { code } = event;

  if (code === 'Space' || code === 'KeyP') {
    event.preventDefault();
    if (game.isRunning()) {
      game.togglePause();
      if (game.isPaused()) {
        overlayTitle.textContent = 'Пауза';
        overlayMessage.textContent = 'Нажмите P или Space, чтобы продолжить.';
        startBtn.textContent = 'Продолжить';
        showOverlay();
      } else {
        hideOverlay();
      }
    }
    return;
  }

  if (game.isRunning() && !game.isPaused()) {
    game.handleInput(code);
    event.preventDefault();
  }
}, { passive: false });

function resizeCanvas() {
  const maxSize = Math.min(window.innerWidth - 32, 600);
  const scale = maxSize / 600;

  if (scale < 1) {
    canvas.style.width = `${maxSize}px`;
    canvas.style.height = `${maxSize}px`;
  } else {
    canvas.style.width = '';
    canvas.style.height = '';
  }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
