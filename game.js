const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hud = document.getElementById('hud');
const homeScreen = document.getElementById('homeScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const upgradeScreen = document.getElementById('upgradeScreen');
const touchControls = document.getElementById('touchControls');

const waveLabel = document.getElementById('waveLabel');
const scoreLabel = document.getElementById('scoreLabel');
const coinsLabel = document.getElementById('coinsLabel');
const hpBar = document.getElementById('hpBar');
const staminaBar = document.getElementById('staminaBar');
const highScoreLabel = document.getElementById('highScoreLabel');
const bestWaveLabel = document.getElementById('bestWaveLabel');
const finalScore = document.getElementById('finalScore');
const finalWave = document.getElementById('finalWave');
const finalCoins = document.getElementById('finalCoins');

const upgradeButtons = [...document.querySelectorAll('.upgrade-btn')];
const upgradeLevels = {
  power: document.getElementById('powerLvl'),
  speed: document.getElementById('speedLvl'),
  vitality: document.getElementById('vitalityLvl'),
  fury: document.getElementById('furyLvl'),
};

const saveKey = 'rift-breaker-save-v1';
const difficulty = {
  baseEnemies: 3,
  enemyGrowth: 1.14,
  coinBase: 10,
};

const saveState = JSON.parse(localStorage.getItem(saveKey) || '{"highScore":0,"bestWave":1,"upgrades":{"power":1,"speed":1,"vitality":1,"fury":1}}');

const game = {
  state: 'home',
  lastTime: 0,
  keys: {},
  pointer: { x: 0, y: 0 },
  touchMode: false,
  world: {
    width: canvas.width,
    height: canvas.height,
  },
  player: {
    x: canvas.width / 2,
    y: canvas.height / 2 + 180,
    radius: 18,
    speed: 180,
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    attackCooldown: 0,
    attackTimer: 0,
    invulnerable: 0,
    facingX: 1,
    facingY: 0,
    damage: 18,
    combo: 0,
    comboTimer: 0,
    coins: 0,
  },
  enemies: [],
  particles: [],
  wave: 1,
  enemiesRemaining: 0,
  killCounter: 0,
  score: 0,
  spawnDelay: 0.8,
  spawnTimer: 0,
  waveBreakTimer: 0,
  nextWaveDelay: 1.8,
  upgradeCost: 12,
  upgrades: { ...saveState.upgrades },
  maxHpBoost: 0,
  bestWave: saveState.bestWave || 1,
  highScore: saveState.highScore || 0,
  runCoins: 0,
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  attack: false,
};

function saveProgress() {
  localStorage.setItem(saveKey, JSON.stringify({
    highScore: game.highScore,
    bestWave: game.bestWave,
    upgrades: game.upgrades,
  }));
}

function getUpgradeCost() {
  const level = game.upgrades[game.pendingUpgrade || 'power'] || 1;
  return Math.max(10, 12 + (level - 1) * 6);
}

function updateHUD() {
  waveLabel.textContent = String(game.wave);
  scoreLabel.textContent = String(game.score);
  coinsLabel.textContent = String(game.player.coins);
  hpBar.style.width = `${(game.player.hp / game.player.maxHp) * 100}%`;
  staminaBar.style.width = `${(game.player.stamina / game.player.maxStamina) * 100}%`;
  highScoreLabel.textContent = String(game.highScore);
  bestWaveLabel.textContent = String(game.bestWave);

  Object.keys(upgradeLevels).forEach((key) => {
    upgradeLevels[key].textContent = String(game.upgrades[key]);
  });
}

function resetRun() {
  game.state = 'playing';
  game.score = 0;
  game.wave = 1;
  game.runCoins = 0;
  game.enemies = [];
  game.particles = [];
  game.enemiesRemaining = 0;
  game.killCounter = 0;
  game.spawnTimer = 0;
  game.waveBreakTimer = 0;
  game.player.x = canvas.width / 2;
  game.player.y = canvas.height / 2 + 180;
  game.player.hp = game.player.maxHp;
  game.player.stamina = game.player.maxStamina;
  game.player.attackCooldown = 0;
  game.player.attackTimer = 0;
  game.player.invulnerable = 0;
  game.player.coins = 0;
  game.player.damage = 18 + (game.upgrades.power - 1) * 6;
  game.player.speed = 180 + (game.upgrades.speed - 1) * 16;
  game.player.maxHp = 100 + (game.upgrades.vitality - 1) * 18;
  game.player.maxStamina = 100 + (game.upgrades.fury - 1) * 10;
  game.player.hp = game.player.maxHp;
  game.player.stamina = game.player.maxStamina;
  beginWave();
  hud.classList.remove('hidden');
  homeScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  upgradeScreen.classList.add('hidden');
}

function beginWave() {
  const enemyAim = Math.max(3, Math.round(difficulty.baseEnemies + game.wave * 1.3));
  game.enemiesRemaining = enemyAim;
  game.spawnTimer = 0;
  game.waveBreakTimer = 0;
  game.spawnDelay = Math.max(0.42, 0.9 - game.wave * 0.04);
}

function spawnEnemy() {
  if (game.enemiesRemaining <= 0) return;

  const edge = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  const margin = 30;

  if (edge === 0) {
    x = Math.random() * canvas.width;
    y = -margin;
  } else if (edge === 1) {
    x = canvas.width + margin;
    y = Math.random() * canvas.height;
  } else if (edge === 2) {
    x = Math.random() * canvas.width;
    y = canvas.height + margin;
  } else {
    x = -margin;
    y = Math.random() * canvas.height;
  }

  const isHeavy = Math.random() < Math.min(0.23 + game.wave * 0.03, 0.48);
  const enemy = {
    x,
    y,
    radius: isHeavy ? 18 : 12,
    speed: isHeavy ? 56 + game.wave * 2.5 : 68 + game.wave * 2.8,
    hp: isHeavy ? 28 + game.wave * 6 : 12 + game.wave * 3,
    maxHp: isHeavy ? 28 + game.wave * 6 : 12 + game.wave * 3,
    damage: isHeavy ? 12 + game.wave * 1.6 : 7 + game.wave * 1.2,
    color: isHeavy ? '#f4a261' : '#ff6b6b',
    attackCooldown: Math.random() * 0.8,
    hasArmor: false,
  };

  game.enemies.push(enemy);
  game.enemiesRemaining -= 1;
}

function completeWave() {
  if (game.state !== 'playing') return;

  const coinReward = 12 + game.wave * 4;
  game.player.coins += coinReward;
  game.runCoins += coinReward;
  game.score += coinReward * 10;
  game.wave += 1;

  if (game.wave > game.bestWave) {
    game.bestWave = game.wave;
  }

  game.waveBreakTimer = 1.3;
  game.state = 'upgrade';
  upgradeScreen.classList.remove('hidden');
  updateHUD();
}

function onPlayerAttack() {
  if (game.player.attackCooldown > 0 || game.player.stamina < 12) return;
  game.player.attackCooldown = 0.35;
  game.player.stamina = Math.max(0, game.player.stamina - 12);
  game.player.attackTimer = 0.16;

  const reach = 58 + game.player.damage * 0.6;
  const hitboxX = game.player.x + game.player.facingX * (reach / 2 + 16);
  const hitboxY = game.player.y + game.player.facingY * (reach / 2 + 16);

  for (const enemy of game.enemies) {
    const dx = enemy.x - hitboxX;
    const dy = enemy.y - hitboxY;
    const dist = Math.hypot(dx, dy);
    if (dist < 38 + enemy.radius) {
      enemy.hp -= game.player.damage + (game.player.combo * 2); 
      createHitParticles(enemy.x, enemy.y, '#f7d77b');
      if (enemy.hp <= 0) {
        killEnemy(enemy);
      }
    }
  }
}

function killEnemy(enemy) {
  const index = game.enemies.indexOf(enemy);
  if (index !== -1) game.enemies.splice(index, 1);
  game.score += 25 + game.wave * 4;
  game.player.coins += 2;
  game.runCoins += 2;
  createHitParticles(enemy.x, enemy.y, '#ffd166');
}

function createHitParticles(x, y, color) {
  for (let i = 0; i < 7; i++) {
    game.particles.push({
      x, y,
      dx: (Math.random() - 0.5) * 100,
      dy: (Math.random() - 0.5) * 100,
      alpha: 1,
      life: 0.5 + Math.random() * 0.3,
      color,
      radius: 2 + Math.random() * 4,
    });
  }
}

function update(dt) {
  if (game.state === 'home') {
    updateHome();
    return;
  }

  if (game.state === 'gameover') {
    return;
  }

  if (game.state === 'upgrade') {
    return;
  }

  updatePlayer(dt);
  updateEnemies(dt);
  updateParticles(dt);
  updateWaveSpawns(dt);
  updateHUD();

  if (game.enemies.length === 0 && game.enemiesRemaining <= 0) {
    completeWave();
  }

  if (game.player.hp <= 0) {
    endGame();
  }
}

function updateHome() {
  // Small ambient motion effect while on title screen
}

function endGame() {
  game.state = 'gameover';
  game.highScore = Math.max(game.highScore, game.score);
  saveProgress();
  finalScore.textContent = String(game.score);
  finalWave.textContent = String(game.wave);
  finalCoins.textContent = String(game.runCoins);
  hud.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');
}

function updatePlayer(dt) {
  const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const magnitude = Math.hypot(moveX, moveY) || 1;

  if (moveX !== 0 || moveY !== 0) {
    game.player.x += (moveX / magnitude) * game.player.speed * dt;
    game.player.y += (moveY / magnitude) * game.player.speed * dt;
    game.player.facingX = moveX / magnitude;
    game.player.facingY = moveY / magnitude;
  }

  game.player.x = Math.max(game.player.radius, Math.min(canvas.width - game.player.radius, game.player.x));
  game.player.y = Math.max(game.player.radius, Math.min(canvas.height - game.player.radius, game.player.y));

  if (input.attack) {
    onPlayerAttack();
  }

  if (game.player.attackCooldown > 0) {
    game.player.attackCooldown -= dt;
  }

  if (game.player.attackTimer > 0) {
    game.player.attackTimer -= dt;
  }

  if (game.player.stamina < game.player.maxStamina) {
    game.player.stamina = Math.min(game.player.maxStamina, game.player.stamina + dt * 9);
  }

  if (game.player.invulnerable > 0) {
    game.player.invulnerable -= dt;
  }
}

function updateEnemies(dt) {
  for (const enemy of game.enemies) {
    const dx = game.player.x - enemy.x;
    const dy = game.player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    enemy.x += (dx / dist) * enemy.speed * dt;
    enemy.y += (dy / dist) * enemy.speed * dt;

    enemy.attackCooldown -= dt;
    if (dist < enemy.radius + game.player.radius + 8 && enemy.attackCooldown <= 0) {
      enemy.attackCooldown = 0.9;
      const damage = enemy.damage;
      if (game.player.invulnerable <= 0) {
        game.player.hp -= damage;
        game.player.invulnerable = 0.6;
        createHitParticles(game.player.x, game.player.y, '#ff5c8a');
      }
    }
  }
}

function updateWaveSpawns(dt) {
  if (game.enemiesRemaining > 0) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      spawnEnemy();
      game.spawnTimer = game.spawnDelay;
    }
  }
}

