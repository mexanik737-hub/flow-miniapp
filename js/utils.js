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

// Эффект глубины витрины: отслеживает открытые модалки и масштабирует фон
function syncModalDepthState() {
  const hasOpenModal = !!document.querySelector('.modal-overlay.open');
  if (hasOpenModal) {
    document.body.classList.add('modal-open-blur');
  } else {
    document.body.classList.remove('modal-open-blur');
  }
}
window.syncModalDepthState = syncModalDepthState;

const modalDepthObserver = new MutationObserver(() => {
  syncModalDepthState();
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(el => {
    modalDepthObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
  });
});

// Анимация полета лепестка из точки нажатия в корзину
function animateFlyToCart(sourceEventOrElement) {
  try {
    let startX = window.innerWidth / 2;
    let startY = window.innerHeight / 2;

    if (sourceEventOrElement) {
      if (sourceEventOrElement.touches && sourceEventOrElement.touches[0]) {
        startX = sourceEventOrElement.touches[0].clientX;
        startY = sourceEventOrElement.touches[0].clientY;
      } else if (sourceEventOrElement.clientX && sourceEventOrElement.clientY) {
        startX = sourceEventOrElement.clientX;
        startY = sourceEventOrElement.clientY;
      } else if (sourceEventOrElement.target) {
        const rect = sourceEventOrElement.target.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
      } else if (sourceEventOrElement.getBoundingClientRect) {
        const rect = sourceEventOrElement.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
      }
    }

    const cartTab = document.querySelectorAll('.dock-pill .dock-tab')[1];
    let targetX = window.innerWidth * 0.38;
    let targetY = window.innerHeight - 38;

    if (cartTab) {
      const rect = cartTab.getBoundingClientRect();
      targetX = rect.left + rect.width / 2;
      targetY = rect.top + rect.height / 2;
    }

    const petal = document.createElement('div');
    petal.className = 'flying-cart-petal';
    petal.style.transform = `translate3d(${startX}px, ${startY}px, 0) scale(0.6) rotate(0deg)`;
    petal.style.opacity = '1';
    document.body.appendChild(petal);

    const deltaX = targetX - startX;
    const deltaY = targetY - startY;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        petal.style.transform = `translate3d(${startX + deltaX}px, ${startY + deltaY}px, 0) scale(1.15) rotate(260deg)`;
        petal.style.opacity = '0.1';
      });
    });

    setTimeout(() => {
      petal.remove();
      if (typeof triggerCartCounterBounce === 'function') {
        triggerCartCounterBounce();
      }
      triggerHaptic('medium');
    }, 640);
  } catch (err) {
    if (typeof triggerCartCounterBounce === 'function') triggerCartCounterBounce();
  }
}
window.animateFlyToCart = animateFlyToCart;

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

  const userRegDateTs = currentUser?.reg_date ? parseRuDateToTimestamp(currentUser.reg_date) : 0;

  const unreadCount = (clientNotifications || []).filter(n => {
    const notifTs = parseOrderDateToTs(n.created_at) || 0;
    if (userRegDateTs > 0 && notifTs > 0 && notifTs < userRegDateTs) {
      return false; // Скрываем старые уведомления, выпущенные до дня регистрации клиента
    }
    return !(readNotificationIds || []).includes(String(n.id));
  }).length;

  if (unreadCount > 0) {
    badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}
window.updateNotificationsBadge = updateNotificationsBadge;

function parseRuDateToTimestamp(dateStr) {
  if (!dateStr) return 0;
  const parts = String(dateStr).split('.');
  if (parts.length === 3) {
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
  }
  return 0;
}
window.parseRuDateToTimestamp = parseRuDateToTimestamp;

function getTabDisplayTitle(tabKey) {
  switch (tabKey) {
    case 'catalog': return 'Каталог';
    case 'cart': return 'Корзина';
    case 'profile': return 'Профиль';
    case 'about': return 'О нас';
    default: return 'Каталог';
  }
}

// ----------------- МЕХАНИКА: ТОВАР ДНЯ (ОТСЕЧКА СТРОГО В 09:00 ПО МСК) -----------------

function getMskDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3 * 3600000)); // Фиксация Московского времени UTC+3
}

