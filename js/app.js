let cachedFaqData = null;

function navigateTab(screenId, btn) {
  triggerHaptic('selection');

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

  // Лепестки роз активны строго во вкладке корзины при наличии товаров
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

  if (screenId === 'profile') {
    renderSavedAddresses();
    loadUserOrders();
  }
  if (screenId === 'root' && typeof loadRootOrders === 'function') {
    loadRootOrders(true);
  }
}

function handleHudRootTap() {
  triggerHaptic('light');

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
    const pass = prompt("Код доступа Root:");
    if (pass) {
      sessionPasscode = pass.trim();
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
        .catch(() => toast("Ошибка проверки"));
    }
  }
}

function toggleEditorFabVisibility(forceState = null) {
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
      toast("Текст сохранен!");
    } catch (err) {
      toast("Ошибка сохранения");
    }
  }
}, true);

(function initDraggableFab() {
  const fab = document.getElementById('floating-editor-btn');
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
  triggerHaptic('light');
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('.faq-pill-item').forEach(p => p.classList.remove('open'));
  if (!isOpen) el.classList.add('open');
}

function openYandexRoute() {
  triggerHaptic('selection');
  const url = SERVER_CONFIG.yandex_org_url || `https://yandex.ru/maps/org/tsvety/18169538769?si=w0t417tmmfzn5zadubrew3uker`;
  if (tg && tg.openLink) tg.openLink(url);
  else window.open(url, '_blank');
}

function contactSupport() {
  triggerHaptic('selection');
  const url = SERVER_CONFIG.support_url || "https://t.me/";
  if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}

// ------------------- СИСТЕМА УВЕДОМЛЕНИЙ КЛИЕНТА -------------------

async function loadNotifications() {
  try {
    const res = await fetch(`${API_URL}?action=get_notifications`);
    clientNotifications = await res.json();
    updateNotificationsBadge();
  } catch (e) {}
}

function openNotificationsModal() {
  triggerHaptic('selection');
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
  triggerHaptic('light');
  document.getElementById('notifications-modal').classList.remove('open');
}

function clickNotificationItem(id, targetTab) {
  triggerHaptic('medium');
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
  triggerHaptic('medium');
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

// Запуск приложения
loadCatalog();
checkUserSession();
loadConfig();
loadNotifications();
updateCartUI();

// Фоновый опрос заказов и уведомлений каждые 3 минуты (180 000 мс)
setInterval(() => {
  const activeScreen = document.querySelector('.screen.active')?.id;
  if (activeScreen === 'screen-profile') {
    loadUserOrders();
  }
  if (activeScreen === 'screen-root' && isAdmin) {
    const secOrders = document.getElementById('root-sec-orders')?.style.display !== 'none';
    if (secOrders && typeof loadRootOrders === 'function') loadRootOrders(false);
  }
  loadNotifications();
}, 180000);
