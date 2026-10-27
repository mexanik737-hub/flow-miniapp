// --- Клиентские уведомления и сбор статистики ---
let clientNotifications = [];
let readNoticeIds = JSON.parse(localStorage.getItem('flw_read_notices') || '[]');

// Логирование событий для панели Root
function trackStatEvent(eventType, entityId = "", details = {}) {
  try {
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: "log_stat",
        event_type: eventType,
        entity_id: String(entityId),
        user_id: String(userId),
        details: details
      })
    }).catch(() => {});
  } catch (e) {}
}

async function loadClientNotifications() {
  try {
    const res = await fetch(`${API_URL}?action=get_notifications`);
    clientNotifications = await res.json();
    updateNotifBadge();
  } catch (e) {}
}

function updateNotifBadge() {
  const badge = document.getElementById('hud-notif-badge');
  if (!badge) return;

  const hasUnread = clientNotifications.some(n => !readNoticeIds.includes(String(n.id)));
  badge.classList.toggle('active', hasUnread);
}

function openNotificationsModal() {
  const container = document.getElementById('notifications-list-container');
  if (!container) return;

  if (!clientNotifications.length) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px 0; font-size:12px;">Нет новых уведомлений</div>';
  } else {
    container.innerHTML = clientNotifications.map(n => {
      const isUnread = !readNoticeIds.includes(String(n.id));
      return `
        <div class="notice-card ${isUnread ? 'unread' : ''}" onclick="handleNotificationClick('${n.id}', '${n.target_tab}')">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <b style="font-size:13px; color:var(--text);">${n.title}</b>
            ${isUnread ? '<span style="font-size:9px; background:var(--cyan); color:#000; padding:1px 5px; border-radius:4px; font-weight:800;">НОВОЕ</span>' : ''}
          </div>
          <div style="font-size:12px; color:var(--text-muted); line-height:1.4; margin-bottom:6px;">${n.text}</div>
          <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted);">
            <span>${n.date}</span>
            <span style="color:var(--cyan); font-weight:700;">Перейти ➔</span>
          </div>
        </div>
      `;
    }).join('');

    // Фиксация открытия модалки уведомлений для статистики
    clientNotifications.forEach(n => {
      trackStatEvent('open_notice', n.id);
    });
  }

  document.getElementById('notifications-modal').classList.add('open');
}

function closeNotificationsModal() {
  document.getElementById('notifications-modal').classList.remove('open');
}

function handleNotificationClick(noticeId, targetTab) {
  const strId = String(noticeId);
  if (!readNoticeIds.includes(strId)) {
    readNoticeIds.push(strId);
    localStorage.setItem('flw_read_notices', JSON.stringify(readNoticeIds));
    updateNotifBadge();
    trackStatEvent('read_notice', strId);
  }

  trackStatEvent('click_notice', strId, { target_tab: targetTab });
  closeNotificationsModal();

  // Переход на целевую вкладку
  const tabBtnMap = {
    'catalog': document.querySelectorAll('.dock-tab')[0],
    'cart': document.querySelectorAll('.dock-tab')[1],
    'profile': document.querySelectorAll('.dock-tab')[2],
    'about': document.querySelectorAll('.dock-tab')[3]
  };
  navigateTab(targetTab || 'catalog', tabBtnMap[targetTab || 'catalog']);
}

function markAllNotificationsAsRead() {
  clientNotifications.forEach(n => {
    const sId = String(n.id);
    if (!readNoticeIds.includes(sId)) {
      readNoticeIds.push(sId);
      trackStatEvent('read_notice', sId);
    }
  });
  localStorage.setItem('flw_read_notices', JSON.stringify(readNoticeIds));
  updateNotifBadge();
  openNotificationsModal();
  toast("Все уведомления прочитаны");
}

// --- Старт приложения ---
loadConfig();
loadCatalog();
checkUserSession();
loadClientNotifications();

// Фиксация входа в приложение для аналитики
trackStatEvent('app_open', userId);

// Фоновый опрос каждые 35 секунд
setInterval(() => {
  const activeScreen = document.querySelector('.screen.active')?.id;
  if (activeScreen === 'screen-profile') {
    loadUserOrders();
  }
  if (activeScreen === 'screen-root' && isAdmin) {
    const secOrders = document.getElementById('root-sec-orders');
    if (secOrders && secOrders.style.display !== 'none') {
      loadRootOrders(false);
    }
  }
  loadClientNotifications();
}, 35000);