function updateParticles(dt) {
  for (const p of game.particles) {
    p.x += p.dx * dt;
    p.y += p.dy * dt;
    p.alpha -= dt * 1.5;
    p.life -= dt;
  }
  for (let i = game.particles.length - 1; i >= 0; i--) {
    if (game.particles[i].life <= 0 || game.particles[i].alpha <= 0) {
      game.particles.splice(i, 1);
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawPlayer();
  drawEnemies();
  drawParticles();

  if (game.state === 'playing' || game.state === 'upgrade') {
    drawAttackArc();
  }
}

function drawBackground() {
  ctx.fillStyle = '#0d1322';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 18; i++) {
    const x = (i * 53 + (game.wave * 9)) % (canvas.width + 50);
    const y = (i * 71) % canvas.height;
    ctx.fillStyle = 'rgba(120, 150, 255, 0.06)';
    ctx.fillRect(x, y, 36, 1);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = p.invulnerable > 0 ? '#ffd166' : '#5ee6c4';
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#dff8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(p.facingX * 20, p.facingY * 20);
  ctx.stroke();
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of game.enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-enemy.radius, -enemy.radius - 12, enemy.radius * 2, 5);
    ctx.fillStyle = '#74f7a5';
    ctx.fillRect(-enemy.radius, -enemy.radius - 12, (enemy.hp / enemy.maxHp) * enemy.radius * 2, 5);
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of game.particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawAttackArc() {
  if (game.player.attackTimer <= 0) return;
  const reach = 62 + game.player.damage * 0.5;
  const x = game.player.x + game.player.facingX * (reach / 2 + 16);
  const y = game.player.y + game.player.facingY * (reach / 2 + 16);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 222, 125, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, reach / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function frame(ts) {
  const dt = Math.min((ts - game.lastTime) / 1000 || 0.016, 0.033);
  game.lastTime = ts;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function handleKeyChange(code, isPressed) {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(code)) {
    const normalized = code.toLowerCase();
    if (normalized === 'arrowup' || normalized === 'w') input.up = isPressed;
    if (normalized === 'arrowdown' || normalized === 's') input.down = isPressed;
    if (normalized === 'arrowleft' || normalized === 'a') input.left = isPressed;
    if (normalized === 'arrowright' || normalized === 'd') input.right = isPressed;
  }
  if (code === ' ' || code === 'Space' || code === 'Spacebar') {
    input.attack = isPressed;
  }
}

document.addEventListener('keydown', (event) => {
  handleKeyChange(event.code, true);
  if (event.code === 'Space') event.preventDefault();
});

document.addEventListener('keyup', (event) => {
  handleKeyChange(event.code, false);
});

const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const resumeBtn = document.getElementById('resumeBtn');

startBtn.addEventListener('click', () => {
  resetRun();
  touchControls.classList.remove('hidden');
});

restartBtn.addEventListener('click', () => {
  resetRun();
  touchControls.classList.remove('hidden');
});

resumeBtn.addEventListener('click', () => {
  game.state = 'playing';
  upgradeScreen.classList.add('hidden');
  touchControls.classList.remove('hidden');
});

upgradeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.upgrade;
    const nextLevel = (game.upgrades[key] || 1) + 1;
    const cost = nextLevel * 8;

    if (game.player.coins < cost) return;
    game.player.coins -= cost;
    game.upgrades[key] = nextLevel;
    if (key === 'power') {
      game.player.damage = 18 + (game.upgrades.power - 1) * 6;
    }
    if (key === 'speed') {
      game.player.speed = 180 + (game.upgrades.speed - 1) * 16;
    }
    if (key === 'vitality') {
      game.player.maxHp = 100 + (game.upgrades.vitality - 1) * 18;
      game.player.hp = game.player.maxHp;
    }
    if (key === 'fury') {
      game.player.maxStamina = 100 + (game.upgrades.fury - 1) * 10;
      game.player.stamina = game.player.maxStamina;
    }

    saveProgress();
    updateHUD();
  });
});

