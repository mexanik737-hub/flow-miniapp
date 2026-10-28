let cachedFaqData = null;

// ==================== ФИЗИКА ЛЕПЕСТКОВ РОЗ (CANVAS 2D + ГИРОСКОП) ====================
const PetalsEngine = {
  canvas: null,
  ctx: null,
  petals: [],
  maxPetals: 26,
  animId: null,
  isRunning: false,
  gravityX: 0,
  gravityY: 1.2,
  windAngle: 0,

  init() {
    this.canvas = document.getElementById('petals-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();

    window.addEventListener('resize', () => this.resize(), { passive: true });

    // Чтение гироскопа смартфона
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        // gamma: наклон влево/вправо (-90 ... 90)
        // beta: наклон вперед/назад (-180 ... 180)
        const gamma = e.gamma || 0;
        const beta = e.beta || 45;

        this.gravityX = Math.max(-2.5, Math.min(2.5, gamma / 18));
        this.gravityY = Math.max(0.4, Math.min(2.8, beta / 30));
      }, { passive: true });
    }

    // Приостановка отрисовки при скрытии вкладки для нулевой траты батареи
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.updateState();
      }
    });

    this.createPetals();
  },

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    if (this.ctx) this.ctx.scale(dpr, dpr);
  },

  createPetals() {
    this.petals = [];
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < this.maxPetals; i++) {
      this.petals.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 9 + Math.random() * 8,
        speed: 0.6 + Math.random() * 0.9,
        angle: Math.random() * Math.PI * 2,
        angularSpeed: (Math.random() - 0.5) * 0.03,
        flip: Math.random() * Math.PI,
        flipSpeed: 0.02 + Math.random() * 0.03,
        opacity: 0.4 + Math.random() * 0.45,
        colorIndex: Math.floor(Math.random() * 3)
      });
    }
  },

  drawPetal(p) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.scale(Math.cos(p.flip), 1);

    // Палитра бархатных лепестков роз (глубокий кармин, бордо и нежный рубин)
    let fill = 'rgba(225, 29, 72, ';
    if (p.colorIndex === 1) fill = 'rgba(190, 18, 60, ';
    if (p.colorIndex === 2) fill = 'rgba(244, 63, 94, ';

    ctx.fillStyle = fill + p.opacity + ')';
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.bezierCurveTo(p.size * 0.8, -p.size * 0.8, p.size * 0.9, p.size * 0.5, 0, p.size);
    ctx.bezierCurveTo(-p.size * 0.9, p.size * 0.5, -p.size * 0.8, -p.size * 0.8, 0, -p.size);
    ctx.fill();

    ctx.restore();
  },

  loop() {
    if (!this.isRunning) return;

    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);
    this.windAngle += 0.015;
    const wave = Math.sin(this.windAngle) * 0.4;

    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];

      p.x += this.gravityX + wave;
      p.y += (this.gravityY * p.speed);
      p.angle += p.angularSpeed;
      p.flip += p.flipSpeed;

      // Перенос за край экрана
      if (p.y > h + 20) {
        p.y = -20;
        p.x = Math.random() * w;
      } else if (p.y < -25) {
        p.y = h + 20;
      }

      if (p.x > w + 20) {
        p.x = -20;
      } else if (p.x < -20) {
        p.x = w + 20;
      }

      this.drawPetal(p);
    }

    this.animId = requestAnimationFrame(() => this.loop());
  },

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    if (this.canvas) this.canvas.classList.add('active');
    this.loop();
  },

  pause() {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
  },

  stop() {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.canvas) {
      this.canvas.classList.remove('active');
      const ctx = this.ctx;
      if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  },

  updateState() {
    const totalCount = Object.values(cart || {}).reduce((a, b) => a + b, 0);
    if (totalCount > 0) {
      this.start();
    } else {
      this.stop();
    }
  }
};

window.PetalsEngine = PetalsEngine;

