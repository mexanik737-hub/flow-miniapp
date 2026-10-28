let selectedSavedAddrSuggestion = null;

function renderSavedAddresses() {
  const box = document.getElementById('saved-addresses-profile-list');
  if (!savedAddresses.length) {
    box.innerHTML = '<div style="color:var(--text-muted); font-size:11px; padding:4px 0;">Нет сохраненных адресов</div>';
    return;
  }
  box.innerHTML = savedAddresses.map((a, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px;">
      <div style="max-width:75%;">
        <b>${a.label}:</b> <span style="color:var(--text-muted);">${a.address}</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="color:var(--cyan); cursor:pointer; font-size:13px;" onclick="openEditSavedAddressModal(${idx})">✏️</span>
        <span style="color:var(--red); cursor:pointer; font-size:14px;" onclick="deleteSavedAddress(${idx})">✕</span>
      </div>
    </div>
  `).join('');
}

function openAddSavedAddressModal() {
  if (savedAddresses.length >= 3) { toast("Максимум 3 адреса"); return; }
  editingSavedAddrIdx = null;
  selectedSavedAddrSuggestion = null;
  document.getElementById('saved-addr-modal-title').innerText = "Новый сохраненный адрес";
  document.getElementById('save-addr-modal-btn').innerText = "Сохранить адрес";
  document.getElementById('new-addr-label').value = "";
  document.getElementById('new-addr-suggest').value = "";
  document.getElementById('new-addr-entrance').value = "";
  document.getElementById('new-addr-floor').value = "";
  document.getElementById('new-addr-apt').value = "";
  document.getElementById('new-addr-intercom').value = "";
  document.getElementById('add-saved-addr-modal').classList.add('open');
}

function openEditSavedAddressModal(idx) {
  editingSavedAddrIdx = idx;
  const a = savedAddresses[idx];
  if (!a) return;
  selectedSavedAddrSuggestion = a.lat && a.lon ? {
    value: a.address,
    data: { house: "1", geo_lat: a.lat, geo_lon: a.lon }
  } : null;

  document.getElementById('saved-addr-modal-title').innerText = `Редактирование: ${a.label}`;
  document.getElementById('save-addr-modal-btn').innerText = "Сохранить изменения";
  document.getElementById('new-addr-label').value = a.label || "";
  document.getElementById('new-addr-suggest').value = a.address || "";
  document.getElementById('new-addr-entrance').value = a.entrance || "";
  document.getElementById('new-addr-floor').value = a.floor || "";
  document.getElementById('new-addr-apt').value = a.apt || "";
  document.getElementById('new-addr-intercom').value = a.intercom || "";
  document.getElementById('add-saved-addr-modal').classList.add('open');
}

function closeAddSavedAddressModal() { document.getElementById('add-saved-addr-modal').classList.remove('open'); }

function onSavedAddrSuggestInput(query) {
  clearTimeout(suggestDebounceTimer);
  const box = document.getElementById('new-addr-suggest-list');
  selectedSavedAddrSuggestion = null;

  if (!query || query.trim().length < 2) { box.style.display = 'none'; return; }

  suggestDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": "Token " + (SERVER_CONFIG.dadata_token || "")
        },
        body: JSON.stringify({ query: query, locations: [{ region: "Москва" }, { region: "Московская" }], count: 5 })
      });
      const data = await res.json();
      const items = data.suggestions || [];
      if (!items.length) { box.style.display = 'none'; return; }
      box.innerHTML = items.map((s, idx) => `
        <div class="suggest-item" onclick="selectSavedAddrItem(${idx})">${s.value}</div>
      `).join('');
      box.style.display = 'block';
      window.savedAddrSuggestions = items;
    } catch (e) {}
  }, 250);
}

function selectSavedAddrItem(idx) {
  const s = window.savedAddrSuggestions?.[idx];
  if (!s) return;
  document.getElementById('new-addr-suggest').value = s.value;
  document.getElementById('new-addr-suggest-list').style.display = 'none';
  selectedSavedAddrSuggestion = s;
}

function saveNewAddressFromModal() {
  const label = document.getElementById('new-addr-label').value.trim() || "Дом";
  const addr = document.getElementById('new-addr-suggest').value.trim();
  const ent = document.getElementById('new-addr-entrance').value.trim();
  const flr = document.getElementById('new-addr-floor').value.trim();
  const apt = document.getElementById('new-addr-apt').value.trim();
  const intc = document.getElementById('new-addr-intercom').value.trim();

  if (!addr) { toast("Укажите улицу и номер дома"); return; }

  if (!selectedSavedAddrSuggestion || !selectedSavedAddrSuggestion.data?.house || !selectedSavedAddrSuggestion.data?.geo_lat || !selectedSavedAddrSuggestion.data?.geo_lon) {
    toast("Выберите точный адрес с номером дома из подсказок DaData");
    return;
  }

  if (!ent || !flr || !apt || !intc) {
    toast("Заполните все поля адреса: подъезд, этаж, квартиру и домофон (если нет — укажите «нет»)");
    return;
  }

  const addrObj = {
    label: label,
    address: addr,
    entrance: ent,
    floor: flr,
    apt: apt,
    intercom: intc,
    lat: selectedSavedAddrSuggestion.data.geo_lat,
    lon: selectedSavedAddrSuggestion.data.geo_lon
  };

  if (editingSavedAddrIdx !== null) {
    savedAddresses[editingSavedAddrIdx] = addrObj;
    toast("Адрес обновлен");
  } else {
    savedAddresses.push(addrObj);
    toast("Адрес сохранен");
  }

  syncSavedAddresses();
  closeAddSavedAddressModal();
  renderSavedAddresses();
}

function deleteSavedAddress(idx) {
  savedAddresses.splice(idx, 1);
  syncSavedAddresses();
  renderSavedAddresses();
  toast("Адрес удален");
}

function syncSavedAddresses() {
  localStorage.setItem('flw_saved_addresses', JSON.stringify(savedAddresses));
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "save_user_addresses", user_id: userId, addresses_json: JSON.stringify(savedAddresses) })
  }).catch(() => {});
}

function openEditProfileModal() {
  if (!currentUser) return;
  document.getElementById('edit-prof-name').value = currentUser.name || '';
  document.getElementById('edit-prof-phone').value = currentUser.phone || '';
  document.getElementById('edit-profile-modal').classList.add('open');
}
function closeEditProfileModal() { document.getElementById('edit-profile-modal').classList.remove('open'); }

async function saveUserProfileChanges() {
  const name = document.getElementById('edit-prof-name').value.trim();
  const phone = document.getElementById('edit-prof-phone').value.trim();
  if (!name || phone.length < 17) { toast("Заполните имя и номер полностью: 8 (***) ***-**-**"); return; }

  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "update_user_info", user_id: userId, name: name, phone: phone })
  });
  currentUser.name = name;
  currentUser.phone = phone;
  localStorage.setItem('flw_user_profile', JSON.stringify(currentUser));
  renderProfileUI();
  closeEditProfileModal();
  toast("Профиль обновлен");
}

async function checkUserSession() {
  if (currentUser) {
    renderProfileUI();
  }

  try {
    const cleanUid = String(userId).trim();
    const res = await fetch(`${API_URL}?action=get_or_register_user&user_id=${encodeURIComponent(cleanUid)}`);
    const user = await res.json();

    if (user && !user.error) {
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

async function submitRegistration() {
  const name = document.getElementById('reg-name').value.trim() || tgFirstName;
  const phone = document.getElementById('reg-phone').value.trim();

  if (!phone || phone.length < 17) {
    toast("Введите номер полностью: 8 (***) ***-**-**");
    return;
  }

  toast("Сохранение профиля...");
  try {
    const res = await fetch(`${API_URL}?action=get_or_register_user&user_id=${userId}&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&username=${encodeURIComponent(tgUsername)}`);
    currentUser = await res.json();
    isAdmin = (String(userId) === ADMIN_TELEGRAM_ID || currentUser.is_admin === true || String(currentUser.is_admin).toUpperCase() === 'TRUE');
    localStorage.setItem('flw_user_profile', JSON.stringify(currentUser));
    document.getElementById('reg-modal').classList.remove('open');
    renderProfileUI();
    toast("Регистрация завершена");
  } catch (e) {
    toast("Ошибка связи с базой");
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

// Загрузка заказов с автоматической отменой просроченных (>15 мин) и полным шаблоном названия
async function loadUserOrders() {
  const container = document.getElementById('user-orders-list');
  try {
    const res = await fetch(`${API_URL}?action=user_orders&user_id=${userId}`);
    const orders = await res.json();
    if (!orders || !orders.length) {
      container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:16px 0; font-size:12px;">Заказов пока нет</div>';
      return;
    }

    const nowTs = Date.now();

    container.innerHTML = orders.map(ord => {
      let isAwaitingPay = (ord.status === 'Ожидает оплаты');
      const isAwaitingAssembly = (ord.status === 'Ожидает согласования упаковки');

      let timerCardBadge = "";
      if (isAwaitingPay) {
        const createdTs = parseOrderDateToTs(ord.date_time);
        if (createdTs) {
          const elapsedSec = Math.floor((nowTs - createdTs) / 1000);
          const leftSec = (15 * 60) - elapsedSec;

          if (leftSec <= 0) {
            // Время истекло — автоматически отправляем отмену на сервер
            ord.status = 'Отменен (таймаут)';
            isAwaitingPay = false;
            fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({ action: "cancel_order_timeout", order_id: ord.order_id })
            }).catch(() => {});
          } else {
            const m = Math.floor(leftSec / 60);
            const s = leftSec % 60;
            timerCardBadge = `⏳ Осталось: ${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
          }
        }
      }

      let badgeCls = 'st-await-pay';
      if (ord.status.includes('Собирается')) badgeCls = 'st-building';
      else if (ord.status.includes('В пути') || ord.status.includes('выдаче')) badgeCls = 'st-transit';
      else if (ord.status.includes('Завершен')) badgeCls = 'st-completed';
      else if (ord.status.includes('Отменен')) badgeCls = 'st-cancelled';
      else if (ord.status.includes('упаковки')) badgeCls = 'st-check-pay';

      return `
        <div class="box-card" style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:13px; font-weight:800; color:var(--text);">${ord.order_id}</span>
            <span class="status-badge ${badgeCls}">${ord.status}</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted); line-height:1.4; margin-bottom:8px;">
            ${ord.items.map(i => {
              const fullTitle = formatFullItemTitle(i.title, i.unit, i.variant, i.color);
              const packTag = i.in_bouquet ? ' <b>[в букет]</b>' : '';
              return `• ${fullTitle} × ${i.qty} шт.${packTag}`;
            }).join('<br>')}
          </div>
          ${isAwaitingPay ? `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
              <button class="btn-metro" style="font-size:12px; padding:8px; flex:1; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);" onclick="openPaymentModal('${ord.order_id}', ${ord.total_amount}, '${ord.date_time}')">
                💳 Оплатить ${ord.total_amount} ₽ (СБП)
              </button>
              <span style="font-size:11px; font-weight:800; color:var(--red); white-space:nowrap;">${timerCardBadge}</span>
            </div>
          ` : ''}
          ${isAwaitingAssembly ? `
            <a class="btn-metro btn-emerald" href="tel:89162257117" style="font-size:12px; padding:8px; margin-bottom:8px; text-decoration:none;">
              📞 Позвонить флористу для согласования
            </a>
          ` : ''}
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:6px; font-size:11px;">
            <span style="color:var(--text-muted);">${ord.date_time}</span>
            <span style="font-weight:800; font-size:13px; color:var(--text);">${ord.total_amount} ₽</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {}
}