function setupTouchControls() {
  touchControls.classList.remove('hidden');
  document.querySelectorAll('[data-key]').forEach((button) => {
    const key = button.dataset.key;
    const press = (value) => {
      const mapped = key === 'ArrowUp' ? 'ArrowUp' : key;
      if (mapped === 'ArrowUp') input.up = value;
      if (mapped === 'ArrowDown') input.down = value;
      if (mapped === 'ArrowLeft') input.left = value;
      if (mapped === 'ArrowRight') input.right = value;
    };

    button.addEventListener('pointerdown', () => press(true));
    button.addEventListener('pointerup', () => press(false));
    button.addEventListener('pointerleave', () => press(false));
  });

  const punchBtn = document.getElementById('punchBtn');
  punchBtn.addEventListener('pointerdown', () => {
    input.attack = true;
    onPlayerAttack();
  });
  punchBtn.addEventListener('pointerup', () => {
    input.attack = false;
  });
  punchBtn.addEventListener('pointerleave', () => {
    input.attack = false;
  });
}

if (window.matchMedia('(pointer: coarse)').matches) {
  setupTouchControls();
  game.touchMode = true;
}

window.addEventListener('resize', () => {
  // Keep the canvas display sized by CSS; no resizing needed.
});

updateHUD();
requestAnimationFrame(frame);