// ==================== ТАБ-НАВИГАЦИЯ ====================
function navigateTab(screenId, btn) {
  hapticImpact('light');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.dock-tab').forEach(b => b.classList.remove('active'));
  
  const targetScreen = document.getElementById('screen-' + screenId);
  if (targetScreen) targetScreen.classList.add('active');

  if (!btn) {
    const tabs = document.querySelectorAll('.dock-tab');
    if (screenId === 'catalog' && tabs[0]) btn = tabs[0];
    if (screenId === 'cart' && tabs[1]) btn = tabs[1];
    if (screenId === 'profile' && tabs[2]) btn = tabs[2];
    if (screenId === 'about' && tabs[3]) btn = tabs[3];
  }

  if (btn) {
    btn.classList.add('active');
    btn.classList.add('spinning');
    setTimeout(() => btn.classList.remove('spinning'), 450);
  }

  if (screenId === 'profile') {
    renderSavedAddresses();
    loadUserOrders();
  }
  if (screenId === 'root') loadRootOrders(true);
}

function handleHudRootTap() {
  hapticSelect();
  if (currentUser && (currentUser.is_admin === false || String(currentUser.is_admin).toUpperCase() === 'FALSE' || String(currentUser.is_admin) === 'ЛОЖЬ')) {
    toast("Доступ запрещен администратором");
    return;
  }

  if (isAdmin) {
    navigateTab('root', null);
    return;
  }

  hudTapCount++;
  clearTimeout(hudTapTimer);
  hudTapTimer = setTimeout(() => { hudTapCount = 0; }, 2000);

  if (hudTapCount >= 5) {
    hudTapCount = 0;
    hapticImpact('medium');
    const pass = prompt("Код доступа Root:");
    if (pass) {
      sessionPasscode = pass.trim();
      fetch(`${API_URL}?action=admin_orders&admin_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            isAdmin = true;
            hapticNotify('success');
            toast("Доступ подтвержден");
            navigateTab('root', null);
          } else {
            sessionPasscode = "";
            hapticNotify('error');
            toast("Неверный код доступа");
          }
        })
        .catch(() => toast("Ошибка проверки"));
    }
  }
}

function toggleEditorFabVisibility(forceState = null) {
  hapticSelect();
  isFabVisible = (forceState !== null) ? forceState : !isFabVisible;
  const fab = document.getElementById('floating-editor-btn');
  fab.style.display = isFabVisible ? 'flex' : 'none';
  const chk = document.getElementById('root-toggle-editor-btn');
  chk.classList.toggle('checked', isFabVisible);
  chk.innerText = isFabVisible ? '✓' : '';

  if (!isFabVisible && isTextEditActive) {
    toggleTextEditingMode(false);
  }
}

async function loadConfig() {
  try {
    const res = await fetch(`${API_URL}?action=get_config`);
    const cfg = await res.json();
    SERVER_CONFIG = cfg;

    const sbpBtn = document.getElementById('pay-sbp-btn');
    if (sbpBtn && cfg.sbp_url) sbpBtn.href = cfg.sbp_url;

    const qrImg = document.getElementById('sbp-qr-image-tag');
    if (qrImg && cfg.sbp_qr) qrImg.src = cfg.sbp_qr;

    if (cfg.shop_phone_tel) {
      const telLink = 'tel:' + cfg.shop_phone_tel;
      const callBtn = document.getElementById('shop-call-btn');
      if (callBtn) callBtn.href = telLink;

      const asmBtn = document.getElementById('assembly-call-btn');
      if (asmBtn) {
        asmBtn.href = telLink;
        asmBtn.innerText = `📞 Позвонить в салон (${cfg.shop_phone || ''})`;
      }
    }

    if (cfg.store_lat && cfg.store_lon) {
      const mapIframe = document.getElementById('yandex-map-iframe');
      if (mapIframe) {
        mapIframe.src = `https://yandex.ru/map-widget/v1/?ll=${cfg.store_lon}%2C${cfg.store_lat}&z=16&pt=${cfg.store_lon},${cfg.store_lat},pm2rdm`;
      }
    }

    Object.keys(cfg).forEach(key => {
      document.querySelectorAll(`[data-config-key="${key}"]`).forEach(el => {
        el.innerText = cfg[key];
      });
    });
  } catch (e) {}
}

