/* eslint-disable no-unused-vars */
const STORAGE_KEY = 'snakeObstaclesHighScore';

function loadHighScore() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(score) {
  try {
    const current = loadHighScore();
    if (score > current) {
      localStorage.setItem(STORAGE_KEY, String(score));
      return score;
    }
    return current;
  } catch {
    return score;
  }
}

const GRID_SIZE = 20;
const BASE_SPEED = 140;
const SPEED_DECREASE = 8;
const MIN_SPEED = 55;
const MAX_FRAME_DELTA = 100;
const POINTS_PER_FOOD = 10;
const LEVEL_UP_EVERY = 5;

const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.onScoreChange = callbacks.onScoreChange ?? (() => {});
    this.onLevelChange = callbacks.onLevelChange ?? (() => {});
    this.onGameOver = callbacks.onGameOver ?? (() => {});

    this.cols = canvas.width / GRID_SIZE;
    this.rows = canvas.height / GRID_SIZE;

    this.resetState();
  }

  resetState() {
    const startX = Math.floor(this.cols / 2);
    const startY = Math.floor(this.rows / 2);

    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    this.prevSnake = this.snake.map((seg) => ({ ...seg }));
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    this.inputQueue = [];
    this.food = null;
    this.obstacles = [];
    this.score = 0;
    this.level = 1;
    this.foodsEaten = 0;
    this.running = false;
    this.paused = false;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.renderProgress = 0;
    this.tickInterval = BASE_SPEED;
    this.animationId = null;
    this.animTime = 0;
  }

  start() {
    this.resetState();
    this.generateObstacles();
    this.spawnFood();
    this.running = true;
    this.paused = false;
    this.lastFrame = performance.now();
    this.accumulator = 0;
    this.renderProgress = 0;
    this.animTime = 0;
    this.onScoreChange(this.score);
    this.onLevelChange(this.level);
    this.loop(this.lastFrame);
  }

  stop() {
    this.running = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  togglePause() {
    if (!this.running) return;
    this.paused = !this.paused;
    this.lastFrame = performance.now();
  }

  getRenderPosition(index) {
    const current = this.snake[index];
    const previous = this.prevSnake[index];

    if (!previous) {
      return { x: current.x, y: current.y };
    }

    const t = this.renderProgress;
    return {
      x: previous.x + (current.x - previous.x) * t,
      y: previous.y + (current.y - previous.y) * t,
    };
  }

  isPaused() {
    return this.paused;
  }

  isRunning() {
    return this.running;
  }

  handleInput(code) {
    const newDir = DIRECTIONS[code];
    if (!newDir) return;

    const lastDir =
      this.inputQueue.length > 0
        ? this.inputQueue[this.inputQueue.length - 1]
        : this.direction;

    const isOpposite =
      newDir.x + lastDir.x === 0 && newDir.y + lastDir.y === 0;
    if (isOpposite || this.inputQueue.length >= 2) return;

    this.inputQueue.push({ ...newDir });
    this.nextDirection = { ...newDir };

    if (this.running && !this.paused) {
      this.draw();
    }
  }

  getObstacleCount() {
    return 5 + (this.level - 1) * 3;
  }

  isOccupied(x, y, excludeTail = false) {
    const snakeBody = excludeTail ? this.snake.slice(0, -1) : this.snake;
    if (snakeBody.some((seg) => seg.x === x && seg.y === y)) return true;
    if (this.obstacles.some((obs) => obs.x === x && obs.y === y)) return true;
    if (this.food && this.food.x === x && this.food.y === y) return true;
    return false;
  }

  generateObstacles() {
    this.obstacles = [];
    const count = this.getObstacleCount();
    const safeRadius = 4;
    const centerX = Math.floor(this.cols / 2);
    const centerY = Math.floor(this.rows / 2);
    let attempts = 0;
    const maxAttempts = count * 50;

    while (this.obstacles.length < count && attempts < maxAttempts) {
      attempts += 1;
      const x = Math.floor(Math.random() * this.cols);
      const y = Math.floor(Math.random() * this.rows);
      const dist = Math.abs(x - centerX) + Math.abs(y - centerY);

      if (dist < safeRadius) continue;
      if (this.isOccupied(x, y)) continue;

      this.obstacles.push({ x, y });
    }
  }

  spawnFood() {
    let attempts = 0;
    const maxAttempts = this.cols * this.rows;

    while (attempts < maxAttempts) {
      attempts += 1;
      const x = Math.floor(Math.random() * this.cols);
      const y = Math.floor(Math.random() * this.rows);

      if (!this.isOccupied(x, y)) {
        this.food = { x, y };
        return;
      }
    }

    this.food = null;
  }

  tick() {
    this.prevSnake = this.snake.map((seg) => ({ ...seg }));

    if (this.inputQueue.length > 0) {
      this.direction = this.inputQueue.shift();
    }

    this.nextDirection = this.inputQueue.length > 0
      ? { ...this.inputQueue[0] }
      : { ...this.direction };

    const head = this.snake[0];
    const newHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
    };

    if (
      newHead.x < 0 ||
      newHead.x >= this.cols ||
      newHead.y < 0 ||
      newHead.y >= this.rows
    ) {
      this.gameOver();
      return;
    }

    if (this.snake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
      this.gameOver();
      return;
    }

    if (this.obstacles.some((obs) => obs.x === newHead.x && obs.y === newHead.y)) {
      this.gameOver();
      return;
    }

    this.snake.unshift(newHead);

    if (this.food && newHead.x === this.food.x && newHead.y === this.food.y) {
      this.score += POINTS_PER_FOOD;
      this.foodsEaten += 1;
      this.onScoreChange(this.score);

      if (this.foodsEaten % LEVEL_UP_EVERY === 0) {
        this.levelUp();
      }

      this.spawnFood();

      if (!this.food) {
        this.gameOver(true);
        return;
      }
    } else {
      this.snake.pop();
    }
  }

  levelUp() {
    this.level += 1;
    this.tickInterval = Math.max(MIN_SPEED, BASE_SPEED - (this.level - 1) * SPEED_DECREASE);
    this.onLevelChange(this.level);
    this.generateObstacles();
  }

  gameOver(won = false) {
    this.running = false;
    this.onGameOver({ score: this.score, level: this.level, won });
  }

  loop(timestamp) {
    if (!this.running) return;

    this.animationId = requestAnimationFrame((t) => this.loop(t));

    const delta = Math.min(timestamp - this.lastFrame, MAX_FRAME_DELTA);
    this.lastFrame = timestamp;
    this.animTime += delta;

    if (!this.paused) {
      this.accumulator += delta;

      while (this.accumulator >= this.tickInterval) {
        this.tick();
        this.accumulator -= this.tickInterval;
        if (!this.running) break;
      }
    }

    this.renderProgress = this.accumulator / this.tickInterval;
    this.draw();
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.drawGrid();
    this.drawObstacles();
    this.drawFood();
    this.drawSnake();

    if (this.paused) {
      this.drawPauseOverlay();
    }
  }

  drawGrid() {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = 0.5;

    for (let x = 0; x <= this.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * GRID_SIZE, 0);
      ctx.lineTo(x * GRID_SIZE, this.canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= this.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * GRID_SIZE);
      ctx.lineTo(this.canvas.width, y * GRID_SIZE);
      ctx.stroke();
    }
  }

  drawSnake() {
    const { ctx } = this;

    this.snake.forEach((seg, index) => {
      const pos = this.getRenderPosition(index);
      const px = pos.x * GRID_SIZE;
      const py = pos.y * GRID_SIZE;
      const isHead = index === 0;
      const padding = isHead ? 1 : 2;
      const size = GRID_SIZE - padding * 2;

      if (isHead) {
        const gradient = ctx.createLinearGradient(px, py, px + GRID_SIZE, py + GRID_SIZE);
        gradient.addColorStop(0, '#4ade80');
        gradient.addColorStop(1, '#22c55e');
        ctx.fillStyle = gradient;

        ctx.shadowColor = 'rgba(34, 197, 94, 0.45)';
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
        const alpha = 1 - (index / this.snake.length) * 0.4;
        ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
      }

      ctx.beginPath();
      ctx.roundRect(px + padding, py + padding, size, size, isHead ? 6 : 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isHead) {
        this.drawEyes(pos);
      }
    });
  }

  drawEyes(head) {
    const { ctx } = this;
    const cx = head.x * GRID_SIZE + GRID_SIZE / 2;
    const cy = head.y * GRID_SIZE + GRID_SIZE / 2;
    const eyeOffset = 4;
    const eyeRadius = 2.5;

    let ex1 = cx;
    let ey1 = cy;
    let ex2 = cx;
    let ey2 = cy;

    const dir = this.nextDirection;

    if (dir.x === 1) {
      ex1 += 4; ey1 -= eyeOffset;
      ex2 += 4; ey2 += eyeOffset;
    } else if (dir.x === -1) {
      ex1 -= 4; ey1 -= eyeOffset;
      ex2 -= 4; ey2 += eyeOffset;
    } else if (dir.y === -1) {
      ey1 -= 4; ex1 -= eyeOffset;
      ey2 -= 4; ex2 += eyeOffset;
    } else {
      ey1 += 4; ex1 -= eyeOffset;
      ey2 += 4; ex2 += eyeOffset;
    }

    ctx.fillStyle = '#052e16';
    ctx.beginPath();
    ctx.arc(ex1, ey1, eyeRadius, 0, Math.PI * 2);
    ctx.arc(ex2, ey2, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawFood() {
    if (!this.food) return;

    const { ctx } = this;
    const { x, y } = this.food;
    const cx = x * GRID_SIZE + GRID_SIZE / 2;
    const cy = y * GRID_SIZE + GRID_SIZE / 2;
    const pulse = Math.sin(this.animTime * 0.005) * 0.08 + 1;
    const radius = (GRID_SIZE / 2 - 3) * pulse;

    const gradient = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, radius);
    gradient.addColorStop(0, '#fca5a5');
    gradient.addColorStop(0.6, '#ef4444');
    gradient.addColorStop(1, '#b91c1c');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - radius + 2, 3, 5, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawObstacles() {
    const { ctx } = this;

    this.obstacles.forEach(({ x, y }) => {
      const px = x * GRID_SIZE + 2;
      const py = y * GRID_SIZE + 2;
      const size = GRID_SIZE - 4;

      const gradient = ctx.createLinearGradient(px, py, px + size, py + size);
      gradient.addColorStop(0, '#64748b');
      gradient.addColorStop(1, '#475569');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(px, py, size, size, 4);
      ctx.fill();

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
      ctx.fillRect(px + 3, py + 3, size - 6, 3);
    });
  }

  drawPauseOverlay() {
    const { ctx, canvas } = this;
    ctx.fillStyle = 'rgba(15, 20, 25, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 28px Segoe UI, system-ui, Sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ПАУЗА', canvas.width / 2, canvas.height / 2);
  }
}