function getDailyBloomDateKey() {
  const msk = getMskDate();
  if (msk.getHours() < 9) {
    msk.setDate(msk.getDate() - 1);
  }
  const yr = msk.getFullYear();
  const mo = String(msk.getMonth() + 1).padStart(2, '0');
  const day = String(msk.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${day}`;
}

function getDailyBloomItem(itemsList, currentUid) {
  try {
    if (!itemsList || !itemsList.length) return null;

    // Сверяем категории, настроенные в Root для Товара дня
    let allowedCategories = [];
    if (SERVER_CONFIG && SERVER_CONFIG.daily_bloom_categories) {
      try {
        allowedCategories = typeof SERVER_CONFIG.daily_bloom_categories === 'string'
          ? JSON.parse(SERVER_CONFIG.daily_bloom_categories)
          : SERVER_CONFIG.daily_bloom_categories;
      } catch (e) {}
    }

    let activeItems = itemsList.filter(it => it.is_active);
    if (allowedCategories && allowedCategories.length > 0) {
      const filteredByCat = activeItems.filter(it => allowedCategories.includes(it.category));
      if (filteredByCat.length > 0) {
        activeItems = filteredByCat;
      }
    }

    const pool = activeItems.length ? activeItems : itemsList;
    if (!pool.length) return null;

    const dateKey = getDailyBloomDateKey();
    const seedString = `${currentUid || 'client'}_${dateKey}`;

    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % pool.length;
    return pool[index];
  } catch (err) {
    return itemsList && itemsList[0] ? itemsList[0] : null;
  }
}
window.getDailyBloomItem = getDailyBloomItem;

// ----------------- МЕХАНИКА: ЛЕПЕСТКИ РОЗ В КОРЗИНЕ С ГИРОСКОПОМ -----------------

let petalsCanvas = null;
let petalsCtx = null;
let petalsAnimationId = null;
let isPetalsActive = false;
let petalsList = [];
let tiltHorizontal = 0;

class RosePetal {
  constructor(w, h, randomY = false) {
    this.reset(w, h, randomY);
  }

  reset(w, h, randomY = false) {
    this.w = w || window.innerWidth || 360;
    this.h = h || window.innerHeight || 640;
    this.x = Math.random() * this.w;
    this.y = randomY ? Math.random() * this.h : -30 - Math.random() * 40;
    this.size = 14 + Math.random() * 16;
    this.speedY = 1.3 + Math.random() * 1.7;
    this.speedX = (Math.random() - 0.5) * 0.9;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.035;
    this.flip = Math.random() * Math.PI;
    this.flipSpeed = 0.02 + Math.random() * 0.03;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.025 + Math.random() * 0.03;
    this.opacity = 0.65 + Math.random() * 0.3;

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

    const gyroShift = (tilt || 0) * 0.05;
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

    ctx.strokeStyle = `rgba(253, 237, 184, ${this.opacity * 0.28})`;
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

function resizePetalsCanvas() {
  if (!petalsCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  petalsCanvas.width = (window.innerWidth || document.documentElement.clientWidth || 360) * dpr;
  petalsCanvas.height = (window.innerHeight || document.documentElement.clientHeight || 640) * dpr;
  if (petalsCtx) {
    petalsCtx.scale(dpr, dpr);
  }
}

function animatePetals() {
  if (!isPetalsActive || !petalsCtx || !petalsCanvas) return;
  const w = window.innerWidth || document.documentElement.clientWidth || 360;
  const h = window.innerHeight || document.documentElement.clientHeight || 640;

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
    const w = window.innerWidth || document.documentElement.clientWidth || 360;
    const h = window.innerHeight || document.documentElement.clientHeight || 640;
    for (let i = 0; i < 28; i++) {
      petalsList.push(new RosePetal(w, h, true));
    }

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
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

// ----------------- МЕХАНИКА: АНИМАЦИЯ КОНФЕТТИ ПРИ ОПЛАТЕ -----------------

let confettiCanvas = null;
let confettiCtx = null;
let confettiAnimationId = null;
let confettiList = [];
let confettiStartTime = 0;

class ConfettiParticle {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.x = w / 2 + (Math.random() - 0.5) * 80;
    this.y = h * 0.45;
    const angle = Math.random() * Math.PI * 2;
    const speed = 7 + Math.random() * 11;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 5;
    this.gravity = 0.35;
    this.friction = 0.96;
    this.size = 7 + Math.random() * 8;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * 16;
    this.opacity = 1;

    const colors = ['#e5c158', '#fdedb8', '#0d9f67', '#f43f5e', '#38bdf8', '#a855f7'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    this.vx *= this.friction;
    this.vy = (this.vy + this.gravity) * this.friction;
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotationSpeed;
    if (this.y > this.h * 0.6) {
      this.opacity -= 0.018;
    }
  }

  draw(ctx) {
    if (this.opacity <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.globalAlpha = Math.max(0, this.opacity);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.6);
    ctx.restore();
  }
}

function startConfettiAnimation() {
  confettiCanvas = document.getElementById('confetti-canvas');
  if (!confettiCanvas) return;
  confettiCtx = confettiCanvas.getContext('2d');
  if (!confettiCtx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  confettiCanvas.width = w * dpr;
  confettiCanvas.height = h * dpr;
  confettiCtx.scale(dpr, dpr);

  confettiList = [];
  for (let i = 0; i < 90; i++) {
    confettiList.push(new ConfettiParticle(w, h));
  }

  confettiCanvas.classList.add('active');
  confettiStartTime = Date.now();
  triggerHaptic('success');

  function loop() {
    const elapsed = Date.now() - confettiStartTime;
    confettiCtx.clearRect(0, 0, w, h);

    confettiList.forEach(p => {
      p.update();
      p.draw(confettiCtx);
    });

    if (elapsed < 4200) {
      confettiAnimationId = requestAnimationFrame(loop);
    } else {
      stopConfettiAnimation();
    }
  }

  if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
  confettiAnimationId = requestAnimationFrame(loop);
}
window.startConfettiAnimation = startConfettiAnimation;

function stopConfettiAnimation() {
  if (confettiAnimationId) {
    cancelAnimationFrame(confettiAnimationId);
    confettiAnimationId = null;
  }
  if (confettiCanvas) {
    confettiCanvas.classList.remove('active');
    if (confettiCtx) {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }
}
window.stopConfettiAnimation = stopConfettiAnimation;