function toggleTextEditingMode(forcedState = null) {
  hapticImpact('medium');
  isTextEditActive = (forcedState !== null) ? forcedState : !isTextEditActive;
  const btn = document.getElementById('floating-editor-btn');
  btn.classList.toggle('active', isTextEditActive);
  btn.innerText = isTextEditActive ? '✓' : '✏️';
  document.body.classList.toggle('in-text-edit-mode', isTextEditActive);

  if (isTextEditActive) {
    toast("Режим редактирования: нажмите на любой выделенный текст");
  } else {
    toast("Режим редактирования выключен");
  }
}

document.addEventListener('click', async (e) => {
  if (!isTextEditActive) return;

  if (e.target.closest('#floating-editor-btn')) return;

  e.preventDefault();
  e.stopPropagation();

  const target = e.target.closest('[data-config-key]');
  if (!target) return;

  hapticSelect();
  const key = target.dataset.configKey;
  const curVal = target.innerText.trim();
  const newVal = prompt("Изменить текст:", curVal);

  if (newVal !== null && newVal.trim() !== "" && newVal.trim() !== curVal) {
    const cleanVal = newVal.trim();
    target.innerText = cleanVal;
    toast("Сохранение в таблицу...");
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: "admin_save_config",
          admin_id: userId,
          admin_passcode: sessionPasscode,
          key: key,
          value: cleanVal
        })
      });
      hapticNotify('success');
      toast("Текст сохранен!");
    } catch (err) {
      hapticNotify('error');
      toast("Ошибка сохранения");
    }
  }
}, true);

(function initDraggableFab() {
  const fab = document.getElementById('floating-editor-btn');
  if (!fab) return;
  let isDragging = false;
  let startX = 0, startY = 0;
  let initialLeft = 0, initialTop = 0;
  let hasMoved = false;
  let lastTouchTime = 0;

  function onStart(e) {
    if (e.type === 'mousedown' && Date.now() - lastTouchTime < 500) return;
    const point = e.touches ? e.touches[0] : e;
    isDragging = true;
    hasMoved = false;
    startX = point.clientX;
    startY = point.clientY;

    const rect = fab.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    fab.style.transition = 'none';
  }

  function onMove(e) {
    if (!isDragging) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startX;
    const dy = point.clientY - startY;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      hasMoved = true;
    }
    if (!hasMoved) return;

    let newLeft = Math.max(10, Math.min(window.innerWidth - 60, initialLeft + dx));
    let newTop = Math.max(10, Math.min(window.innerHeight - 70, initialTop + dy));

    fab.style.left = `${newLeft}px`;
    fab.style.top = `${newTop}px`;
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
  }

  function onEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    if (e.type === 'touchend') lastTouchTime = Date.now();
    fab.style.transition = 'border-color 0.2s ease, background 0.2s ease';

    if (!hasMoved) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      toggleTextEditingMode();
    }
  }

  fab.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  fab.addEventListener('touchend', onEnd, { passive: false });

  fab.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
})();

async function toggleAboutFaqSection() {
  hapticSelect();
  const container = document.getElementById('about-faq-container');
  const arrow = document.getElementById('faq-section-arrow');
  if (!container) return;

  const isHidden = window.getComputedStyle(container).display === 'none';

  if (!isHidden) {
    container.style.display = 'none';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
    return;
  }

  container.style.display = 'block';
  if (arrow) arrow.style.transform = 'rotate(180deg)';

  if (cachedFaqData) {
    renderFaqList(cachedFaqData);
    return;
  }

  container.innerHTML = `<div style="text-align:center; padding:12px; color:var(--text-muted); font-size:12px;">Загрузка вопросов...</div>`;

  try {
    const res = await fetch(`${API_URL}?action=faq`);
    cachedFaqData = await res.json();
    renderFaqList(cachedFaqData);
  } catch (e) {
    container.innerHTML = `<div style="text-align:center; padding:12px; color:var(--red); font-size:12px;">Ошибка загрузки FAQ</div>`;
  }
}

function renderFaqList(faq) {
  const container = document.getElementById('about-faq-container');
  if (!container) return;

  if (!faq || !faq.length) {
    container.innerHTML = `<div style="text-align:center; padding:12px; color:var(--text-muted); font-size:12px;">Нет доступных вопросов</div>`;
    return;
  }

  container.innerHTML = faq.map(f => `
    <div class="faq-pill-item" onclick="toggleFaqPill(this)">
      <div class="faq-pill-header">
        <span>${f.question}</span>
        <span>▼</span>
      </div>
      <div class="faq-pill-body">${f.answer}</div>
    </div>
  `).join('');
}

