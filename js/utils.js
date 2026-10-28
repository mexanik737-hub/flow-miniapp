// Тактильный менеджер для виброотклика Telegram
function hapticSelect() {
  try {
    if (tg?.HapticFeedback) tg.HapticFeedback.selectionChanged();
  } catch (e) {}
}

function hapticImpact(style = 'light') {
  try {
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred(style);
  } catch (e) {}
}

function hapticNotify(type = 'success') {
  try {
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred(type);
  } catch (e) {}
}

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.classList.add('show');
  hapticImpact('light');
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
  hapticSelect();
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
  hapticImpact('light');
  const el = document.getElementById(uiId);
  if (!el) return;
  el.classList.toggle('checked');
  el.innerText = el.classList.contains('checked') ? '✓' : '';
}

function toggleCartAssemblyMode() {
  hapticImpact('medium');
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
  hapticSelect();
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