function initGame() {
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
    const padding = 32;
    const mobileControlsHeight = window.innerWidth <= 768 ? 150 : 0;
    const availableHeight = window.innerHeight - 200 - mobileControlsHeight;
    const availableWidth = window.innerWidth - padding;
    
    const maxSize = Math.min(availableWidth, availableHeight, 600);

    canvas.style.width = `${maxSize}px`;
    canvas.style.height = `${maxSize}px`;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- Мобильное управление (Свайпы) ---
  let touchStartX = 0;
  let touchStartY = 0;
  const minSwipeDistance = 30;

  canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;

    if (Math.abs(dx) < minSwipeDistance && Math.abs(dy) < minSwipeDistance) {
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      // Горизонтальный свайп
      if (dx > 0) {
        game.handleInput('ArrowRight');
      } else {
        game.handleInput('ArrowLeft');
      }
    } else {
      // Вертикальный свайп
      if (dy > 0) {
        game.handleInput('ArrowDown');
      } else {
        game.handleInput('ArrowUp');
      }
    }
  }, { passive: true });

  // --- Мобильное управление (Кнопки) ---
  document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const dir = btn.getAttribute('data-dir');
      if (game.isRunning() && !game.isPaused()) {
        game.handleInput(dir);
      }
    });
    // Для поддержки мыши на десктопе (если нужно)
    btn.addEventListener('mousedown', (e) => {
      const dir = btn.getAttribute('data-dir');
      if (game.isRunning() && !game.isPaused()) {
        game.handleInput(dir);
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
