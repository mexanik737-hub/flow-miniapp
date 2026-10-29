// Глобальный тактильный отклик Telegram WebApp
function hapticFeedback(type = 'light') {
  if (!window.Telegram?.WebApp?.HapticFeedback) return;
  const hf = window.Telegram.WebApp.HapticFeedback;
  try {
    if (type === 'selection') {
      hf.selectionChanged();
    } else if (type === 'success' || type === 'error' || type === 'warning') {
      hf.notificationOccurred(type);
    } else {
      hf.impactOccurred(type); // 'light', 'medium', 'heavy', 'rigid', 'soft'
    }
  } catch (e) {}
}

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function initPhoneMask(id) {
  const input = document.getElementById(id);
  if (!input) return;

  input.addEventListener('input', (e) => {
    let val = input.value.replace(/\D/g, '');
    if (val.startsWith('7') || val.startsWith('8')) val = val.substring(1);

    let formatted = '8 (';
    if (val.length > 0) formatted += val.substring(0, 3);
    if (val.length >= 3) formatted += ') ' + val.substring(3, 6);
    if (val.length >= 6) formatted += '-' + val.substring(6, 8);
    if (val.length >= 8) formatted += '-' + val.substring(8, 10);

    input.value = formatted;
  });
}

initPhoneMask('reg-phone');
initPhoneMask('ord-rec-phone');
initPhoneMask('edit-prof-phone');

function toggleDropdown(boxId) {
  hapticFeedback('light');
  const box = document.getElementById(boxId);
  if (!box) return;
  const wasOpen = box.classList.contains('open');
  document.querySelectorAll('.custom-select-box').forEach(b => b.classList.remove('open'));
  if (!wasOpen) box.classList.add('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-box')) {
    document.querySelectorAll('.custom-select-box').forEach(b => b.classList.remove('open'));
  }
});

function toggleCheckbox(uiId) {
  hapticFeedback('light');
  const el = document.getElementById(uiId);
  if (!el) return;
  el.classList.toggle('checked');
  el.innerText = el.classList.contains('checked') ? '✓' : '';
}

function toggleCartAssemblyMode() {
  hapticFeedback('medium');
  isAssemblyMode = !isAssemblyMode;
  const chk = document.getElementById('cart-assembly-checkbox-ui');
  if (chk) {
    chk.classList.toggle('checked', isAssemblyMode);
    chk.innerText = isAssemblyMode ? '✓' : '';
  }
  renderCartItems();
  saveCartToStorage();
}

function toggleOrderSaveAddressCheckbox() {
  hapticFeedback('light');
  ordSaveAddrChecked = !ordSaveAddrChecked;
  const chk = document.getElementById('ord-save-addr-checkbox-ui');
  if (chk) {
    chk.classList.toggle('checked', ordSaveAddrChecked);
    chk.innerText = ordSaveAddrChecked ? '✓' : '';
  }
}

function calcHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseOrderDateToTs(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/(\d{2}):(\d{2})\s(\d{2})\.(\d{2})\.(\d{4})/);
  if (match) {
    const [_, h, m, day, mon, yr] = match;
    return new Date(yr, mon - 1, day, h, m).getTime();
  }
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? null : parsed;
}

function sortAscendingValues(arr) {
  return arr.sort((a, b) => {
    const numA = parseFloat(a.replace(/[^\d.]/g, ''));
    const numB = parseFloat(b.replace(/[^\d.]/g, ''));
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });
}

function updateNotificationsBadge() {
  const badge = document.getElementById('hud-notif-counter');
  if (!badge) return;

  const unreadCount = clientNotifications.filter(n => !readNotificationIds.includes(String(n.id))).length;
  if (unreadCount > 0) {
    badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function getTabDisplayTitle(tabKey) {
  switch (tabKey) {
    case 'catalog': return 'Каталог';
    case 'cart': return 'Корзина';
    case 'profile': return 'Профиль';
    case 'about': return 'О нас';
    default: return 'Каталог';
  }
}

// ----------------- ДВИЖОК ПАДАЮЩИХ ЛЕПЕСТКОВ С ГИРОСКОПОМ -----------------

const PetalsEngine = {
  canvas: null,
  ctx: null,
  petals: [],
  maxPetals: 24,
  animId: null,
  isRunning: false,
  tiltX: 0,

  init() {
    this.canvas = document.getElementById('petals-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Отслеживание наклона устройства (гироскоп: поворот влево/вправо)
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma !== null && e.gamma !== undefined) {
          // e.gamma от -90 до 90 градусов. Ограничиваем влияние ветра в пределах от -2.5 до 2.5
          this.tiltX = Math.max(-2.5, Math.min(2.5, e.gamma / 18));
        }
      }, { passive: true });
    }
  },

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  createPetal() {
    const w = this.canvas.width || 360;
    return {
      x: Math.random() * w,
      y: -20 - Math.random() * 40,
      size: 9 + Math.random() * 8,
      speedY: 1.1 + Math.random() * 1.5,
      speedX: (Math.random() - 0.5) * 0.8,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      oscillation: Math.random() * Math.PI,
      oscSpeed: 0.02 + Math.random() * 0.03,
      color: Math.random() > 0.4 ? 'rgba(225, 29, 72, 0.72)' : 'rgba(244, 63, 94, 0.65)'
    };
  },

  start() {
    if (!this.canvas) this.init();
    if (this.isRunning) return;
    this.isRunning = true;
    this.canvas.classList.add('active');

    if (!this.petals.length) {
      for (let i = 0; i < this.maxPetals; i++) {
        const p = this.createPetal();
        p.y = Math.random() * (this.canvas.height || 600);
        this.petals.push(p);
      }
    }
    this.loop();
  },

  stop() {
    if (!this.canvas) return;
    this.canvas.classList.remove('active');
    // Даем лепесткам плавно раствориться через transition opacity (800мс), затем глушим цикл
    setTimeout(() => {
      const isStillCartEmpty = !cart || Object.keys(cart).length === 0;
      if (isStillCartEmpty) {
        this.isRunning = false;
        if (this.animId) cancelAnimationFrame(this.animId);
        this.animId = null;
        if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }, 850);
  },

  drawPetal(p) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.bezierCurveTo(p.size * 0.8, -p.size * 0.6, p.size * 0.9, p.size * 0.6, 0, p.size);
    ctx.bezierCurveTo(-p.size * 0.9, p.size * 0.6, -p.size * 0.8, -p.size * 0.6, 0, -p.size);
    ctx.fill();

    ctx.restore();
  },

  loop() {
    if (!this.isRunning) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    this.petals.forEach(p => {
      p.oscillation += p.oscSpeed;
      p.rotation += p.rotSpeed;

      // Суммируем синусоидальное колебание, собственную скорость и наклон смартфона (ветер)
      p.x += p.speedX + Math.sin(p.oscillation) * 0.8 + this.tiltX;
      p.y += p.speedY;

      if (p.y > h + 20 || p.x < -30 || p.x > w + 30) {
        p.x = Math.random() * w;
        p.y = -20;
      }

      this.drawPetal(p);
    });

    this.animId = requestAnimationFrame(() => this.loop());
  }
};

window.PetalsEngine = PetalsEngine;
