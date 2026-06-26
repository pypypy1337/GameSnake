const STORAGE_KEY = 'snakeObstaclesHighScore';

export function loadHighScore() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score) {
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
