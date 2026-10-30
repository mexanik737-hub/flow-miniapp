// Тактильный отклик через Telegram WebApp API
function triggerHaptic(type = 'light') {
  try {
    if (!window.Telegram?.WebApp?.HapticFeedback) return;
    const hf = window.Telegram.WebApp.HapticFeedback;
    if (type === 'selection') {
      hf.selectionChanged();
    } else if (type === 'success' || type === 'error' || type === 'warning') {
      hf.notificationOccurred(type);
    } else {
      hf.impactOccurred(type);
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
window.toast = toast;

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
window.toggleDropdown = toggleDropdown;

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
window.toggleCheckbox = toggleCheckbox;

function toggleCartAssemblyMode() {
  triggerHaptic('medium');
  isAssemblyMode = !isAssemblyMode;
  const chk = document.getElementById('cart-assembly-checkbox-ui');
  if (chk) {
    chk.classList.toggle('checked', isAssemblyMode);
    chk.innerText = isAssemblyMode ? '✓' : '';
  }
  if (typeof renderCartItems === 'function') renderCartItems();
  if (typeof saveCartToStorage === 'function') saveCartToStorage();
}
window.toggleCartAssemblyMode = toggleCartAssemblyMode;

function toggleOrderSaveAddressCheckbox() {
  triggerHaptic('selection');
  ordSaveAddrChecked = !ordSaveAddrChecked;
  const chk = document.getElementById('ord-save-addr-checkbox-ui');
  if (chk) {
    chk.classList.toggle('checked', ordSaveAddrChecked);
    chk.innerText = ordSaveAddrChecked ? '✓' : '';
  }
}
window.toggleOrderSaveAddressCheckbox = toggleOrderSaveAddressCheckbox;

let ordSaveNextDefaultsChecked = false;
function toggleOrderSaveNextDefaultsCheckbox() {
  triggerHaptic('selection');
  ordSaveNextDefaultsChecked = !ordSaveNextDefaultsChecked;
  const chk = document.getElementById('ord-save-next-defaults-ui');
  if (chk) {
    chk.classList.toggle('checked', ordSaveNextDefaultsChecked);
    chk.innerText = ordSaveNextDefaultsChecked ? '✓' : '';
  }
}
window.toggleOrderSaveNextDefaultsCheckbox = toggleOrderSaveNextDefaultsCheckbox;

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

  const userRegTs = currentUser?.reg_date_ts || 0;

  // Показываем уведомления только созданные ПОСЛЕ регистрации клиента
  const unreadCount = (clientNotifications || []).filter(n => {
    const isUnread = !(readNotificationIds || []).includes(String(n.id));
    const isAfterReg = !userRegTs || (n.created_at_ts >= userRegTs);
    return isUnread && isAfterReg;
  }).length;

  if (unreadCount > 0) {
    badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}
window.updateNotificationsBadge = updateNotificationsBadge;

function getTabDisplayTitle(tabKey) {
  switch (tabKey) {
    case 'catalog': return 'Каталог';
    case 'cart': return 'Корзина';
    case 'profile': return 'Профиль';
    case 'about': return 'О нас';
    default: return 'Каталог';
  }
}

// ----------------- МЕХАНИКА №1: ТОВАР ДНЯ (ОТСЕЧКА СТРОГО В 09:00 ПО МСК) -----------------

function getDailyBloomDateKey() {
  const now = new Date();
  // Вычисляем точное московское время (UTC+3) независимо от часового пояса устройства
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const mskDate = new Date(utc + (3 * 3600000));

  // Сутки меняются строго в 09:00:00 МСК
  if (mskDate.getHours() < 9) {
    mskDate.setDate(mskDate.getDate() - 1);
  }
  const yr = mskDate.getFullYear();
  const mo = String(mskDate.getMonth() + 1).padStart(2, '0');
  const day = String(mskDate.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${day}`;
}

function getDailyBloomItem(itemsList, currentUid) {
  try {
    if (!itemsList || !itemsList.length) return null;

    let activeItems = itemsList.filter(it => it.is_active);
    if (!activeItems.length) activeItems = itemsList;

    // Фильтр по разрешённым категориям из настроек Root (SERVER_CONFIG.daily_bloom_categories)
    const allowedCatsStr = SERVER_CONFIG?.daily_bloom_categories || "";
    if (allowedCatsStr) {
      const allowedCats = allowedCatsStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (allowedCats.length > 0) {
        const filteredByCat = activeItems.filter(it => allowedCats.includes((it.category || "").trim().toLowerCase()));
        if (filteredByCat.length > 0) {
          activeItems = filteredByCat;
        }
      }
    }

    const dateKey = getDailyBloomDateKey();
    const seedString = `${currentUid || 'client'}_${dateKey}`;

    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % activeItems.length;
    return activeItems[index];
  } catch (err) {
    return itemsList && itemsList[0] ? itemsList[0] : null;
  }
}
window.getDailyBloomItem = getDailyBloomItem;

// ----------------- МЕХАНИКА №2: ЛЕПЕСТКИ РОЗ С ГИРОСКОПОМ (IOS + ANDROID) -----------------

let petalsCanvas = null;
let petalsCtx = null;
let petalsAnimationId = null;
let isPetalsActive = false;
let petalsList = [];
let tiltHorizontal = 0;
let iosPermissionRequested = false;

class RosePetal {
  constructor(w, h, randomY = false) {
    this.reset(w, h, randomY);
  }

  reset(w, h, randomY = false) {
    this.w = w || window.innerWidth || 360;
    this.h = h || window.innerHeight || 640;
    this.x = Math.random() * this.w;
    this.y = randomY ? Math.random() * this.h : -30 - Math.random() * 40;
    this.size = 13 + Math.random() * 15;
    this.speedY = 1.2 + Math.random() * 1.5;
    this.speedX = (Math.random() - 0.5) * 0.8;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.035;
    this.flip = Math.random() * Math.PI;
    this.flipSpeed = 0.02 + Math.random() * 0.03;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.025 + Math.random() * 0.03;
    this.opacity = 0.6 + Math.random() * 0.3;

    const petalColors = [
      { r: 214, g: 40, b: 75 },
      { r: 235, g: 65, b: 95 },
      { r: 175, g: 25, b: 60 },
      { r: 244, g: 114, b: 135 },
      { r: 190, g: 30, b: 65 }
    ];
    this.color = petalColors[Math.floor(Math.random() * petalColors.length)];
  }

  update(w, h, tilt) {
    this.wobble += this.wobbleSpeed;
    this.rotation += this.rotationSpeed;
    this.flip += this.flipSpeed;

    const gyroShift = (tilt || 0) * 0.055;
    this.x += this.speedX + Math.sin(this.wobble) * 1.1 + gyroShift;
    this.y += this.speedY;

    if (this.y > h + 40 || this.x < -60 || this.x > w + 60) {
      this.reset(w, h, false);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(Math.cos(this.flip), 1);

    ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacity})`;
    ctx.beginPath();
    ctx.moveTo(0, -this.size * 0.75);
    ctx.bezierCurveTo(this.size * 0.65, -this.size * 0.6, this.size * 0.75, this.size * 0.45, 0, this.size * 0.85);
    ctx.bezierCurveTo(-this.size * 0.75, this.size * 0.45, -this.size * 0.65, -this.size * 0.6, 0, -this.size * 0.75);
    ctx.fill();

    ctx.strokeStyle = `rgba(245, 224, 160, ${this.opacity * 0.25})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}

function handleOrientation(e) {
  if (e && e.gamma !== null && e.gamma !== undefined) {
    tiltHorizontal = Math.max(-40, Math.min(40, e.gamma));
  }
}

// Запрос доступа к датчикам движения на iOS
async function requestIosOrientationPermission() {
  if (iosPermissionRequested) return;
  iosPermissionRequested = true;

  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    } catch (e) {}
  }
}
window.requestIosOrientationPermission = requestIosOrientationPermission;

function resizePetalsCanvas() {
  if (!petalsCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // Ограничение 2 для 120 FPS
  petalsCanvas.width = (window.innerWidth || 360) * dpr;
  petalsCanvas.height = (window.innerHeight || 640) * dpr;
  if (petalsCtx) {
    petalsCtx.scale(dpr, dpr);
  }
}

function animatePetals() {
  if (!isPetalsActive || !petalsCtx || !petalsCanvas) return;
  const w = window.innerWidth || 360;
  const h = window.innerHeight || 640;

  petalsCtx.clearRect(0, 0, w, h);

  for (let i = 0; i < petalsList.length; i++) {
    petalsList[i].update(w, h, tiltHorizontal);
    petalsList[i].draw(petalsCtx);
  }

  petalsAnimationId = requestAnimationFrame(animatePetals);
}

function startCartPetals() {
  try {
    petalsCanvas = document.getElementById('cart-petals-canvas');
    if (!petalsCanvas) return;
    if (isPetalsActive) return;

    petalsCtx = petalsCanvas.getContext('2d');
    if (!petalsCtx) return;

    isPetalsActive = true;
    resizePetalsCanvas();
    window.addEventListener('resize', resizePetalsCanvas);

    petalsList = [];
    const w = window.innerWidth || 360;
    const h = window.innerHeight || 640;
    for (let i = 0; i < 26; i++) {
      petalsList.push(new RosePetal(w, h, true));
    }

    if (window.DeviceOrientationEvent) {
      if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    }
    petalsCanvas.classList.add('active');
    animatePetals();
  } catch (e) {}
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
  }, 650);
}
window.stopCartPetals = stopCartPetals;

// ----------------- МЕХАНИКА №3: САЛЮТ КОНФЕТТИ ПРИ ОПЛАТЕ -----------------

let confettiCanvas = null;
let confettiCtx = null;
let confettiAnimId = null;
let confettiParticles = [];

class ConfettiParticle {
  constructor(w, h) {
    this.x = Math.random() * w;
    this.y = -20 - Math.random() * 50;
    this.size = 7 + Math.random() * 8;
    this.speedY = 3.5 + Math.random() * 4.5;
    this.speedX = (Math.random() - 0.5) * 4;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * 8;
    this.color = ['#d4af37', '#f5e0a0', '#0d9468', '#ef4444', '#8b5cf6', '#ffffff'][Math.floor(Math.random() * 6)];
  }

  update(w, h) {
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.6);
    ctx.restore();
  }
}

function startConfettiAnimation() {
  confettiCanvas = document.getElementById('confetti-canvas');
  if (!confettiCanvas) return;

  confettiCtx = confettiCanvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  confettiCanvas.width = w * dpr;
  confettiCanvas.height = h * dpr;
  confettiCtx.scale(dpr, dpr);
  confettiCanvas.style.display = 'block';

  confettiParticles = [];
  for (let i = 0; i < 90; i++) {
    confettiParticles.push(new ConfettiParticle(w, h));
  }

  triggerHaptic('success');

  const startTime = Date.now();
  function loop() {
    confettiCtx.clearRect(0, 0, w, h);
    for (let p of confettiParticles) {
      p.update(w, h);
      p.draw(confettiCtx);
    }
    if (Date.now() - startTime < 3500) {
      confettiAnimId = requestAnimationFrame(loop);
    } else {
      stopConfettiAnimation();
    }
  }
  loop();
}
window.startConfettiAnimation = startConfettiAnimation;

function stopConfettiAnimation() {
  if (confettiAnimId) {
    cancelAnimationFrame(confettiAnimId);
    confettiAnimId = null;
  }
  if (confettiCanvas) {
    confettiCanvas.style.display = 'none';
    if (confettiCtx) confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}
window.stopConfettiAnimation = stopConfettiAnimation;
