// Состояние профиля и адресов
let savedAddresses = JSON.parse(localStorage.getItem('flw_saved_addresses') || '[]');
let editingSavedAddrIdx = null;

// Навигация по экранам
function navigateTab(screenName, btnEl) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screenName}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.dock-tab').forEach(t => t.classList.remove('active'));
  if (btnEl) {
    btnEl.classList.add('active');
    btnEl.classList.add('spinning');
    setTimeout(() => btnEl.classList.remove('spinning'), 400);
  }

  if (screenName === 'profile') {
    checkUserSession();
    loadUserOrders();
  }
  if (screenName === 'about') {
    loadAboutFaq();
  }
  if (screenName === 'root' && isAdmin) {
    loadRootOrders(false);
  }
}

// Загрузка динамического конфига текстов и реквизитов
async function loadConfig() {
  try {
    const cfg = await apiGet('get_config');
    SERVER_CONFIG = cfg;

    const sbpBtn = document.getElementById('pay-sbp-btn');
    if (sbpBtn && cfg.sbp_url) sbpBtn.href = cfg.sbp_url;

    const qrImg = document.getElementById('sbp-qr-image-tag');
    if (qrImg && cfg.sbp_qr) qrImg.src = cfg.sbp_qr;

    if (cfg.shop_phone_tel) {
      const telLink = 'tel:' + cfg.shop_phone_tel;
      const callBtn = document.getElementById('shop-call-btn');
      if (callBtn) callBtn.href = telLink;

      const phoneTextBtn = document.getElementById('shop-phone-text-btn');
      if (phoneTextBtn) {
        phoneTextBtn.href = telLink;
        if (cfg.shop_phone) phoneTextBtn.innerText = cfg.shop_phone;
      }

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

// Сессия пользователя и профиль
async function checkUserSession() {
  if (currentUser) {
    renderProfileUI();
  }

  try {
    const cleanUid = String(userId).trim();
    const user = await apiGet('get_or_register_user', { user_id: cleanUid });

    if (user && !user.error && (user.exists || user.phone || user.name)) {
      currentUser = user;
      isAdmin = (user.is_admin === true || String(user.is_admin).toUpperCase() === 'TRUE');
      localStorage.setItem('flw_user_profile', JSON.stringify(user));

      if (user.address && String(user.address).startsWith('[')) {
        try {
          savedAddresses = JSON.parse(user.address);
          localStorage.setItem('flw_saved_addresses', JSON.stringify(savedAddresses));
        } catch (e) {}
      }

      renderProfileUI();
      renderSavedAddresses();
    } else if (!currentUser) {
      document.getElementById('reg-name').value = tgFirstName;
      document.getElementById('reg-modal').classList.add('open');
    }
  } catch (e) {
    if (currentUser) {
      renderProfileUI();
    } else {
      document.getElementById('reg-name').value = tgFirstName;
      document.getElementById('reg-modal').classList.add('open');
    }
  }
}

function renderProfileUI() {
  if (!currentUser) return;
  const name = currentUser.name || tgFirstName || "Клиент";
  const phone = currentUser.phone || "Номер не указан";
  const spent = (currentUser.total_spent !== undefined && currentUser.total_spent !== null) ? currentUser.total_spent : 0;
  const regdate = currentUser.reg_date || "-";

  const hudEl = document.getElementById('hud-name');
  if (hudEl) hudEl.innerText = name;

  const pName = document.getElementById('prof-name');
  if (pName) pName.innerText = name;

  const pPhone = document.getElementById('prof-phone');
  if (pPhone) pPhone.innerText = phone;

  const pSpent = document.getElementById('prof-spent');
  if (pSpent) pSpent.innerText = spent + ' ₽';

  const pReg = document.getElementById('prof-regdate');
  if (pReg) pReg.innerText = regdate;
}

async function submitRegistration() {
  const name = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  if (!name || !phone || phone.length < 10) {
    toast("Укажите имя и контактный телефон");
    return;
  }

  try {
    toast("Регистрация...");
    const user = await apiGet('get_or_register_user', {
      user_id: userId,
      name: name,
      phone: phone,
      username: tgUsername
    });

    if (user && !user.error) {
      currentUser = user;
      isAdmin = (user.is_admin === true || String(user.is_admin).toUpperCase() === 'TRUE');
      localStorage.setItem('flw_user_profile', JSON.stringify(user));
      document.getElementById('reg-modal').classList.remove('open');
      renderProfileUI();
      toast("Регистрация завершена!");
    }
  } catch (e) {
    toast("Ошибка регистрации");
  }
}

function openEditProfileModal() {
  if (currentUser) {
    document.getElementById('edit-prof-name').value = currentUser.name || "";
    document.getElementById('edit-prof-phone').value = currentUser.phone || "";
  }
  document.getElementById('edit-profile-modal').classList.add('open');
}

function closeEditProfileModal() {
  document.getElementById('edit-profile-modal').classList.remove('open');
}

async function saveUserProfileChanges() {
  const name = document.getElementById('edit-prof-name').value.trim();
  const phone = document.getElementById('edit-prof-phone').value.trim();
  if (!name || !phone) {
    toast("Заполните имя и номер телефона");
    return;
  }

  try {
    toast("Сохранение...");
    await apiPost({
      action: "update_user_info",
      user_id: userId,
      name: name,
      phone: phone
    });

    if (currentUser) {
      currentUser.name = name;
      currentUser.phone = phone;
      localStorage.setItem('flw_user_profile', JSON.stringify(currentUser));
    }
    closeEditProfileModal();
    renderProfileUI();
    toast("Профиль обновлен");
  } catch (e) {
    toast("Ошибка обновления");
  }
}

// Управление сохраненными адресами
function renderSavedAddresses() {
  const listEl = document.getElementById('saved-addresses-profile-list');
  if (!listEl) return;

  if (!savedAddresses.length) {
    listEl.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">Нет сохраненных адресов</div>`;
    return;
  }

  listEl.innerHTML = savedAddresses.map((a, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px;">
      <div>
        <b style="color:var(--cyan);">${a.label || 'Адрес ' + (idx + 1)}</b>
        <div style="color:var(--text-muted); margin-top:2px;">${a.address}, под. ${a.entrance}, кв. ${a.apt}</div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn-trash-mini" onclick="openEditSavedAddressModal(${idx})">✏️</button>
        <button class="btn-trash-mini" style="color:var(--red);" onclick="deleteSavedAddress(${idx})">✕</button>
      </div>
    </div>
  `).join('');
}

function openAddSavedAddressModal() {
  if (savedAddresses.length >= 3) {
    toast("Максимум 3 сохраненных адреса");
    return;
  }
  editingSavedAddrIdx = null;
  document.getElementById('saved-addr-modal-title').innerText = "Новый сохраненный адрес";
  document.getElementById('new-addr-label').value = "";
  document.getElementById('new-addr-suggest').value = "";
  document.getElementById('new-addr-entrance').value = "";
  document.getElementById('new-addr-floor').value = "";
  document.getElementById('new-addr-apt').value = "";
  document.getElementById('new-addr-intercom').value = "";
  document.getElementById('add-saved-addr-modal').classList.add('open');
}

function openEditSavedAddressModal(idx) {
  const a = savedAddresses[idx];
  if (!a) return;
  editingSavedAddrIdx = idx;
  document.getElementById('saved-addr-modal-title').innerText = "Изменить адрес";
  document.getElementById('new-addr-label').value = a.label || "";
  document.getElementById('new-addr-suggest').value = a.address || "";
  document.getElementById('new-addr-entrance').value = a.entrance || "";
  document.getElementById('new-addr-floor').value = a.floor || "";
  document.getElementById('new-addr-apt').value = a.apt || "";
  document.getElementById('new-addr-intercom').value = a.intercom || "";
  document.getElementById('add-saved-addr-modal').classList.add('open');
}

function closeAddSavedAddressModal() {
  document.getElementById('add-saved-addr-modal').classList.remove('open');
}

function onSavedAddrSuggestInput(val) {
  clearTimeout(suggestDebounceTimer);
  const listEl = document.getElementById('new-addr-suggest-list');
  if (!val || val.trim().length < 2) {
    listEl.style.display = 'none';
    return;
  }

  suggestDebounceTimer = setTimeout(async () => {
    try {
      const token = SERVER_CONFIG.dadata_token;
      if (!token) return;

      const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": "Token " + token
        },
        body: JSON.stringify({
          query: val,
          locations: [{ kladr_id: "77000000000" }, { region: "Московская" }],
          count: 5
        })
      });

      const data = await res.json();
      if (!data.suggestions || !data.suggestions.length) {
        listEl.style.display = 'none';
        return;
      }

      listEl.innerHTML = data.suggestions.map((s, idx) => `
        <div class="suggest-item" onclick="selectSavedAddrItem(${idx})">${s.value}</div>
      `).join('');
      listEl.style.display = 'block';
      window._curSavedAddrSuggestions = data.suggestions;
    } catch (e) {
      listEl.style.display = 'none';
    }
  }, 250);
}

function selectSavedAddrItem(idx) {
  const item = window._curSavedAddrSuggestions?.[idx];
  if (!item) return;
  document.getElementById('new-addr-suggest').value = item.value;
  document.getElementById('new-addr-suggest-list').style.display = 'none';
}

function saveNewAddressFromModal() {
  const label = document.getElementById('new-addr-label').value.trim() || "Дом";
  const address = document.getElementById('new-addr-suggest').value.trim();
  const entrance = document.getElementById('new-addr-entrance').value.trim();
  const floor = document.getElementById('new-addr-floor').value.trim();
  const apt = document.getElementById('new-addr-apt').value.trim();
  const intercom = document.getElementById('new-addr-intercom').value.trim();

  if (!address || !entrance || !apt) {
    toast("Заполните адрес, подъезд и квартиру");
    return;
  }

  const item = { label, address, entrance, floor, apt, intercom };
  if (editingSavedAddrIdx !== null) {
    savedAddresses[editingSavedAddrIdx] = item;
  } else {
    savedAddresses.push(item);
  }

  closeAddSavedAddressModal();
  syncSavedAddresses();
}

function deleteSavedAddress(idx) {
  savedAddresses.splice(idx, 1);
  syncSavedAddresses();
}

async function syncSavedAddresses(extraPushItem = null) {
  if (extraPushItem && savedAddresses.length < 3) {
    const exists = savedAddresses.some(a => a.address === extraPushItem.address && a.apt === extraPushItem.apt);
    if (!exists) savedAddresses.push(extraPushItem);
  }

  localStorage.setItem('flw_saved_addresses', JSON.stringify(savedAddresses));
  renderSavedAddresses();

  try {
    await apiPost({
      action: "save_user_addresses",
      user_id: userId,
      addresses_json: JSON.stringify(savedAddresses)
    });
  } catch (e) {}
}

function applySavedAddressToOrder(idx) {
  const a = savedAddresses[idx];
  if (!a) return;
  document.getElementById('ord-suggest-input').value = a.address;
  document.getElementById('ord-entrance').value = a.entrance;
  document.getElementById('ord-floor').value = a.floor || '';
  document.getElementById('ord-apt').value = a.apt;
  document.getElementById('ord-intercom').value = a.intercom || '';
  toast(`Выбран: ${a.label}`);
}

async function loadUserOrders() {
  const container = document.getElementById('user-orders-list');
  if (!container) return;

  try {
    const orders = await apiGet('user_orders', { user_id: userId });
    if (!orders.length) {
      container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:14px 0; font-size:12px;">Заказов пока нет</div>`;
      return;
    }

    container.innerHTML = orders.map(o => {
      const items = o.items || [];
      const itemsList = items.map(i => `${i.title} × ${i.qty}`).join(', ');

      return `
        <div style="padding:10px 0; border-bottom:1px solid var(--border); font-size:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b style="color:var(--cyan);">${o.order_id}</b>
            <span class="status-badge">${o.status}</span>
          </div>
          <div style="color:var(--text-muted); margin-top:2px;">${o.date_time}</div>
          <div style="margin-top:4px;">${itemsList}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
            <span style="font-weight:800; color:var(--green);">${o.total_amount} ₽</span>
            ${o.status === 'Ожидает оплаты' ? `
              <button class="btn-metro" style="width:auto; padding:5px 12px; font-size:11px;" onclick="openPaymentModal('${o.order_id}', ${o.total_amount})">
                Оплатить
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {}
}

// Загрузка и аккордеон FAQ в «О нас»
async function loadAboutFaq() {
  const container = document.getElementById('about-faq-container');
  if (!container) return;

  try {
    const faqList = await apiGet('faq');
    if (!faqList.length) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center;">Вопросы загружаются...</div>`;
      return;
    }

    container.innerHTML = faqList.map((f, idx) => `
      <div class="faq-pill-item" id="about-faq-pill-${idx}">
        <div class="faq-pill-header" onclick="toggleFaqPill(${idx})">
          <span>${f.question}</span>
          <span>▼</span>
        </div>
        <div class="faq-pill-body">${f.answer}</div>
      </div>
    `).join('');
  } catch (e) {}
}

function toggleFaqPill(idx) {
  const el = document.getElementById(`about-faq-pill-${idx}`);
  if (!el) return;
  el.classList.toggle('open');
}

function contactSupport() {
  const url = SERVER_CONFIG.support_url || "https://t.me/";
  if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}

// Инициализация при загрузке документа
document.addEventListener('DOMContentLoaded', () => {
  // Настройка Telegram WebApp
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
  }

  loadConfig();
  loadCatalog();
  checkUserSession();
  initDraggableFab();

  // Фоновый цикл опроса обновлений (35 секунд)
  setInterval(() => {
    const activeScreen = document.querySelector('.screen.active')?.id;
    if (activeScreen === 'screen-profile') {
      loadUserOrders();
    }
    if (activeScreen === 'screen-root' && isAdmin) {
      const secOrders = document.getElementById('root-sec-orders')?.style.display !== 'none';
      if (secOrders) loadRootOrders(false);
    }
  }, 35000);
});
