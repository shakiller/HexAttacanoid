// Инициализация индикаторов бонусов - ИСПРАВЛЕННАЯ ВЕРСИЯ
function initializePowerupIndicators() {
    // Создаем индикаторы для каждого типа бонуса с длительностью
    const durationPowerups = Object.values(POWERUP_TYPES).filter(p => p.duration);
    
    powerupIndicatorsEl.innerHTML = '';
    powerupIndicatorsEl.style.display = 'flex';
    powerupIndicatorsEl.style.flexDirection = 'column';
    powerupIndicatorsEl.style.gap = '8px';
    powerupIndicatorsEl.style.margin = '10px 0';
    powerupIndicatorsEl.style.padding = '12px';
    powerupIndicatorsEl.style.background = 'rgba(0,0,0,0.7)';
    powerupIndicatorsEl.style.borderRadius = '10px';
    powerupIndicatorsEl.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';
    powerupIndicatorsEl.style.minHeight = '60px';
    
    // Добавляем заголовок
    const title = document.createElement('div');
    title.textContent = 'Активные бонусы:';
    title.style.cssText = `
      color: #fff;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 8px;
      text-align: center;
      opacity: 0.9;
    `;
    powerupIndicatorsEl.appendChild(title);
    
    // Создаем контейнер для индикаторов
    const indicatorsContainer = document.createElement('div');
    indicatorsContainer.id = 'indicatorsContainer';
    indicatorsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;
    powerupIndicatorsEl.appendChild(indicatorsContainer);
    
    // Если нет активных бонусов, показываем сообщение
    const noActiveMessage = document.createElement('div');
    noActiveMessage.id = 'noActiveMessage';
    noActiveMessage.textContent = 'Нет активных бонусов';
    noActiveMessage.style.cssText = `
      color: rgba(255,255,255,0.6);
      font-family: Arial, sans-serif;
      font-size: 14px;
      text-align: center;
      padding: 10px;
      font-style: italic;
    `;
    indicatorsContainer.appendChild(noActiveMessage);
    
    // Создаем индикаторы для каждого типа бонуса (изначально видимые, но пустые)
    durationPowerups.forEach(powerupType => {
      const indicator = document.createElement('div');
      indicator.id = `indicator-${powerupType.id}`;
      indicator.className = 'powerup-indicator';
      indicator.style.cssText = `
        display: none; /* Сначала скрыты */
        background: rgba(255,255,255,0.1);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.3);
        font-family: Arial, sans-serif;
        font-size: 14px;
        text-align: left;
        min-height: 40px;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      
      // Внутренняя структура индикатора
      indicator.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px;">${powerupType.icon}</span>
            <span>${powerupType.name}</span>
          </div>
          <div id="time-${powerupType.id}" style="
            background: rgba(0,0,0,0.5);
            padding: 4px 8px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
            min-width: 50px;
            text-align: center;
          ">0.0с</div>
        </div>
        <div style="margin-top: 6px;">
          <div id="progress-${powerupType.id}" style="
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.2);
            border-radius: 2px;
            overflow: hidden;
          ">
            <div id="progress-bar-${powerupType.id}" style="
              width: 0%;
              height: 100%;
              background: ${powerupType.indicatorColor};
              transition: width 0.3s ease;
            "></div>
          </div>
        </div>
      `;
      
      indicatorsContainer.appendChild(indicator);
    });
  }

  // Обновляем конкретный индикатор бонуса - ИСПРАВЛЕННАЯ ВЕРСИЯ
  function updatePowerupIndicator(powerupId) {
    const indicator = document.getElementById(`indicator-${powerupId}`);
    const timeElement = document.getElementById(`time-${powerupId}`);
    const progressBar = document.getElementById(`progress-bar-${powerupId}`);
    const powerupType = POWERUP_TYPES[powerupId];
    const noActiveMessage = document.getElementById('noActiveMessage');
    
    if (!indicator || !powerupType) return;
    
    const effect = activeEffects.get(powerupId);
    
    if (effect) {
      // Бонус активен - скрываем сообщение "Нет активных бонусов"
      if (noActiveMessage) noActiveMessage.style.display = 'none';
      
      // Показываем индикатор с анимацией
      indicator.style.display = 'block';
      setTimeout(() => {
        indicator.style.opacity = '1';
      }, 10);
      
      const now = performance.now();
      const elapsed = now - effect.startTime;
      const remaining = Math.max(0, powerupType.duration - elapsed);
      const progress = Math.max(0, Math.min(100, (remaining / powerupType.duration) * 100));
      const timeText = `${(remaining / 1000).toFixed(1)}с`;
      
      // Обновляем время
      if (timeElement) timeElement.textContent = timeText;
      
      // Обновляем прогресс-бар
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.style.background = powerupType.indicatorColor;
      }
      
      // Обновляем фоновый цвет индикатора
      indicator.style.background = `linear-gradient(90deg, ${powerupType.indicatorColor}40, ${powerupType.indicatorColor}20)`;
      indicator.style.borderColor = powerupType.indicatorColor;
      indicator.style.boxShadow = `0 2px 5px ${powerupType.indicatorColor}40`;
    } else {
      // Бонус не активен - скрываем индикатор с анимацией
      indicator.style.opacity = '0';
      setTimeout(() => {
        indicator.style.display = 'none';
      }, 300);
      
      // Проверяем, есть ли другие активные бонусы
      const hasActivePowerups = Array.from(activeEffects.keys()).some(id => 
        POWERUP_TYPES[id] && POWERUP_TYPES[id].duration
      );
      
      // Если нет активных бонусов, показываем сообщение
      if (noActiveMessage && !hasActivePowerups) {
        noActiveMessage.style.display = 'block';
      }
    }
  }

  // Обновляем все индикаторы бонусов - ИСПРАВЛЕННАЯ ВЕРСИЯ
  function updateAllPowerupIndicators() {
    const durationPowerups = Object.values(POWERUP_TYPES).filter(p => p.duration);
    const noActiveMessage = document.getElementById('noActiveMessage');
    
    // Проверяем, есть ли активные бонусы
    const hasActivePowerups = Array.from(activeEffects.keys()).some(id => 
      POWERUP_TYPES[id] && POWERUP_TYPES[id].duration
    );
    
    // Управляем сообщением "Нет активных бонусов"
    if (noActiveMessage) {
      if (hasActivePowerups) {
        noActiveMessage.style.display = 'none';
      } else {
        noActiveMessage.style.display = 'block';
      }
    }
    
    // Обновляем каждый индикатор
    durationPowerups.forEach(powerupType => {
      updatePowerupIndicator(powerupType.id);
    });
  }