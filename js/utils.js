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

// Эффект глубины витрины: масштабирует фон при открытии модалок
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

  const unreadCount = (clientNotifications || []).filter(n => !(readNotificationIds || []).includes(String(n.id))).length;
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

// ----------------- МЕХАНИКА: ТОВАР ДНЯ (СТРОГО В 09:00 ПО МСК) -----------------

function getDailyBloomDateKey() {
  // Расчет текущего времени строго по часовому поясу Москвы (UTC+3)
  const now = new Date();
  const mskFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hour12: false
  });

  const parts = mskFormatter.formatToParts(now);
  const mskValues = {};
  parts.forEach(p => { mskValues[p.type] = p.value; });

  let yr = parseInt(mskValues.year, 10);
  let mo = parseInt(mskValues.month, 10);
  let day = parseInt(mskValues.day, 10);
  let hr = parseInt(mskValues.hour, 10);

  // До 09:00 утра действует день вчерашней отсечки
  if (hr < 9) {
    const prevDate = new Date(Date.UTC(yr, mo - 1, day - 1));
    yr = prevDate.getUTCFullYear();
    mo = prevDate.getUTCMonth() + 1;
    day = prevDate.getUTCDate();
  }

  const moStr = String(mo).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  return `${yr}-${moStr}-${dayStr}`;
}

function getDailyBloomItem(itemsList, currentUid) {
  try {
    if (!itemsList || !itemsList.length) return null;

    // Считываем разрешенные категории из сохраненного конфига
    let allowedCategories = [];
    if (SERVER_CONFIG && SERVER_CONFIG.daily_bloom_categories) {
      try {
        allowedCategories = JSON.parse(SERVER_CONFIG.daily_bloom_categories);
      } catch (e) {}
    }

    let filteredByCat = itemsList;
    if (Array.isArray(allowedCategories) && allowedCategories.length > 0) {
      const allowed = itemsList.filter(it => allowedCategories.includes(it.category));
      if (allowed.length > 0) {
        filteredByCat = allowed;
      }
    }

    const activeItems = filteredByCat.filter(it => it.is_active);
    const pool = activeItems.length ? activeItems : filteredByCat;
    if (!pool.length) return itemsList[0] || null;

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

// ----------------- МЕХАНИКА: ЛЕПЕСТКИ РОЗ С ГИРОСКОПОМ -----------------

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
