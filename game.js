(async () => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  const restartBtn = document.getElementById('restartBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');
  const modeSelect = document.getElementById('modeSelect');
  const levelSelect = document.getElementById('levelSelect');
  const levelCompletion = document.getElementById('levelCompletion');
  const speedSlider = document.getElementById('speedSlider');
  const speedValue = document.getElementById('speedValue');
  const titleEl = document.getElementById('title');

  // Game state
  const HEX_RADIUS = 24;
  let hexBricks = [];
  let balls = [];
  let ballTrails = new Map();
  let powerups = [];
  let activeEffects = new Map();
  let paddle = { x: 0, y: 0, width: 120, height: 12, speed: 8 };
  let running = true;
  let paused = false;
  let muted = false;
  let score = 0;
  let lives = 3;
  let levelComplete = false;
  let fileAccessWarningShown = false;
  let baseBrickSpeed = 0.08; // Увеличена базовая скорость
  let currentBrickSpeed = 0.08;
  let spawnTimer = 0;
  const SPAWN_INTERVAL = 1800;
  let gameStartTime = 0;
  let lastSpeedIncreaseTime = 0;
  const SPEED_INCREASE_INTERVAL = 30000; // 30 секунд
  const SPEED_INCREASE_AMOUNT = 0.02; // Увеличение скорости
  
  // Настройки ускоренного появления
  const APPEARANCE_SETTINGS = {
    fastSpeedMultiplier: 25, // Увеличено до 25
    normalSpeedMultiplier: 1,
    hasFullyVisibleBrick: false
  };
  
  // Эффекты для нижней стенки
  let bottomWallEffect = {
    active: false,
    particles: [],
    glowAlpha: 0
  };
  
  // Настройки бесконечного режима
  const INFINITE_SETTINGS = {
    maxBricksPerRow: 5,
    minBricksPerRow: 2,
    brickColors: ['#c94c4c', '#4cc98a', '#4c7ac9', '#c9c24c', '#4cc9c6', '#c84cc9'],
    powerupChance: 0.15,
    basePowerupChance: 0.15,
    powerupChanceIncrease: 0.02,
    maxPowerupChance: 0.35,
    gameOverLine: 500,
    minSpacing: HEX_RADIUS * 2.8
  };

  // Типы бонусов - обновлены настройки
  const POWERUP_TYPES = {
    MULTIBALL: { 
      id: 'multiball', 
      name: 'Мультишар', 
      color: '#ff6b6b',
      icon: '⚽',
      indicatorColor: '#ff4444',
      isInstant: true // Разовый бонус
    },
    FREEZE: { 
      id: 'freeze', 
      name: 'Заморозка', 
      duration: 8000,
      color: '#4d96ff',
      icon: '❄️',
      indicatorColor: '#4d96ff',
      isInstant: false
    },
    PIERCE: { 
      id: 'pierce', 
      name: 'Пробивной', 
      duration: 12000,
      color: '#9b59b6',
      icon: '💥',
      indicatorColor: '#9b59b6',
      isInstant: false
    },
    TRIPLE: { 
      id: 'triple', 
      name: 'Тройной', 
      color: '#f39c12',
      icon: '🔶',
      indicatorColor: '#f39c12',
      isInstant: true // Разовый бонус
    },
    BOTTOMWALL: { 
      id: 'bottomwall', 
      name: 'Нижняя стенка', 
      duration: 15000,
      color: '#1abc9c',
      icon: '⬇️',
      indicatorColor: '#1abc9c',
      isInstant: false
    }
  };

  // Level catalog
  const levelConfigs = [
    { value: 'Levels/level1.json', label: 'Уровень 1' },
    { value: 'Levels/level2.json', label: 'Уровень 2' },
    { value: 'Levels/level3.json', label: 'Уровень 3' },
    { value: 'Levels/level4.json', label: 'Уровень 4' },
    { value: 'Levels/level5.json', label: 'Уровень 5' },
    { value: 'Levels/level6.json', label: 'Уровень 6' },
    { value: 'Levels/custom.json', label: 'Пользовательский' }
  ];

  // Speed slider - обновлен диапазон
  speedSlider.min = 0.02;
  speedSlider.max = 0.2;
  speedSlider.step = 0.01;
  speedSlider.value = baseBrickSpeed;
  speedValue.textContent = baseBrickSpeed.toFixed(2);
  
  speedSlider.addEventListener('input', (e) => {
    baseBrickSpeed = parseFloat(e.target.value);
    currentBrickSpeed = baseBrickSpeed;
    speedValue.textContent = baseBrickSpeed.toFixed(2);
  });

  // Mode selection
  modeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'infinite') {
      levelSelect.style.display = 'none';
      startInfiniteMode();
    } else {
      levelSelect.style.display = 'inline-block';
      populateLevelSelect();
      loadLevel(levelSelect.value || levelConfigs[0].value);
    }
  });

  function populateLevelSelect(){
    levelSelect.innerHTML = '';
    levelConfigs.forEach(cfg => {
      const option = document.createElement('option');
      option.value = cfg.value;
      option.textContent = cfg.label;
      levelSelect.appendChild(option);
    });
  }
  populateLevelSelect();

  // Resize canvas
  function resizeCanvas() {
    const frame = document.querySelector('.frame');
    const frameRect = frame.getBoundingClientRect();
    
    canvas.width = Math.max(300, Math.floor(frameRect.width));
    canvas.height = Math.max(200, Math.floor(frameRect.height));
    
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    paddle.width = Math.max(60, Math.min(260, Math.floor(canvas.width * 0.14)));
    paddle.x = clamp(paddle.x || (canvas.width - paddle.width) / 2, 0, canvas.width - paddle.width);
    paddle.y = canvas.height - 30;
    INFINITE_SETTINGS.gameOverLine = canvas.height - 60;
  }
  
  window.addEventListener('resize', resizeCanvas);
  document.addEventListener('DOMContentLoaded', resizeCanvas);

  // Utilities
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function randChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function distance(x1,y1,x2,y2){ return Math.hypot(x2-x1, y2-y1); }
  
  function lighten(hex, amt){
    const num = parseInt(hex.slice(1),16);
    const r = Math.min(255, ((num>>16) + 255*amt))|0;
    const g = Math.min(255, (((num>>8)&255) + 255*amt))|0;
    const b = Math.min(255, ((num & 255) + 255*amt))|0;
    return `rgb(${r},${g},${b})`;
  }

  // Функция для создания частиц для эффекта нижней стенки
  function createBottomWallParticles(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      bottomWallEffect.particles.push({
        x: x,
        y: y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 4,
        color: '#1abc9c',
        life: 1.0,
        decay: 0.03 + Math.random() * 0.03
      });
    }
  }

  // Обновление частиц эффекта нижней стенки
  function updateBottomWallEffect(now) {
    if (!bottomWallEffect.active && bottomWallEffect.particles.length === 0) return;
    
    for (let i = bottomWallEffect.particles.length - 1; i >= 0; i--) {
      const particle = bottomWallEffect.particles[i];
      particle.x += particle.dx;
      particle.y += particle.dy;
      particle.life -= particle.decay;
      
      if (particle.life <= 0) {
        bottomWallEffect.particles.splice(i, 1);
      }
    }
    
    if (bottomWallEffect.active) {
      bottomWallEffect.glowAlpha = Math.min(0.7, bottomWallEffect.glowAlpha + 0.02);
    } else {
      bottomWallEffect.glowAlpha = Math.max(0, bottomWallEffect.glowAlpha - 0.02);
    }
  }

  // Рисуем эффект нижней стенки
  function drawBottomWallEffect() {
    if (bottomWallEffect.glowAlpha <= 0 && bottomWallEffect.particles.length === 0) return;
    
    if (bottomWallEffect.glowAlpha > 0) {
      const gradient = ctx.createLinearGradient(0, canvas.height - 40, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(26, 188, 156, 0)');
      gradient.addColorStop(1, `rgba(26, 188, 156, ${bottomWallEffect.glowAlpha * 0.6})`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
      
      ctx.strokeStyle = `rgba(26, 188, 156, ${bottomWallEffect.glowAlpha})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 5);
      ctx.lineTo(canvas.width, canvas.height - 5);
      ctx.stroke();
      ctx.setLineDash([]);
      
      const pulse = (Math.sin(Date.now() / 300) + 1) * 0.5;
      for (let i = 0; i < 5; i++) {
        const x = canvas.width * (i + 1) / 6;
        ctx.beginPath();
        ctx.arc(x, canvas.height - 10, 3 + pulse * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(26, 188, 156, ${0.5 + pulse * 0.5})`;
        ctx.fill();
      }
    }
    
    for (const particle of bottomWallEffect.particles) {
      ctx.save();
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Draw hex with vertical gradient
  function drawHex(x,y,r,color,scale=1,alpha=1){
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(scale,scale);
    ctx.globalAlpha = alpha;
    const grad = ctx.createLinearGradient(0,-r,0,r);
    grad.addColorStop(0, lighten(color, 0.28));
    grad.addColorStop(1, color);
    ctx.beginPath();
    for(let i=0;i<6;i++){
      const a = Math.PI/3 * i;
      const px = r * Math.cos(a);
      const py = r * Math.sin(a);
      i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
    }
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.stroke();
    ctx.restore();
  }

  // Draw powerup
  function drawPowerup(powerup){
    ctx.save();
    ctx.fillStyle = powerup.type.color;
    ctx.beginPath();
    ctx.arc(powerup.x, powerup.y, powerup.radius, 0, Math.PI*2);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerup.type.icon, powerup.x, powerup.y);
    ctx.restore();
  }

  // Бесконечный режим
  function startInfiniteMode(){
    titleEl.textContent = 'Hexanoid — Fixed Overlap & Fast Appearance';
    hexBricks = [];
    balls = [];
    powerups = [];
    activeEffects.clear();
    score = 0;
    lives = 3;
    levelComplete = false;
    paused = false;
    spawnTimer = performance.now();
    gameStartTime = performance.now();
    lastSpeedIncreaseTime = gameStartTime;
    currentBrickSpeed = baseBrickSpeed;
    INFINITE_SETTINGS.powerupChance = INFINITE_SETTINGS.basePowerupChance;
    APPEARANCE_SETTINGS.hasFullyVisibleBrick = false;
    bottomWallEffect = {
      active: false,
      particles: [],
      glowAlpha: 0
    };
    
    createBall();
    
    // Создаем первый ряд за пределами поля (выше экрана)
    spawnBrickRow(-HEX_RADIUS * 3);
    
    updateStatus();
  }

  // Обновление статуса
  function updateStatus() {
    const now = performance.now();
    const elapsedSeconds = Math.floor((now - gameStartTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    
    statusEl.textContent = `Счет: ${score} | Жизни: ${lives} | Время: ${minutes}:${seconds.toString().padStart(2, '0')} | Скорость: ${currentBrickSpeed.toFixed(2)}`;
  }

  // Проверка увеличения скорости
  function checkSpeedIncrease(now) {
    if (now - lastSpeedIncreaseTime > SPEED_INCREASE_INTERVAL) {
      currentBrickSpeed += SPEED_INCREASE_AMOUNT;
      INFINITE_SETTINGS.powerupChance = Math.min(
        INFINITE_SETTINGS.maxPowerupChance,
        INFINITE_SETTINGS.powerupChance + INFINITE_SETTINGS.powerupChanceIncrease
      );
      lastSpeedIncreaseTime = now;
      
      showMessage(`Скорость увеличена! (${currentBrickSpeed.toFixed(2)})`, '#4cc98a');
    }
  }

  // Показать сообщение на экране
  let messageText = '';
  let messageTimer = 0;
  let messageColor = '#fff';
  
  function showMessage(text, color = '#fff') {
    messageText = text;
    messageColor = color;
    messageTimer = performance.now();
  }

  // Рисуем индикаторы бонусов вверху экрана
  function drawPowerupIndicators(now) {
    const powerupEntries = Array.from(activeEffects.entries());
    if (powerupEntries.length === 0) return;
    
    const indicatorHeight = 8;
    const spacing = 2;
    const startY = 5;
    let currentY = startY;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(5, 5, canvas.width - 10, (indicatorHeight + spacing) * powerupEntries.length + 5);
    
    for (const [powerupId, effect] of powerupEntries) {
      const powerupType = Object.values(POWERUP_TYPES).find(p => p.id === powerupId);
      if (!powerupType) continue;
      
      const elapsed = now - effect.startTime;
      const remaining = Math.max(0, effect.duration - elapsed);
      const progress = remaining / effect.duration;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(10, currentY, canvas.width - 20, indicatorHeight);
      
      const barWidth = (canvas.width - 20) * progress;
      ctx.fillStyle = powerupType.indicatorColor;
      ctx.fillRect(10, currentY, barWidth, indicatorHeight);
      
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(powerupType.icon, 12, currentY + indicatorHeight / 2);
      
      const timeLeft = (remaining / 1000).toFixed(1);
      ctx.textAlign = 'right';
      ctx.fillText(`${powerupType.name} (${timeLeft}с)`, canvas.width - 12, currentY + indicatorHeight / 2);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(10, currentY, canvas.width - 20, indicatorHeight);
      
      currentY += indicatorHeight + spacing;
    }
  }

  // Создание нового шара
  function createBall(){
    const ball = {
      id: Date.now() + Math.random(),
      x: canvas.width / 2,
      y: canvas.height * 0.7,
      dx: 4 * (Math.random() < 0.5 ? 1 : -1),
      dy: -4,
      radius: 8,
      pierce: false,
      trail: []
    };
    balls.push(ball);
    ballTrails.set(ball.id, []);
    return ball;
  }

  // Спавн ряда кирпичей
  function spawnBrickRow(yOffset = 0){
    const bricksInRow = randInt(INFINITE_SETTINGS.minBricksPerRow, INFINITE_SETTINGS.maxBricksPerRow);
    const minSpacing = INFINITE_SETTINGS.minSpacing;
    const newBricks = [];
    const rowId = Date.now() + Math.random();
    
    // Создаем сетку для размещения
    const columns = Math.floor((canvas.width - minSpacing * 2) / minSpacing);
    const actualBricks = Math.min(bricksInRow, columns);
    
    // Создаем список доступных позиций в сетке
    const availablePositions = [];
    for(let col = 0; col < columns; col++){
      availablePositions.push(col);
    }
    
    // Перемешиваем позиции
    for(let i = availablePositions.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [availablePositions[i], availablePositions[j]] = [availablePositions[j], availablePositions[i]];
    }
    
    // Берем нужное количество позиций
    const selectedPositions = availablePositions.slice(0, actualBricks);
    
    for(const col of selectedPositions){
      const x = minSpacing + col * minSpacing;
      const y = yOffset; // Используем переданное смещение
      
      // Проверяем, не пересекается ли с существующими кирпичами
      let tooClose = false;
      for(const brick of hexBricks){
        if(distance(x, y, brick.x, brick.y) < minSpacing * 0.8){
          tooClose = true;
          break;
        }
      }
      
      if(tooClose) continue;
      
      let containsPowerup = null;
      if(Math.random() < INFINITE_SETTINGS.powerupChance){
        const powerupTypes = Object.values(POWERUP_TYPES);
        containsPowerup = randChoice(powerupTypes);
      }
      
      newBricks.push({
        x: x,
        y: y,
        color: randChoice(INFINITE_SETTINGS.brickColors),
        hit: false,
        removing: false,
        removeStart: 0,
        containsPowerup: containsPowerup,
        powerupType: containsPowerup,
        rowId: rowId
      });
    }
    
    if(newBricks.length > 0){
      hexBricks.push(...newBricks);
    }
  }

  // Спавн падающего бонуса
  function spawnPowerup(x, y, type){
    powerups.push({
      x: x,
      y: y,
      radius: 10,
      dy: 2,
      type: type
    });
  }

  // Обновление бонусов - заморозка не действует на падающие бонусы
  function updatePowerups(){
    const freezeActive = activeEffects.has('freeze');
    
    for(let i = powerups.length - 1; i >= 0; i--){
      const powerup = powerups[i];
      
      // Заморозка НЕ действует на падающие бонусы
      powerup.y += powerup.dy;
      
      // Столкновение с платформой
      if(powerup.y + powerup.radius > paddle.y &&
         powerup.y - powerup.radius < paddle.y + paddle.height &&
         powerup.x + powerup.radius > paddle.x &&
         powerup.x - powerup.radius < paddle.x + paddle.width){
        
        activatePowerup(powerup.type);
        powerups.splice(i, 1);
        continue;
      }
      
      // Удаляем, если упал за экран
      if(powerup.y - powerup.radius > canvas.height){
        powerups.splice(i, 1);
      }
    }
  }

  // Активация бонуса - обновленная логика
  function activatePowerup(type){
    const now = performance.now();
    
    // Если эффект уже активен и это не разовый бонус, продлеваем время
    if(activeEffects.has(type.id) && !type.isInstant) {
      const effect = activeEffects.get(type.id);
      effect.startTime = now;
      showMessage(`Бонус продлен: ${type.name}`, type.color);
      return;
    }
    
    // Для разовых бонусов (мультишар, тройной) всегда применяем эффект
    if(type.isInstant) {
      switch(type.id){
        case 'multiball':
          const newBall = createBall();
          newBall.x = paddle.x + paddle.width / 2;
          newBall.y = paddle.y - newBall.radius;
          newBall.dx = 4 * (Math.random() < 0.5 ? 1 : -1);
          newBall.dy = -4;
          showMessage(`Добавлен шар: ${type.name}`, type.color);
          break;
          
        case 'triple':
          for(let i=0; i<2; i++){
            const tripleBall = createBall();
            tripleBall.x = paddle.x + paddle.width / 2;
            tripleBall.y = paddle.y - tripleBall.radius;
            const angle = (Math.PI/4) + (Math.random()-0.5) * 0.8;
            tripleBall.dx = 4 * Math.cos(angle);
            tripleBall.dy = -Math.abs(4 * Math.sin(angle));
          }
          showMessage(`Добавлены шары: ${type.name}`, type.color);
          break;
      }
      return;
    }
    
    // Для бонусов с длительностью
    activeEffects.set(type.id, { startTime: now, duration: type.duration });
    
    switch(type.id){
      case 'freeze':
        showMessage(`Активирован: ${type.name}`, type.color);
        break;
        
      case 'pierce':
        balls.forEach(ball => ball.pierce = true);
        showMessage(`Активирован: ${type.name}`, type.color);
        break;
        
      case 'bottomwall':
        bottomWallEffect.active = true;
        showMessage(`Активирован: ${type.name}`, type.color);
        break;
    }
  }

  // Обновление активных бонусов
  function updateActivePowerups(now){
    // Обновляем состояние нижней стенки
    bottomWallEffect.active = activeEffects.has('bottomwall');
    
    // Удаляем истекшие эффекты
    for(const [id, effect] of activeEffects){
      if(now - effect.startTime > effect.duration){
        activeEffects.delete(id);
        
        // Отменяем эффекты
        switch(id){
          case 'pierce':
            balls.forEach(ball => ball.pierce = false);
            break;
          case 'bottomwall':
            bottomWallEffect.active = false;
            break;
        }
      }
    }
  }

  // Обновление кирпичей - обновленная логика для заморозки
  function updateBricks(now){
    const freezeActive = activeEffects.has('freeze');
    
    // Проверяем, есть ли на поле полностью видимый кирпич
    // Кирпич считается полностью видимым, когда его ВЕРХНЯЯ часть (y - HEX_RADIUS) > 0
    let hasFullyVisibleBrick = false;
    for(const brick of hexBricks){
      if(!brick.hit && (brick.y - HEX_RADIUS) > 0){
        hasFullyVisibleBrick = true;
        break;
      }
    }
    
    // Определяем, нужно ли применять заморозку
    // Заморозка действует только если есть видимые кирпичи
    const shouldFreeze = freezeActive && hasFullyVisibleBrick;
    
    if(!shouldFreeze){
      // Определяем скорость движения
      let speedMultiplier = APPEARANCE_SETTINGS.normalSpeedMultiplier;
      if(!hasFullyVisibleBrick){
        speedMultiplier = APPEARANCE_SETTINGS.fastSpeedMultiplier;
      }
      
      // Обновляем состояние
      APPEARANCE_SETTINGS.hasFullyVisibleBrick = hasFullyVisibleBrick;
      
      // Обновляем каждый кирпич
      for(const brick of hexBricks){
        // Двигаем кирпич
        brick.y += currentBrickSpeed * speedMultiplier;
        
        // Проверка достижения нижней границы
        if(brick.y + HEX_RADIUS > INFINITE_SETTINGS.gameOverLine && !brick.hit){
          loseLife();
          brick.hit = true;
          brick.removing = true;
          brick.removeStart = now;
        }
      }
    }
    
    // Удаляем уничтоженные кирпичи (работает даже при заморозке)
    for(let i = hexBricks.length - 1; i >= 0; i--){
      const brick = hexBricks[i];
      if(brick.hit && brick.removing){
        const tt = now - brick.removeStart;
        if(tt > 360){
          // При уничтожении кирпича с бонусом создаем падающий бонус
          // Бонусы выпадают даже при заморозке
          if(brick.containsPowerup){
            spawnPowerup(brick.x, brick.y, brick.powerupType);
          }
          score += 100;
          hexBricks.splice(i, 1);
        }
      }
    }
    
    // Спавн новых кирпичей
    if(now - spawnTimer > SPAWN_INTERVAL){
      spawnBrickRow(-HEX_RADIUS * 2);
      spawnTimer = now;
    }
  }

  // Потеря жизни
  function loseLife(){
    lives--;
    if(lives <= 0){
      gameOver();
    } else {
      // Оставляем только один шар после потери жизни
      if(balls.length > 0){
        balls = [balls[0]];
        ballTrails.clear();
        ballTrails.set(balls[0].id, []);
        resetBall(balls[0]);
      }
      showMessage(`Потеряна жизнь! Осталось: ${lives}`, '#ff4444');
    }
  }

  // Сброс шара
  function resetBall(ball){
    ball.x = canvas.width / 2;
    ball.y = canvas.height * 0.7;
    ball.dx = 4 * (Math.random() < 0.5 ? 1 : -1);
    ball.dy = -4;
    ballTrails.set(ball.id, []);
  }

  // Game Over
  function gameOver(){
    running = false;
    const elapsedSeconds = Math.floor((performance.now() - gameStartTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    
    statusEl.textContent = `Игра окончена! Счет: ${score} | Время: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Создаем красивый экран окончания игры
    drawGameOverScreen();
    
    setTimeout(() => {
      alert(`Игра окончена!\nВаш счет: ${score}\nВремя выживания: ${minutes}:${seconds.toString().padStart(2, '0')}\nНажмите Restart чтобы играть снова.`);
    }, 100);
  }

  // Рисуем экран окончания игры
  function drawGameOverScreen(){
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 36px system-ui, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 60);
    
    ctx.fillStyle = '#fff';
    ctx.font = '20px system-ui, Arial';
    ctx.fillText(`Счет: ${score}`, canvas.width/2, canvas.height/2 - 10);
    
    const elapsedSeconds = Math.floor((performance.now() - gameStartTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    ctx.fillText(`Время: ${minutes}:${seconds.toString().padStart(2, '0')}`, canvas.width/2, canvas.height/2 + 30);
    
    ctx.font = '16px system-ui, Arial';
    ctx.fillText('Нажмите Restart для новой игры', canvas.width/2, canvas.height/2 + 80);
    
    ctx.restore();
  }

  // Draw scene
  function draw(now){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    
    // Background
    const g = ctx.createLinearGradient(0,0,0,canvas.height);
    g.addColorStop(0, '#0b0b0b');
    g.addColorStop(1, '#050505');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Индикаторы бонусов вверху экрана (только для бонусов с длительностью)
    const durationPowerups = Array.from(activeEffects.entries())
      .filter(([id]) => !POWERUP_TYPES[id]?.isInstant);
    if (durationPowerups.length > 0) {
      const indicatorHeight = 8;
      const spacing = 2;
      const startY = 5;
      let currentY = startY;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(5, 5, canvas.width - 10, (indicatorHeight + spacing) * durationPowerups.length + 5);
      
      for (const [powerupId, effect] of durationPowerups) {
        const powerupType = POWERUP_TYPES[powerupId];
        if (!powerupType) continue;
        
        const elapsed = now - effect.startTime;
        const remaining = Math.max(0, effect.duration - elapsed);
        const progress = remaining / effect.duration;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(10, currentY, canvas.width - 20, indicatorHeight);
        
        const barWidth = (canvas.width - 20) * progress;
        ctx.fillStyle = powerupType.indicatorColor;
        ctx.fillRect(10, currentY, barWidth, indicatorHeight);
        
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerupType.icon, 12, currentY + indicatorHeight / 2);
        
        const timeLeft = (remaining / 1000).toFixed(1);
        ctx.textAlign = 'right';
        ctx.fillText(`${powerupType.name} (${timeLeft}с)`, canvas.width - 12, currentY + indicatorHeight / 2);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(10, currentY, canvas.width - 20, indicatorHeight);
        
        currentY += indicatorHeight + spacing;
      }
    }

    // bricks
    for (const b of hexBricks){
      if (b.hit && b.removing){
        const tt = now - b.removeStart;
        if (tt < 120){
          const p = tt / 120;
          drawHex(b.x, b.y, HEX_RADIUS, b.color, 1 + 0.15 * p, 1 - p*0.05);
        } else if (tt < 360){
          const p = (tt - 120) / 240;
          drawHex(b.x, b.y, HEX_RADIUS, b.color, Math.max(0, 1.15 * (1 - p)), Math.max(0, 1 - p));
        }
      } else if (!b.hit) {
        // Обычное отображение
        drawHex(b.x, b.y, HEX_RADIUS, b.color);
        
        // Рисуем иконку бонуса в кирпиче
        if(b.containsPowerup){
          ctx.save();
          ctx.fillStyle = '#fff';
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = 0.9;
          ctx.fillText(b.containsPowerup.icon, b.x, b.y);
          ctx.restore();
        }
      }
    }

    // powerups
    for(const powerup of powerups){
      drawPowerup(powerup);
    }

    // paddle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#0ff';
    const zoneW = paddle.width / 5;
    ctx.fillRect(paddle.x, paddle.y, zoneW, paddle.height);
    ctx.fillRect(paddle.x + 4*zoneW, paddle.y, zoneW, paddle.height);
    ctx.globalAlpha = 1;

    // Эффект нижней стенки
    drawBottomWallEffect();

    // Линия проигрыша
    ctx.strokeStyle = '#ff4444';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, INFINITE_SETTINGS.gameOverLine);
    ctx.lineTo(canvas.width, INFINITE_SETTINGS.gameOverLine);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Индикатор пробивного режима
    const pierceActive = activeEffects.has('pierce');
    if(pierceActive){
      ctx.fillStyle = 'rgba(155, 89, 182, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Индикатор заморозки
    const freezeActive = activeEffects.has('freeze');
    if(freezeActive){
      ctx.fillStyle = 'rgba(77, 150, 255, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // trail and balls
    for(const ball of balls){
      const trail = ballTrails.get(ball.id) || [];
      for (let i=0;i<trail.length;i++){
        const p = trail[i];
        const a = (i+1)/trail.length;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ball.radius * 0.6, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,80,80,${a*0.45})`;
        ctx.fill();
      }

      // ball
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2);
      ctx.fillStyle = ball.pierce ? '#9b59b6' : '#ff4d4d';
      ctx.fill();
      
      // Индикатор пробивного шара
      if(ball.pierce){
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius + 3, 0, Math.PI*2);
        ctx.stroke();
      }
    }

    // HUD
    ctx.fillStyle = '#ddd';
    ctx.font = '14px system-ui, Arial';
    ctx.fillText(`Счет: ${score}`, 10, 20);
    ctx.fillText(`Жизни: ${lives}`, 10, 40);
    ctx.fillText(`Шаров: ${balls.length}`, 10, 60);
    ctx.fillText(`Скорость: ${currentBrickSpeed.toFixed(2)}`, canvas.width - 150, 20);
    ctx.fillText(`Шанс бонуса: ${(INFINITE_SETTINGS.powerupChance * 100).toFixed(0)}%`, canvas.width - 150, 40);
    
    // Время игры
    const elapsedSeconds = Math.floor((now - gameStartTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    ctx.fillText(`Время: ${minutes}:${seconds.toString().padStart(2, '0')}`, canvas.width - 150, 60);
    
    // Индикатор ускоренного появления
    if (!APPEARANCE_SETTINGS.hasFullyVisibleBrick) {
      ctx.fillStyle = '#4cc98a';
      ctx.font = 'bold 16px system-ui, Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Ускоренное появление: ВКЛ', canvas.width/2, 30);
      ctx.textAlign = 'left';
    }
    
    // Сообщение
    if (messageText && now - messageTimer < 2000) {
      const alpha = Math.min(1, (2000 - (now - messageTimer)) / 1000);
      ctx.fillStyle = messageColor;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 20px system-ui, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(messageText, canvas.width/2, canvas.height/2);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    
    // Игра на паузе
    if(paused){
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px system-ui, Arial';
      ctx.textAlign = 'center';
      ctx.fillText('ПАУЗА', canvas.width/2, canvas.height/2);
      ctx.font = '18px system-ui, Arial';
      ctx.fillText('Нажмите Pause для продолжения', canvas.width/2, canvas.height/2 + 40);
      ctx.textAlign = 'left';
    }
  }

  // Physics and collisions
  function reflect(vx,vy,nx,ny){
    const dot = vx*nx + vy*ny;
    let rx = vx - 2*dot*nx;
    let ry = vy - 2*dot*ny;
    const minY = 1.2;
    if (Math.abs(ry) < minY){
      ry = ry < 0 ? -minY : minY;
      const speed = Math.sqrt(rx*rx + ry*ry) || 1;
      const cur = Math.sqrt(rx*rx + ry*ry) || 1;
      rx = rx * (speed/cur);
    }
    return { dx: rx, dy: ry };
  }

  function moveBall(ball, now){
    if(paused || !running) return;
    
    const trail = ballTrails.get(ball.id) || [];
    ball.x += ball.dx;
    ball.y += ball.dy;
    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 18) trail.shift();
    ballTrails.set(ball.id, trail);

    // walls
    if (ball.x < ball.radius){ ball.x = ball.radius; ball.dx *= -1; }
    if (ball.x > canvas.width - ball.radius){ ball.x = canvas.width - ball.radius; ball.dx *= -1; }
    if (ball.y < ball.radius){ ball.y = ball.radius; ball.dy *= -1; }

    // paddle collision
    if (ball.dy > 0 &&
        ball.y + ball.radius > paddle.y &&
        ball.y - ball.radius < paddle.y + paddle.height &&
        ball.x + ball.radius > paddle.x &&
        ball.x - ball.radius < paddle.x + paddle.width){
      const offset = (ball.x - (paddle.x + paddle.width/2)) / (paddle.width/2);
      const baseAngle = offset * (Math.PI/3);
      const variation = (Math.random() - 0.5) * (Math.PI/36);
      const final = baseAngle + variation;
      const speed = Math.max(2.2, Math.sqrt(ball.dx*ball.dx + ball.dy*ball.dy));
      ball.dx = speed * Math.sin(final);
      ball.dy = -Math.abs(speed * Math.cos(final));
      ball.y = paddle.y - ball.radius - 0.1;
    }

    // hex collisions
    for (const b of hexBricks){
      if (b.hit) continue;
      const cx = b.x, cy = b.y;
      const ddx = ball.x - cx, ddy = ball.y - cy;
      if (Math.hypot(ddx, ddy) > HEX_RADIUS + ball.radius) continue;

      // В пробивном режиме просто уничтожаем кирпич без отскока
      if(ball.pierce){
        b.hit = true;
        b.removing = true;
        b.removeStart = now;
        score += 150;
        continue;
      }

      let collided = false;
      const rot = 0;
      for (let i=0;i<6;i++){
        const a1 = Math.PI/3 * i + rot;
        const a2 = Math.PI/3 * (i+1) + rot;
        const x1 = cx + HEX_RADIUS * Math.cos(a1);
        const y1 = cy + HEX_RADIUS * Math.sin(a1);
        const x2 = cx + HEX_RADIUS * Math.cos(a2);
        const y2 = cy + HEX_RADIUS * Math.sin(a2);
        const ex = x2 - x1, ey = y2 - y1;
        const t = ((ball.x - x1)*ex + (ball.y - y1)*ey) / (ex*ex + ey*ey);
        const tt = Math.max(0, Math.min(1, t));
        const px = x1 + ex * tt;
        const py = y1 + ey * tt;
        const dist = Math.hypot(ball.x - px, ball.y - py);
        if (dist <= ball.radius + 0.001){
          let nx = (ball.x - px) / (dist || 1);
          let ny = (ball.y - py) / (dist || 1);
          const r = reflect(ball.dx, ball.dy, nx, ny);
          ball.dx = r.dx; ball.dy = r.dy;
          b.hit = true;
          b.removing = true;
          b.removeStart = now;
          collided = true;
          break;
        }
      }
      if (collided) break;
    }

    // fallen below - с учетом бонуса "Нижняя стенка"
    if (ball.y - ball.radius > canvas.height){
      const bottomWallActive = activeEffects.has('bottomwall');
      
      if(bottomWallActive){
        // Отскок от нижней границы с эффектом
        ball.y = canvas.height - ball.radius;
        ball.dy = -Math.abs(ball.dy) * 1.1;
        
        // Создаем частицы эффекта
        createBottomWallParticles(ball.x, canvas.height - 5, 12);
        
        // Эффект отскока
        showMessage('Отскок!', '#1abc9c');
      } else {
        // Иначе теряем шар или жизнь
        if(balls.length > 1){
          const index = balls.indexOf(ball);
          if(index > -1){
            balls.splice(index, 1);
            ballTrails.delete(ball.id);
          }
        } else {
          loseLife();
        }
      }
    }
  }

  function moveBalls(now){
    for(const ball of balls){
      moveBall(ball, now);
    }
  }

  // Input: mouse, pointer, touch
  function pointerMove(clientX){
    if(paused || !running) return;
    const rect = canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    paddle.x = clamp(localX - paddle.width/2, 0, canvas.width - paddle.width);
  }

  canvas.addEventListener('pointerdown', e => pointerMove(e.clientX));
  canvas.addEventListener('pointermove', e => { if (e.buttons === 1) pointerMove(e.clientX); });
  canvas.addEventListener('touchstart', e => {
    if (e.touches && e.touches[0]) {
      pointerMove(e.touches[0].clientX);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (e.touches && e.touches[0]) {
      pointerMove(e.touches[0].clientX);
    }
  }, { passive: true });

  // Buttons
  restartBtn.addEventListener('click', () => { 
    if(modeSelect.value === 'infinite'){
      startInfiniteMode();
    } else {
      loadLevel(levelSelect.value || levelConfigs[0].value);
    }
  });
  
  pauseBtn.addEventListener('click', () => { 
    paused = !paused; 
    pauseBtn.textContent = paused ? 'Resume' : 'Pause'; 
  });
  
  muteBtn.addEventListener('click', () => { 
    muted = !muted; 
    muteBtn.textContent = muted ? 'Unmute' : 'Mute'; 
  });
  
  levelSelect.addEventListener('change', (e) => {
    const selectedLevel = e.target.value;
    if (selectedLevel) loadLevel(selectedLevel);
  });

  // Game loop
  let lastTime = 0;
  function loop(now){
    if (!lastTime) lastTime = now;
    const dt = now - lastTime;
    lastTime = now;

    if(!paused && running){
      // keyboard paddle control
      if (keys['ArrowLeft']) paddle.x = clamp(paddle.x - paddle.speed, 0, canvas.width - paddle.width);
      if (keys['ArrowRight']) paddle.x = clamp(paddle.x + paddle.speed, 0, canvas.width - paddle.width);
      
      // Обновление игры только в бесконечном режиме
      if(modeSelect.value === 'infinite'){
        // Проверяем увеличение скорости
        checkSpeedIncrease(now);
        
        updateBricks(now);
        updatePowerups();
        updateActivePowerups(now);
        updateBottomWallEffect(now);
        moveBalls(now);
        updateStatus();
      }
    }

    draw(now);

    if (running) requestAnimationFrame(loop);
  }

  // keyboard state
  const keys = {};
  window.addEventListener('keydown', e => { 
    keys[e.key] = true;
    // Пробел для запуска шара
    if(e.key === ' ' && balls.length === 1 && !paused && running){
      balls[0].dx = 4 * (Math.random() < 0.5 ? 1 : -1);
      balls[0].dy = -4;
    }
    // P для паузы
    if(e.key === 'p' || e.key === 'P'){
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    }
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

  // Функция загрузки уровня (заглушка)
  async function loadLevel(path){
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed ' + res.status);
      const data = await res.json();
      // ... реализация загрузки уровня ...
    } catch (err) {
      console.error('Level load error', err);
      // Обработка ошибок...
    }
  }

  // Init: resize, start infinite mode
  resizeCanvas();
  startInfiniteMode();
  lastTime = performance.now();
  running = true;
  requestAnimationFrame(loop);
})();