window.cachedFaqData = window.cachedFaqData || null;

// Анимация вращения SVG-иконки синхронизации при нажатии
function animateSyncBtn(btnEl) {
  if (!btnEl) return;
  btnEl.classList.remove('rotating');
  void btnEl.offsetWidth; // перезапуск CSS-анимации
  btnEl.classList.add('rotating');
  setTimeout(() => btnEl.classList.remove('rotating'), 650);
}
window.animateSyncBtn = animateSyncBtn;

function navigateTab(screenId, btn) {
  try {
    if (typeof triggerHaptic === 'function') triggerHaptic('selection');
  } catch (e) {}

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

  try {
    if (screenId === 'cart') {
      const cartCount = Object.values(cart || {}).reduce((a, b) => a + b, 0);
      if (cartCount > 0 && typeof startCartPetals === 'function') {
        startCartPetals();
      } else if (typeof stopCartPetals === 'function') {
        stopCartPetals();
      }
    } else {
      if (typeof stopCartPetals === 'function') {
        stopCartPetals();
      }
    }
  } catch (e) {}

  if (screenId === 'profile') {
    if (typeof renderSavedAddresses === 'function') renderSavedAddresses();
    if (typeof loadUserOrders === 'function') loadUserOrders();
  }
  if (screenId === 'root' && typeof loadRootOrders === 'function') {
    loadRootOrders(true);
  }
}
window.navigateTab = navigateTab;

