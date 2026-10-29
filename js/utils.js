// Тактильный отклик через Telegram WebApp API
function triggerHaptic(type = 'light') {
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
window.triggerHaptic = triggerHaptic;

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.classList.add('show');
  triggerHaptic('light');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function initPhoneMask(id) {
  const input = document.getElementById(id);
  if (!input) return;

  input.addEventListener('input', () => {
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
  const box = document.getElementById(boxId);
  if (!box) return;
  triggerHaptic('selection');
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
  const el = document.getElementById(uiId);
  if (!el) return;
  triggerHaptic('medium');
  el.classList.toggle('checked');
  el.innerText = el.classList.contains('checked') ? '✓' : '';
}

function toggleCartAssemblyMode() {
  triggerHaptic('medium');
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
  triggerHaptic('selection');
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
  const match = String(dateStr).match(/(\d{2}):(\d{2})\s(\d{2})\.(\d{4})/);
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

// ----------------- МЕХАНИКА №1: БУКЕТ ДНЯ (ОТСЕЧКА СТРОГО В 09:00) -----------------

function getDailyBloomDateKey() {
  const now = new Date();
  const d = new Date(now);
  // Если сейчас раньше 09:00 утра — используется дата предыдущего дня (смена в 09:00)
  if (d.getHours() < 9) {
    d.setDate(d.getDate() - 1);
  }
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${day}`;
}

function getDailyBloomItem(itemsList, currentUid) {
  if (!itemsList || !itemsList.length) return null;
  const activeItems = itemsList.filter(it => it.is_active);
  if (!activeItems.length) return itemsList[0];

  const dateKey = getDailyBloomDateKey();
  const seedString = `${currentUid || 'client'}_${dateKey}`;

  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % activeItems.length;
  return activeItems[index];
}
window.getDailyBloomItem = getDailyBloomItem;

// ----------------- МЕХАНИКА №2: ЛЕПЕСТКИ РОЗ С ГИРОСКОПОМ -----------------

let petalsCanvas = null;
let petalsCtx = null;
let petalsAnimationId = null;
let isPetalsActive = false;
let petalsList = [];
let tiltHorizontal = 0; // Наклон по горизонтали из гироскопа

class RosePetal {
  constructor(w, h, randomY = false) {
    this.reset(w, h, randomY);
  }

  reset(w, h, randomY = false) {
    this.x = Math.random() * w;
    this.y = randomY ? Math.random() * h : -20 - Math.random() * 40;
    this.size = 12 + Math.random() * 14;
    this.speedY = 1.2 + Math.random() * 1.6;
    this.speedX = (Math.random() - 0.5) * 0.8;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.04;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.03 + Math.random() * 0.03;
    this.opacity = 0.55 + Math.random() * 0.35;

    // Градиенты лепестков роз: бархатно-красные и персиково-розовые оттенки
    const petalColors = [
      { r: 225, g: 29, b: 72 },
      { r: 244, g: 63, b: 94 },
      { r: 190, g: 18, b: 60 },
      { r: 251, g: 113, b: 133 }
    ];
    this.color = petalColors[Math.floor(Math.random() * petalColors.length)];
  }

  update(w, h, tilt) {
    this.wobble += this.wobbleSpeed;
    this.rotation += this.rotationSpeed;

    // Горизонтальный дрейф с учётом наклона телефона
    const gyroForce = tilt * 0.045;
    this.x += this.speedX + Math.sin(this.wobble) * 0.8 + gyroForce;
    this.y += this.speedY;

    if (this.y > h + 30 || this.x < -40 || this.x > w + 40) {
      this.reset(w, h, false);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacity})`;

    // Отрисовка формы органического лепестка розы
    ctx.beginPath();
    ctx.moveTo(0, -this.size * 0.7);
    ctx.bezierCurveTo(this.size * 0.6, -this.size * 0.6, this.size * 0.8, this.size * 0.4, 0, this.size * 0.8);
    ctx.bezierCurveTo(-this.size * 0.8, this.size * 0.4, -this.size * 0.6, -this.size * 0.6, 0, -this.size * 0.7);
    ctx.fill();
    ctx.restore();
  }
}

function handleOrientation(e) {
  if (e.gamma !== null && e.gamma !== undefined) {
    // Ограничиваем угол наклона от -40 до +40 градусов
    tiltHorizontal = Math.max(-40, Math.min(40, e.gamma));
  }
}

function resizePetalsCanvas() {
  if (!petalsCanvas) return;
  petalsCanvas.width = window.innerWidth;
  petalsCanvas.height = window.innerHeight;
}

function animatePetals() {
  if (!isPetalsActive || !petalsCtx || !petalsCanvas) return;
  const w = petalsCanvas.width;
  const h = petalsCanvas.height;

  petalsCtx.clearRect(0, 0, w, h);

  for (let i = 0; i < petalsList.length; i++) {
    petalsList[i].update(w, h, tiltHorizontal);
    petalsList[i].draw(petalsCtx);
  }

  petalsAnimationId = requestAnimationFrame(animatePetals);
}

function startCartPetals() {
  petalsCanvas = document.getElementById('cart-petals-canvas');
  if (!petalsCanvas) return;

  if (isPetalsActive) return;
  isPetalsActive = true;

  petalsCtx = petalsCanvas.getContext('2d');
  resizePetalsCanvas();
  window.addEventListener('resize', resizePetalsCanvas);

  // Инициализация 26 лепестков (баланс плотности и плавной работы в 60 FPS)
  petalsList = [];
  for (let i = 0; i < 26; i++) {
    petalsList.push(new RosePetal(petalsCanvas.width, petalsCanvas.height, true));
  }

  window.addEventListener('deviceorientation', handleOrientation, true);
  petalsCanvas.classList.add('active');
  animatePetals();
}
window.startCartPetals = startCartPetals;

function stopCartPetals() {
  if (!isPetalsActive) return;
  isPetalsActive = false;

  const canvas = document.getElementById('cart-petals-canvas');
  if (canvas) canvas.classList.remove('active');

  if (petalsAnimationId) {
    cancelAnimationFrame(petalsAnimationId);
    petalsAnimationId = null;
  }

  window.removeEventListener('deviceorientation', handleOrientation, true);
  window.removeEventListener('resize', resizePetalsCanvas);

  setTimeout(() => {
    if (!isPetalsActive && petalsCtx && petalsCanvas) {
      petalsCtx.clearRect(0, 0, petalsCanvas.width, petalsCanvas.height);
    }
  }, 850);
}
window.stopCartPetals = stopCartPetals;