function toggleFaqPill(el) {
  hapticSelect();
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('.faq-pill-item').forEach(p => p.classList.remove('open'));
  if (!isOpen) el.classList.add('open');
}

function openYandexRoute() {
  hapticImpact('light');
  const url = SERVER_CONFIG.yandex_org_url || `https://yandex.ru/maps/org/tsvety/18169538769?si=w0t417tmmfzn5zadubrew3uker`;
  if (tg && tg.openLink) tg.openLink(url);
  else window.open(url, '_blank');
}

function contactSupport() {
  hapticImpact('light');
  const url = SERVER_CONFIG.support_url || "https://t.me/";
  if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}

// ==================== УВЕДОМЛЕНИЯ КЛИЕНТА ====================
async function loadNotifications() {
  try {
    const res = await fetch(`${API_URL}?action=get_notifications`);
    clientNotifications = await res.json();
    updateNotificationsBadge();
  } catch (e) {}
}

function openNotificationsModal() {
  hapticImpact('medium');
  const container = document.getElementById('notifications-list');
  if (!container) return;

  if (!clientNotifications.length) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px 0; font-size:12px;">Новых уведомлений нет</div>';
  } else {
    container.innerHTML = clientNotifications.map(n => {
      const isUnread = !readNotificationIds.includes(String(n.id));
      const targetTitle = getTabDisplayTitle(n.target_tab);

      return `
        <div class="notif-card-item ${isUnread ? 'unread' : ''}" onclick="clickNotificationItem('${n.id}', '${n.target_tab}')">
          <div class="notif-card-header">
            <span class="notif-card-title">${n.title}</span>
            <span class="notif-card-time">${n.created_at || ''}</span>
          </div>
          <div class="notif-card-text">${n.text}</div>
          <div class="notif-card-target-pill">Перейти ➔ ${targetTitle}</div>
        </div>
      `;
    }).join('');

    clientNotifications.forEach(n => {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: "track_stat", type: "notif_view", ref_id: String(n.id) })
      }).catch(() => {});
    });
  }

  document.getElementById('notifications-modal').classList.add('open');
}

function closeNotificationsModal() {
  hapticSelect();
  document.getElementById('notifications-modal').classList.remove('open');
}

function clickNotificationItem(id, targetTab) {
  hapticImpact('medium');
  const strId = String(id);
  if (!readNotificationIds.includes(strId)) {
    readNotificationIds.push(strId);
    localStorage.setItem('flw_read_notifs', JSON.stringify(readNotificationIds));
    updateNotificationsBadge();

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: "track_stat", type: "notif_read", ref_id: strId })
    }).catch(() => {});
  }

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "track_stat", type: "notif_click", ref_id: strId })
  }).catch(() => {});

  closeNotificationsModal();
  navigateTab(targetTab || 'catalog', null);
}

function markAllNotificationsAsRead() {
  hapticNotify('success');
  clientNotifications.forEach(n => {
    const strId = String(n.id);
    if (!readNotificationIds.includes(strId)) {
      readNotificationIds.push(strId);
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: "track_stat", type: "notif_read", ref_id: strId })
      }).catch(() => {});
    }
  });

  localStorage.setItem('flw_read_notifs', JSON.stringify(readNotificationIds));
  updateNotificationsBadge();
  openNotificationsModal();
  toast("Все уведомления прочитаны");
}

// Инициализация при старте
PetalsEngine.init();
loadCatalog();
checkUserSession();
loadConfig();
loadNotifications();
updateCartUI();

// Фоновое обновление каждые 3 минуты (180 000 мс)
setInterval(() => {
  const activeScreen = document.querySelector('.screen.active')?.id;
  if (activeScreen === 'screen-profile') {
    loadUserOrders();
  }
  if (activeScreen === 'screen-root' && isAdmin) {
    const secOrders = document.getElementById('root-sec-orders')?.style.display !== 'none';
    if (secOrders) loadRootOrders(false);
  }
  loadNotifications();
}, 180000);