// Авторизация и доступ в Root по 5 тапам
function handleHudRootTap() {
  triggerHaptic('light');

  // 1. Если в базе явно стоит запрет
  if (currentUser && (currentUser.is_blocked_admin === true || currentUser.is_admin === false || String(currentUser.is_admin).toUpperCase() === 'FALSE' || String(currentUser.is_admin) === 'ЛОЖЬ')) {
    toast("Доступ запрещен администратором");
    return;
  }

  // 2. Если ID создателя (8900179932) или в базе TRUE — вход сразу без паролей
  if (String(userId) === ADMIN_TELEGRAM_ID || isAdmin || (currentUser && currentUser.is_admin === true)) {
    isAdmin = true;
    navigateTab('root', null);
    return;
  }

  // 3. Если ячейка пустая, клиент новый или анонимный — считаем 5 тапов за 2 секунды
  hudTapCount++;
  clearTimeout(hudTapTimer);
  hudTapTimer = setTimeout(() => { hudTapCount = 0; }, 2000);

  if (hudTapCount >= 5) {
    hudTapCount = 0;
    const pass = prompt("Код доступа Root:");
    if (pass) {
      sessionPasscode = pass.trim();
      toast("Проверка доступа...");
      fetch(`${API_URL}?action=admin_orders&admin_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            isAdmin = true;
            toast("Доступ подтвержден");
            navigateTab('root', null);
          } else {
            sessionPasscode = "";
            toast("Неверный код доступа");
          }
        })
        .catch(() => toast("Ошибка проверки доступа"));
    }
  }
}
window.handleHudRootTap = handleHudRootTap;

function toggleEditorFabVisibility(forceState = null) {
  isFabVisible = (forceState !== null) ? forceState : !isFabVisible;
  const fab = document.getElementById('floating-editor-btn');
  if (fab) fab.style.display = isFabVisible ? 'flex' : 'none';
  const chk = document.getElementById('root-toggle-editor-btn');
  if (chk) {
    chk.classList.toggle('checked', isFabVisible);
    chk.innerText = isFabVisible ? '✓' : '';
  }

  if (!isFabVisible && isTextEditActive) {
    toggleTextEditingMode(false);
  }
}
window.toggleEditorFabVisibility = toggleEditorFabVisibility;

function applyConfigToUI(cfg) {
  SERVER_CONFIG = cfg;
  localStorage.setItem('flw_config_cache', JSON.stringify(cfg));

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
}

async function loadConfig(force = false) {
  const cached = localStorage.getItem('flw_config_cache');
  if (cached && !force) {
    try {
      applyConfigToUI(JSON.parse(cached));
    } catch (e) {}
  }

  try {
    const res = await fetch(`${API_URL}?action=get_config`);
    const cfg = await res.json();
    if (cfg && !cfg.error) {
      applyConfigToUI(cfg);
    }
  } catch (e) {}
}
window.loadConfig = loadConfig;

function toggleTextEditingMode(forcedState = null) {
  isTextEditActive = (forcedState !== null) ? forcedState : !isTextEditActive;
  const btn = document.getElementById('floating-editor-btn');
  if (btn) {
    btn.classList.toggle('active', isTextEditActive);
    btn.innerText = isTextEditActive ? '✓' : '✏️';
  }
  document.body.classList.toggle('in-text-edit-mode', isTextEditActive);

  if (isTextEditActive) {
    toast("Режим редактирования: нажмите на любой выделенный текст");
  } else {
    toast("Режим редактирования выключен");
  }
}
window.toggleTextEditingMode = toggleTextEditingMode;

document.addEventListener('click', async (e) => {
  if (!isTextEditActive) return;
  if (e.target.closest('#floating-editor-btn')) return;

  e.preventDefault();
  e.stopPropagation();

  const target = e.target.closest('[data-config-key]');
  if (!target) return;

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
      if (SERVER_CONFIG) {
        SERVER_CONFIG[key] = cleanVal;
        localStorage.setItem('flw_config_cache', JSON.stringify(SERVER_CONFIG));
      }
      toast("Текст сохранен!");
    } catch (err) {
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
  triggerHaptic('selection');
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

  const cached = localStorage.getItem('flw_faq_cache');
  if (cached) {
    try {
      window.cachedFaqData = JSON.parse(cached);
      renderFaqList(window.cachedFaqData);
    } catch (e) {}
  }

  if (window.cachedFaqData) {
    renderFaqList(window.cachedFaqData);
    return;
  }

  container.innerHTML = `<div style="text-align:center; padding:12px; color:var(--text-muted); font-size:12px;">Загрузка вопросов...</div>`;

  try {
    const res = await fetch(`${API_URL}?action=faq`);
    window.cachedFaqData = await res.json();
    localStorage.setItem('flw_faq_cache', JSON.stringify(window.cachedFaqData));
    renderFaqList(window.cachedFaqData);
  } catch (e) {
    container.innerHTML = `<div style="text-align:center; padding:12px; color:var(--red); font-size:12px;">Ошибка загрузки FAQ</div>`;
  }
}
window.toggleAboutFaqSection = toggleAboutFaqSection;

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
  triggerHaptic('light');
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('.faq-pill-item').forEach(p => p.classList.remove('open'));
  if (!isOpen) el.classList.add('open');
}
window.toggleFaqPill = toggleFaqPill;

function openYandexRoute() {
  triggerHaptic('selection');
  const url = SERVER_CONFIG.yandex_org_url || `https://yandex.ru/maps/org/tsvety/18169538769?si=w0t417tmmfzn5zadubrew3uker`;
  if (tg && tg.openLink) tg.openLink(url);
  else window.open(url, '_blank');
}
window.openYandexRoute = openYandexRoute;

function contactSupport() {
  triggerHaptic('selection');
  const url = SERVER_CONFIG.support_url || "https://t.me/";
  if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}
window.contactSupport = contactSupport;

// ------------------- СИСТЕМА УВЕДОМЛЕНИЙ КЛИЕНТА -------------------

async function loadNotifications(force = false) {
  const cached = localStorage.getItem('flw_notifs_cache');
  if (cached && !force) {
    try {
      clientNotifications = JSON.parse(cached);
      if (typeof updateNotificationsBadge === 'function') updateNotificationsBadge();
    } catch (e) {}
  }

  try {
    const res = await fetch(`${API_URL}?action=get_notifications`);
    const serverNotifs = await res.json();
    if (Array.isArray(serverNotifs)) {
      clientNotifications = serverNotifs;
      localStorage.setItem('flw_notifs_cache', JSON.stringify(clientNotifications));
      if (typeof updateNotificationsBadge === 'function') updateNotificationsBadge();
    }
  } catch (e) {}
}
window.loadNotifications = loadNotifications;

function openNotificationsModal() {
  triggerHaptic('selection');
  const container = document.getElementById('notifications-list');
  if (!container) return;

  if (!clientNotifications || !clientNotifications.length) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px 0; font-size:12px;">Новых уведомлений нет</div>';
  } else {
    container.innerHTML = clientNotifications.map(n => {
      const isUnread = !(readNotificationIds || []).includes(String(n.id));
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

  const m = document.getElementById('notifications-modal');
  if (m) m.classList.add('open');
}
window.openNotificationsModal = openNotificationsModal;

function closeNotificationsModal() {
  triggerHaptic('light');
  const m = document.getElementById('notifications-modal');
  if (m) m.classList.remove('open');
}
window.closeNotificationsModal = closeNotificationsModal;

function clickNotificationItem(id, targetTab) {
  triggerHaptic('medium');
  const strId = String(id);
  if (!(readNotificationIds || []).includes(strId)) {
    readNotificationIds.push(strId);
    localStorage.setItem('flw_read_notifs', JSON.stringify(readNotificationIds));
    if (typeof updateNotificationsBadge === 'function') updateNotificationsBadge();

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
window.clickNotificationItem = clickNotificationItem;

function markAllNotificationsAsRead() {
  triggerHaptic('medium');
  (clientNotifications || []).forEach(n => {
    const strId = String(n.id);
    if (!(readNotificationIds || []).includes(strId)) {
      readNotificationIds.push(strId);
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: "track_stat", type: "notif_read", ref_id: strId })
      }).catch(() => {});
    }
  });

  localStorage.setItem('flw_read_notifs', JSON.stringify(readNotificationIds));
  if (typeof updateNotificationsBadge === 'function') updateNotificationsBadge();
  openNotificationsModal();
  toast("Все уведомления прочитаны");
}
window.markAllNotificationsAsRead = markAllNotificationsAsRead;

// Фоновая сверка версий данных для разгрузки запросов
async function checkDataHashesAndSync() {
  try {
    const res = await fetch(`${API_URL}?action=get_data_hashes`);
    const serverHashes = await res.json();
    if (!serverHashes) return;

    const savedHashesStr = localStorage.getItem('flw_data_hashes');
    const localHashes = savedHashesStr ? JSON.parse(savedHashesStr) : {};

    if (localHashes.catalog_hash !== serverHashes.catalog_hash || localHashes.table_edit_ts !== serverHashes.table_edit_ts) {
      if (typeof loadCatalog === 'function') loadCatalog(true);
    }
    if (localHashes.faq_hash !== serverHashes.faq_hash) {
      const faqRes = await fetch(`${API_URL}?action=faq`);
      window.cachedFaqData = await faqRes.json();
      localStorage.setItem('flw_faq_cache', JSON.stringify(window.cachedFaqData));
    }
    if (localHashes.notifs_hash !== serverHashes.notifs_hash) {
      loadNotifications(true);
    }
    if (localHashes.config_hash !== serverHashes.config_hash) {
      loadConfig(true);
    }

    localStorage.setItem('flw_data_hashes', JSON.stringify(serverHashes));
  } catch (e) {}
}
window.checkDataHashesAndSync = checkDataHashesAndSync;

// Автоматическая мгновенная проверка изменений в таблице при возврате в приложение
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkDataHashesAndSync();
    const activeScreen = document.querySelector('.screen.active')?.id;
    if (activeScreen === 'screen-profile' && typeof loadUserOrders === 'function') {
      loadUserOrders();
    }
    if (activeScreen === 'screen-root' && isAdmin && typeof loadRootOrders === 'function') {
      loadRootOrders(false);
    }
  }
});

// Инициализация при полной готовности DOM
function initApp() {
  try {
    loadCatalog();
    checkUserSession();
    loadConfig();
    loadNotifications();
    if (typeof updateCartUI === 'function') updateCartUI();
    checkDataHashesAndSync();
  } catch (e) {
    console.error("App init error:", e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Фоновый опрос заказов и проверка хэшей каждые 3 минуты (180 000 мс)
setInterval(() => {
  const activeScreen = document.querySelector('.screen.active')?.id;
  if (activeScreen === 'screen-profile') {
    if (typeof loadUserOrders === 'function') loadUserOrders();
  }
  if (activeScreen === 'screen-root' && isAdmin) {
    const secOrders = document.getElementById('root-sec-orders')?.style.display !== 'none';
    if (secOrders && typeof loadRootOrders === 'function') loadRootOrders(false);
  }
  checkDataHashesAndSync();
}, 180000);
