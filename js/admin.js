// Защищенное переключение разделов Root с проверкой наличия DOM-элементов
function switchRootSection(sec) {
  const allSecs = ['orders', 'catalog', 'clients', 'notifs', 'stats', 'faq'];

  allSecs.forEach(s => {
    const tabEl = document.getElementById('tab-root-' + s);
    const secEl = document.getElementById('root-sec-' + s);
    if (tabEl) {
      if (s === sec) {
        tabEl.classList.add('active');
      } else {
        tabEl.classList.remove('active');
      }
    }
    if (secEl) {
      secEl.style.display = (s === sec ? 'block' : 'none');
    }
  });

  if (sec === 'orders' && typeof loadRootOrders === 'function') loadRootOrders(true);
  if (sec === 'catalog' && typeof loadRootCatalog === 'function') loadRootCatalog();
  if (sec === 'clients' && typeof loadRootClients === 'function') loadRootClients();
  if (sec === 'notifs' && typeof loadRootNotifications === 'function') loadRootNotifications();
  if (sec === 'stats' && typeof loadRootStats === 'function') loadRootStats(currentStatsPeriod || 'today');
  if (sec === 'faq' && typeof loadRootFaq === 'function') loadRootFaq();
}
window.switchRootSection = switchRootSection;

function switchRootSubTab(tab) {
  currentRootSubTab = tab;
  const tabActive = document.getElementById('tab-root-active');
  const tabArchive = document.getElementById('tab-root-archive');
  if (tabActive) tabActive.classList.toggle('active', tab === 'active');
  if (tabArchive) tabArchive.classList.toggle('active', tab === 'archive');
  renderRootOrders();
}
window.switchRootSubTab = switchRootSubTab;

async function loadRootOrders(force = false) {
  if (!isAdmin) return;
  try {
    const res = await fetch(`${API_URL}?action=admin_orders&admin_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`);
    const orders = await res.json();
    const newHash = JSON.stringify(orders);

    if (force || newHash !== lastRootOrdersHash) {
      allRootOrders = orders;
      lastRootOrdersHash = newHash;
      renderRootOrders();
    }
  } catch (e) {}
}

function renderRootOrders() {
  const container = document.getElementById('root-orders-container');
  if (!container) return;

  const filtered = allRootOrders.filter(ord => {
    const isClosed = ord.status === 'Завершен' || ord.status.startsWith('Отменен');
    return currentRootSubTab === 'active' ? !isClosed : isClosed;
  });

  if (!filtered.length) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:16px 0;">${currentRootSubTab === 'active' ? 'Нет активных заказов' : 'Архив пуст'}</div>`;
    return;
  }

  container.innerHTML = filtered.map(ord => {
    const isAwaiting = (ord.status === 'Ожидает оплаты' || ord.status === 'Ожидает подтверждения оплаты');
    const isAssembly = (ord.status === 'Ожидает согласования упаковки');
    const deliveryCostText = ord.delivery_type === 'delivery' 
      ? (ord.delivery_cost ? `${ord.delivery_cost} ₽` : 'Рассчитана при оформлении')
      : '0 ₽ (Самовывоз)';

    const itemsListText = (ord.items || []).map(i => {
      const fullTitle = formatFullItemTitle(i.title, i.unit, i.variant, i.color);
      const bqTag = i.in_bouquet ? ' [в букет]' : '';
      return `• ${fullTitle} × ${i.qty} шт. = ${i.price * i.qty} ₽${bqTag}`;
    }).join('<br>');

    const hasDistinctRecipient = ord.recipient_info && ord.recipient_info.trim() !== "" && ord.recipient_info !== "Заказчик лично";
    const safeAddr = (ord.address || "").replace(/'/g, "\\'");

    return `
      <div class="box-card" style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <b>${ord.order_id}</b>
          <span class="status-badge st-building">${ord.status}</span>
        </div>
        <div style="font-size:12px; line-height:1.55; color:var(--text); background:var(--card-inner); padding:8px 10px; border-radius:8px; margin-bottom:8px;">
          <b>Заказчик:</b> ${ord.user_name} (${ord.user_phone})<br>
          ${hasDistinctRecipient ? `<b>Получатель:</b> <span style="color:var(--cyan);">${ord.recipient_info}</span><br>` : ''}
          <b>Адрес:</b> ${ord.address}<br>
          <b>Стоимость доставки:</b> ${deliveryCostText}<br>
          <b>Желаемое время:</b> ${ord.delivery_time || 'Как можно скорее'}<br>
          ${ord.shop_comment ? `<b>Комментарий салону:</b> ${ord.shop_comment}<br>` : ''}
          <div style="margin:6px 0; padding-top:6px; border-top:1px dashed var(--border);">
            <b>Состав заказа:</b><br>
            ${itemsListText || '<i>Нет данных о составе</i>'}
          </div>
          <b>Сумма заказа:</b> <span style="color:var(--green); font-weight:800;">${ord.total_amount} ₽</span>
        </div>
        ${isAssembly ? `
          <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); border-radius:8px; padding:8px; font-size:11px; color:var(--amber); margin-bottom:6px;">
            💐 <b>Требуется сборка букета!</b> Согласуйте упаковку с клиентом, скорректируйте сумму в «Составе заказа» и переведите в «Ожидает оплаты».
          </div>
        ` : ''}
        ${isAwaiting ? `
          <button class="btn-metro" style="font-size:11px; padding:7px; margin-bottom:6px;" onclick="confirmOrderRoot('${ord.order_id}')">
            ✅ Оплата поступила ➔ В «Собирается»
          </button>
        ` : ''}
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px;">
          <button class="btn-metro btn-secondary" style="font-size:11px; padding:7px;" onclick="openCourierModal('${ord.order_id}')">📋 Для курьера</button>
          <button class="btn-metro btn-secondary" style="font-size:11px; padding:7px; color:var(--amber);" onclick="openYandexGoDelivery('${safeAddr}')">
            🚚 Яндекс Go
          </button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <button class="btn-metro btn-secondary" style="font-size:11px; padding:7px;" onclick="openStatusModal('${ord.order_id}')">Сменить статус</button>
          <button class="btn-metro btn-secondary" style="font-size:11px; padding:7px;" onclick="openEditItemsModal('${ord.order_id}')">Состав заказа</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:6px;">
          <button class="btn-metro btn-secondary" style="font-size:11px; padding:7px;" onclick="triggerOrderPhotoUpload('${ord.order_id}')">📸 Фото букета</button>
          <button class="btn-metro btn-danger" style="font-size:11px; padding:7px;" onclick="openTopConfirm('${ord.order_id}')">Удалить заказ</button>
        </div>
      </div>
    `;
  }).join('');
}

function openYandexGoDelivery(orderAddress = "") {
  if (orderAddress && navigator.clipboard) {
    navigator.clipboard.writeText(orderAddress);
    toast("Адрес скопирован! Вставьте его в Яндекс Go");
  }
  const appUrl = "yandexgo://route";
  const webUrl = "https://3.redirect.appmetrica.yandex.com/route?appmetrica_tracking_id=1178268795219780156";

  if (tg && tg.openLink) {
    tg.openLink(appUrl);
    setTimeout(() => tg.openLink(webUrl), 1000);
  } else {
    window.location.href = appUrl;
    setTimeout(() => window.open(webUrl, '_blank'), 1000);
  }
}

function openCourierModal(orderId) {
  const ord = allRootOrders.find(o => o.order_id === orderId);
  if (!ord) return;

  const hasDistinct = ord.recipient_info && ord.recipient_info.trim() !== "" && ord.recipient_info !== "Заказчик лично";
  let recName = ord.user_name || "Клиент";
  let rawPhone = ord.user_phone || "";

  if (hasDistinct) {
    const match = ord.recipient_info.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      recName = match[1].trim();
      rawPhone = match[2].trim();
    } else {
      recName = ord.recipient_info;
    }
  }

  let cleanPhone = rawPhone.replace(/\D/g, '');
  if (cleanPhone.startsWith('7') || cleanPhone.startsWith('8')) {
    cleanPhone = cleanPhone.substring(1);
  }

  let commentVal = "";
  const commentMatch = (ord.address || "").match(/\[курьеру:\s*(.*?)\]/i);
  if (commentMatch && commentMatch[1]) {
    commentVal = commentMatch[1].trim();
  }

  const cleanAddress = (ord.address || "").replace(/\s*\[курьеру:.*?\]/i, '').trim();

  document.getElementById('courier-modal-title').innerText = `Курьер: ${ord.order_id}`;
  document.getElementById('courier-val-address').innerText = cleanAddress || "—";
  document.getElementById('courier-val-name').innerText = recName || "—";
  document.getElementById('courier-val-phone').innerText = cleanPhone || "—";
  document.getElementById('courier-val-note').innerText = "Хрупкий товар — ЦВЕТЫ. Везти вертикально, аккуратно";

  const commentCard = document.getElementById('courier-comment-card');
  if (commentVal) {
    document.getElementById('courier-val-comment').innerText = commentVal;
    commentCard.style.display = 'flex';
  } else {
    commentCard.style.display = 'none';
  }

  document.getElementById('courier-modal').classList.add('open');
}

function closeCourierModal() {
  document.getElementById('courier-modal').classList.remove('open');
}

function copyCourierSingleField(elId, fieldName) {
  const el = document.getElementById(elId);
  const val = el ? el.innerText.trim() : "";
  if (!val || val === "—") return;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(val);
    toast(`${fieldName} скопирован!`);
  }
}

async function confirmOrderRoot(orderId) {
  toast("Подтверждение...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "admin_update_order", admin_id: userId, admin_passcode: sessionPasscode, order_id: orderId, status: "Собирается" })
  });
  loadRootOrders(true);
}

function openStatusModal(orderId) {
  activeRootOrderForStatus = orderId;
  document.getElementById('status-modal-title').innerText = `Статус ${orderId}`;
  document.getElementById('status-modal').classList.add('open');
}
function closeStatusModal() { document.getElementById('status-modal').classList.remove('open'); }

async function applyStatusChoice(st) {
  if (!activeRootOrderForStatus) return;
  const oid = activeRootOrderForStatus;
  closeStatusModal();
  toast("Обновление...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "admin_update_order", admin_id: userId, admin_passcode: sessionPasscode, order_id: oid, status: st })
  });
  loadRootOrders(true);
}

function populateCatalogDropdown() {
  const optionsBox = document.getElementById('add-item-catalog-options');
  if (!optionsBox) return;
  optionsBox.innerHTML = catalog.map(c => {
    const fullTitle = formatFullItemTitle(c.title, c.unit, c.variant, c.color);
    return `
      <div class="custom-select-option" onclick="selectItemToAddToOrder('${c.id}')">
        ${fullTitle} — ${c.price} ₽
      </div>
    `;
  }).join('');
}

function selectItemToAddToOrder(cid) {
  tempSelectedCatalogIdToAdd = cid;
  const c = catalog.find(i => String(i.id) === String(cid));
  if (c) {
    document.getElementById('add-item-catalog-display').innerText = `${formatFullItemTitle(c.title, c.unit, c.variant, c.color)} — ${c.price} ₽`;
  }
  document.getElementById('add-item-catalog-box').classList.remove('open');
}

function openEditItemsModal(orderId) {
  const ord = allRootOrders.find(o => o.order_id === orderId);
  if (!ord) return;
  activeRootOrderForEdit = ord;
  tempEditingItems = JSON.parse(JSON.stringify(ord.items || []));
  tempSelectedCatalogIdToAdd = "";
  document.getElementById('add-item-catalog-display').innerText = "Выберите цветок для добавления...";
  document.getElementById('edit-items-modal-title').innerText = `Состав ${orderId}`;

  const hasDistinct = ord.recipient_info && ord.recipient_info.trim() !== "" && ord.recipient_info !== "Заказчик лично";
  document.getElementById('edit-order-client-info').innerHTML = `
    <b>Заказчик:</b> ${ord.user_name} (${ord.user_phone})<br>
    ${hasDistinct ? `<b>Получатель:</b> <span style="color:var(--cyan);">${ord.recipient_info}</span>` : `<b>Получатель:</b> Заказчик лично`}
  `;
 
  document.getElementById('edit-order-delivery-input').value = ord.delivery_cost || 0;
  document.getElementById('edit-order-assembly-input').value = 0;
 
  renderEditItemsList();
  recalcEditOrderTotalFromInputs();
  document.getElementById('edit-items-modal').classList.add('open');
}
function closeEditItemsModal() { document.getElementById('edit-items-modal').classList.remove('open'); }

function renderEditItemsList() {
  const box = document.getElementById('edit-items-list');
  box.innerHTML = tempEditingItems.map((it, idx) => {
    const fullTitle = formatFullItemTitle(it.title, it.unit, it.variant, it.color);
    const packTag = it.in_bouquet ? ' <b>[в букет]</b>' : '';
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px;">
        <div>${fullTitle}${packTag} (${it.price} ₽ × ${it.qty})</div>
        <div style="display:flex; gap:4px;">
          <button class="qty-btn" style="width:24px; height:24px;" onclick="tempEditingItems[${idx}].qty++; renderEditItemsList(); recalcEditOrderTotalFromInputs();">+</button>
          <button class="qty-btn" style="width:24px; height:24px;" onclick="if(--tempEditingItems[${idx}].qty<=0) tempEditingItems.splice(${idx},1); renderEditItemsList(); recalcEditOrderTotalFromInputs();">–</button>
        </div>
      </div>
    `;
  }).join('');
}

function recalcEditOrderTotalFromInputs() {
  const itemsSum = tempEditingItems.reduce((acc, it) => acc + (it.price * it.qty), 0);
  const deliverySum = parseFloat(document.getElementById('edit-order-delivery-input').value) || 0;
  const assemblySum = parseFloat(document.getElementById('edit-order-assembly-input').value) || 0;
  document.getElementById('edit-order-total-input').value = itemsSum + deliverySum + assemblySum;
}

function addItemToCurrentOrder() {
  if (!tempSelectedCatalogIdToAdd) { toast("Выберите цветок из списка"); return; }
  const c = catalog.find(i => String(i.id) === String(tempSelectedCatalogIdToAdd));
  if (!c) return;
  const ex = tempEditingItems.find(i => String(i.id) === String(c.id));
  if (ex) ex.qty++; 
  else tempEditingItems.push({ 
    id: c.id, 
    title: c.title, 
    unit: c.unit || '1 шт.', 
    variant: c.variant || '', 
    color: c.color || '', 
    price: c.price, 
    qty: 1 
  });
  renderEditItemsList();
  recalcEditOrderTotalFromInputs();
}

async function saveEditedOrderItems() {
  if (!activeRootOrderForEdit) return;
  const totalAmountVal = parseFloat(document.getElementById('edit-order-total-input').value) || 0;

  let nextStatus = activeRootOrderForEdit.status;
  if (nextStatus === 'Ожидает согласования упаковки') {
    nextStatus = 'Ожидает оплаты';
  }

  toast("Сохранение и выставление счета...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_update_order", admin_id: userId, admin_passcode: sessionPasscode,
      order_id: activeRootOrderForEdit.order_id,
      items: tempEditingItems,
      total_amount: totalAmountVal,
      status: nextStatus
    })
  });
  closeEditItemsModal();
  loadRootOrders(true);
  toast("Счет обновлен!");
}

function openTopConfirm(orderId) {
  document.getElementById('top-confirm-text').innerText = `Удалить заказ ${orderId} безвозвратно?`;
  document.getElementById('top-confirm-yes-btn').onclick = () => confirmDeleteOrderExecute(orderId);
  document.getElementById('top-confirm-popup').classList.add('show');
}

function closeTopConfirm() {
  document.getElementById('top-confirm-popup').classList.remove('show');
}

async function confirmDeleteOrderExecute(orderId) {
  closeTopConfirm();
  toast("Удаление...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "admin_delete_order", admin_id: userId, admin_passcode: sessionPasscode, order_id: orderId })
  });
  loadRootOrders(true);
}

function triggerOrderPhotoUpload(orderId) {
  uploadTargetContext = { type: 'order', id: orderId };
  document.getElementById('camera-file-input').click();
}

function triggerProductPhotoUpload(target) {
  driveModalTarget = target;
  uploadTargetContext = { type: 'product', target: target };
  document.getElementById('camera-file-input').click();
}

async function handleNativeFileSelect(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  toast("Загрузка...");
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: "admin_upload_photo", admin_id: userId, admin_passcode: sessionPasscode,
        base64: base64,
        order_id: uploadTargetContext.type === 'order' ? uploadTargetContext.id : ""
      })
    });
    const d = await res.json();
    if (d.success && uploadTargetContext.type === 'product') {
      if (uploadTargetContext.target === 'group') {
        addGroupPhotoUrl(d.photo_url);
      } else {
        addProductPhotoUrl(d.photo_url);
      }
      toast("Фото добавлено!");
    } else if (d.success) {
      toast("Фото букета отправлено клиенту!");
    }
  };
  reader.readAsDataURL(file);
  input.value = "";
}

function renderProductEditorPhotos(urlsStr) {
  const box = document.getElementById('prod-photo-strip');
  const hiddenInput = document.getElementById('prod-edit-photo');
  hiddenInput.value = urlsStr || "";
  const urls = (urlsStr || "").split(',').map(s => s.trim()).filter(Boolean);

  if (!urls.length) {
    box.innerHTML = '<span style="font-size:11px; color:var(--text-muted); padding:4px 0;">Нет фото</span>';
    return;
  }

  box.innerHTML = urls.map((u, idx) => `
    <div class="prod-photo-thumb-wrap">
      <img src="${u}">
      <button class="prod-photo-del-btn" onclick="removeProductPhoto(${idx})">✕</button>
    </div>
  `).join('');
}

function addProductPhotoUrl(url) {
  const hiddenInput = document.getElementById('prod-edit-photo');
  const cur = hiddenInput.value.trim();
  const updated = cur ? `${cur}, ${url}` : url;
  renderProductEditorPhotos(updated);
}

function removeProductPhoto(idx) {
  const hiddenInput = document.getElementById('prod-edit-photo');
  const urls = hiddenInput.value.split(',').map(s => s.trim()).filter(Boolean);
  urls.splice(idx, 1);
  renderProductEditorPhotos(urls.join(', '));
}

function renderGroupEditorPhotos(urlsStr) {
  const box = document.getElementById('group-photo-strip');
  const hiddenInput = document.getElementById('group-edit-photo');
  hiddenInput.value = urlsStr || "";
  const urls = (urlsStr || "").split(',').map(s => s.trim()).filter(Boolean);

  if (!urls.length) {
    box.innerHTML = '<span style="font-size:11px; color:var(--text-muted); padding:4px 0;">Нет фото</span>';
    return;
  }

  box.innerHTML = urls.map((u, idx) => `
    <div class="prod-photo-thumb-wrap">
      <img src="${u}">
      <button class="prod-photo-del-btn" onclick="removeGroupPhoto(${idx})">✕</button>
    </div>
  `).join('');
}

function addGroupPhotoUrl(url) {
  const hiddenInput = document.getElementById('group-edit-photo');
  const cur = hiddenInput.value.trim();
  const updated = cur ? `${cur}, ${url}` : url;
  renderGroupEditorPhotos(updated);
}

function removeGroupPhoto(idx) {
  const hiddenInput = document.getElementById('group-edit-photo');
  const urls = hiddenInput.value.split(',').map(s => s.trim()).filter(Boolean);
  urls.splice(idx, 1);
  renderGroupEditorPhotos(urls.join(', '));
}

function openDriveMediaModal(target) {
  driveModalTarget = target;
  document.getElementById('drive-media-modal').classList.add('open');
  const box = document.getElementById('drive-media-container');
  box.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">Загрузка медиа...</div>';
  fetch(`${API_URL}?action=admin_drive_media&admin_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`)
    .then(r => r.json())
    .then(media => {
      if (!media.length) { box.innerHTML = '<div style="grid-column:1/-1; text-align:center;">Папка пуста</div>'; return; }
      box.innerHTML = media.map(m => `
        <div class="drive-media-item" onclick="selectDrivePhoto('${m.url}')">
          <img src="${m.url}" loading="lazy">
        </div>
      `).join('');
    })
    .catch(() => { box.innerHTML = '<div style="grid-column:1/-1; text-align:center;">Ошибка загрузки</div>'; });
}

function closeDriveMediaModal() { document.getElementById('drive-media-modal').classList.remove('open'); }

function selectDrivePhoto(url) {
  if (driveModalTarget === 'group') {
    addGroupPhotoUrl(url);
  } else {
    addProductPhotoUrl(url);
  }
  closeDriveMediaModal();
  toast("Фото прикреплено");
}

async function loadRootCatalog() {
  const container = document.getElementById('root-catalog-container');
  const res = await fetch(`${API_URL}?action=admin_full_catalog&admin_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`);
  allRootCatalog = await res.json();

  const groups = {};
  allRootCatalog.forEach(item => {
    const titleKey = item.title.trim();
    if (!groups[titleKey]) groups[titleKey] = [];
    groups[titleKey].push(item);
  });

  const rootCards = [];
  Object.keys(groups).forEach(key => {
    const list = groups[key];
    if (list.length > 1) {
      rootCards.push({ is_group: true, title: key, items: list });
    } else {
      rootCards.push({ is_group: false, item: list[0] });
    }
  });

  container.innerHTML = rootCards.map(c => {
    if (c.is_group) {
      const activeCount = c.items.filter(i => i.is_active).length;
      const prices = c.items.map(i => i.price);
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const photoCount = (c.items[0].photo_url ? c.items[0].photo_url.split(',').length : 0);

      return `
        <div class="box-card" style="margin-bottom:8px; border-left: 3px solid var(--cyan);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <b>${c.title}</b> <span style="font-size:10px; background:rgba(56,189,248,0.15); color:var(--cyan); padding:2px 6px; border-radius:4px; font-weight:700;">Группа (${c.items.length})</span>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Категория: ${c.items[0].category} · Фото: ${photoCount}</div>
              <div style="font-size:11px; color:var(--amber); margin-top:2px;">Наличие: ${activeCount} из ${c.items.length} активны</div>
            </div>
            <div style="text-align:right;">
              <span style="color:var(--green); font-weight:800; font-size:13px;">${minP === maxP ? minP + ' ₽' : minP + '–' + maxP + ' ₽'}</span>
            </div>
          </div>
          <div style="display:flex; gap:6px; margin-top:8px;">
            <button class="btn-metro btn-secondary" style="font-size:11px; padding:6px;" onclick="openEditGroupModal('${encodeURIComponent(c.title)}')">⚙️ Редактировать группу</button>
          </div>
        </div>
      `;
    } else {
      const it = c.item;
      const fullTitle = formatFullItemTitle(it.title, it.unit, it.variant, it.color);
      return `
        <div class="box-card" style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between;">
            <b>${fullTitle} ${it.is_popular ? '(🔥 Хит)' : ''}</b>
            <span style="color:var(--green); font-weight:800;">${it.price} ₽</span>
          </div>
          <div style="font-size:11px; color:var(--cyan); margin:2px 0;">Формат: ${it.unit || '1 шт.'} · Высота: ${it.variant || '—'} · Цвет: ${it.color || '—'}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">На витрине: ${it.is_active ? 'Да' : 'Нет'}</div>
          <div style="display:flex; gap:6px;">
            <button class="btn-metro btn-secondary" style="font-size:11px; padding:6px;" onclick="openEditProductModal('${it.id}')">Редактировать</button>
            <button class="btn-metro btn-secondary" style="font-size:11px; padding:6px; color:var(--cyan);" onclick="convertProductToGroup('${it.id}')">+ В группу</button>
            <button class="btn-metro btn-danger" style="font-size:11px; padding:6px; max-width:80px;" onclick="deleteProductRoot('${it.id}')">Удалить</button>
          </div>
        </div>
      `;
    }
  }).join('');
}

function convertProductToGroup(id) {
  const it = allRootCatalog.find(i => String(i.id) === String(id));
  if (!it) return;

  editingGroupName = it.title;
  document.getElementById('group-edit-title').innerText = `Группа: ${it.title}`;
  document.getElementById('group-edit-name').value = it.title;
  document.getElementById('group-edit-cat').value = it.category;
  document.getElementById('group-edit-desc').value = it.description || "";
 
  const popEl = document.getElementById('group-edit-popular-ui');
  popEl.classList.toggle('checked', !!it.is_popular);
  popEl.innerText = it.is_popular ? '✓' : '';

  renderGroupEditorPhotos(it.photo_url || "");

  const tbody = document.getElementById('group-variants-tbody');
  tbody.innerHTML = "";
  addGroupVariantRow({ id: it.id, unit: it.unit || "1 шт.", variant: it.variant || "", color: it.color || "", price: it.price, is_active: it.is_active });
  addGroupVariantRow({ unit: it.unit || "1 шт.", variant: "", color: "", price: it.price, is_active: true });

  document.getElementById('group-editor-modal').classList.add('open');
  toast("Создание группы на базе цветка");
}

function openAddGroupModal() {
  editingGroupName = null;
  document.getElementById('group-edit-title').innerText = "Создать группу вариаций";
  document.getElementById('group-edit-name').value = "";
  document.getElementById('group-edit-cat').value = "Цветы";
  document.getElementById('group-edit-desc').value = "";
 
  const popEl = document.getElementById('group-edit-popular-ui');
  popEl.classList.remove('checked'); popEl.innerText = '';
 
  renderGroupEditorPhotos("");

  const tbody = document.getElementById('group-variants-tbody');
  tbody.innerHTML = "";
  addGroupVariantRow({ unit: "15 шт.", variant: "50 см", color: "Красный", price: 3500, is_active: true });
  addGroupVariantRow({ unit: "15 шт.", variant: "60 см", color: "Красный", price: 4000, is_active: true });
  document.getElementById('group-editor-modal').classList.add('open');
}

function openEditGroupModal(encodedTitle) {
  const title = decodeURIComponent(encodedTitle);
  editingGroupName = title;
  const groupItems = allRootCatalog.filter(i => i.title.trim() === title.trim());
  if (!groupItems.length) return;

  document.getElementById('group-edit-title').innerText = `Группа: ${title}`;
  document.getElementById('group-edit-name').value = title;
  document.getElementById('group-edit-cat').value = groupItems[0].category;
  document.getElementById('group-edit-desc').value = groupItems[0].description || "";
 
  const isPop = groupItems.some(i => i.is_popular);
  const popEl = document.getElementById('group-edit-popular-ui');
  popEl.classList.toggle('checked', isPop);
  popEl.innerText = isPop ? '✓' : '';

  const hasPhoto = groupItems.find(i => i.photo_url);
  renderGroupEditorPhotos(hasPhoto ? hasPhoto.photo_url : "");

  const tbody = document.getElementById('group-variants-tbody');
  tbody.innerHTML = "";
  groupItems.forEach(item => {
    addGroupVariantRow(item);
  });

  document.getElementById('group-editor-modal').classList.add('open');
}

function closeGroupEditorModal() { document.getElementById('group-editor-modal').classList.remove('open'); }

function addGroupVariantRow(data = {}) {
  const tbody = document.getElementById('group-variants-tbody');
  const tr = document.createElement('tr');
  tr.dataset.id = data.id || "";
  tr.innerHTML = `
    <td><input type="text" class="gv-unit" value="${data.unit || '15 шт.'}" placeholder="15 шт."></td>
    <td><input type="text" class="gv-variant" value="${data.variant || ''}" placeholder="60 см"></td>
    <td><input type="text" class="gv-color" value="${data.color || ''}" placeholder="Красный"></td>
    <td><input type="number" class="gv-price" value="${data.price || 3500}"></td>
    <td style="text-align:center;">
      <div class="custom-checkbox ${data.is_active !== false ? 'checked' : ''}" style="width:18px; height:18px; margin:0 auto;" onclick="this.classList.toggle('checked'); this.innerText = this.classList.contains('checked') ? '✓' : '';">${data.is_active !== false ? '✓' : ''}</div>
    </td>
    <td><button class="btn-trash-mini" style="color:var(--red); font-size:14px;" onclick="this.closest('tr').remove()">✕</button></td>
  `;
  tbody.appendChild(tr);
}

async function saveGroupEditor() {
  const title = document.getElementById('group-edit-name').value.trim();
  const cat = document.getElementById('group-edit-cat').value.trim();
  const photo = document.getElementById('group-edit-photo').value.trim();
  const desc = document.getElementById('group-edit-desc').value.trim();
  const isPop = document.getElementById('group-edit-popular-ui').classList.contains('checked');

  if (!title) { toast("Укажите базовое название группы"); return; }

  const rows = Array.from(document.querySelectorAll('#group-variants-tbody tr'));
  if (!rows.length) { toast("Добавьте хотя бы одну вариацию"); return; }

  const variants = rows.map(r => ({
    id: r.dataset.id || null,
    unit: r.querySelector('.gv-unit').value.trim() || '1 шт.',
    variant: r.querySelector('.gv-variant').value.trim(),
    color: r.querySelector('.gv-color').value.trim(),
    price: parseFloat(r.querySelector('.gv-price').value) || 0,
    is_active: r.querySelector('.custom-checkbox').classList.contains('checked')
  }));

  toast("Сохранение группы...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_save_group",
      admin_id: userId,
      admin_passcode: sessionPasscode,
      title: title,
      category: cat,
      photo_url: photo,
      description: desc,
      is_popular: isPop,
      variants_json: JSON.stringify(variants)
    })
  });

  toast("Группа товаров сохранена!");
  closeGroupEditorModal();
  loadRootCatalog();
  loadCatalog();
}

function openAddProductModal() {
  editingProductId = null;
  document.getElementById('prod-edit-title').innerText = "Новый одиночный товар";
  document.getElementById('prod-edit-name').value = "";
  document.getElementById('prod-edit-unit').value = "1 шт.";
  document.getElementById('prod-edit-variant').value = "";
  document.getElementById('prod-edit-color').value = "";
  document.getElementById('prod-edit-cat').value = "Цветы";
  document.getElementById('prod-edit-price').value = "";
  document.getElementById('prod-edit-desc').value = "";
 
  const actEl = document.getElementById('prod-edit-active-ui');
  actEl.classList.add('checked'); actEl.innerText = '✓';
  const popEl = document.getElementById('prod-edit-popular-ui');
  popEl.classList.remove('checked'); popEl.innerText = '';

  renderProductEditorPhotos("");
  document.getElementById('product-editor-modal').classList.add('open');
}

function openEditProductModal(id) {
  const item = allRootCatalog.find(i => String(i.id) === String(id));
  if (!item) return;
  editingProductId = item.id;
  document.getElementById('prod-edit-title').innerText = `Товар ID: ${item.id}`;
  document.getElementById('prod-edit-name').value = item.title;
  document.getElementById('prod-edit-unit').value = item.unit || "1 шт.";
  document.getElementById('prod-edit-variant').value = item.variant || "";
  document.getElementById('prod-edit-color').value = item.color || "";
  document.getElementById('prod-edit-cat').value = item.category;
  document.getElementById('prod-edit-price').value = item.price;
  document.getElementById('prod-edit-desc').value = item.description || "";
 
  const actEl = document.getElementById('prod-edit-active-ui');
  actEl.classList.toggle('checked', !!item.is_active);
  actEl.innerText = item.is_active ? '✓' : '';

  const popEl = document.getElementById('prod-edit-popular-ui');
  popEl.classList.toggle('checked', !!item.is_popular);
  popEl.innerText = item.is_popular ? '✓' : '';

  renderProductEditorPhotos(item.photo_url || "");
  document.getElementById('product-editor-modal').classList.add('open');
}
function closeProductEditorModal() { document.getElementById('product-editor-modal').classList.remove('open'); }

async function saveProductEditor() {
  const payload = {
    action: editingProductId ? "admin_update_product" : "admin_add_product",
    admin_id: userId, admin_passcode: sessionPasscode,
    id: editingProductId,
    title: document.getElementById('prod-edit-name').value.trim(),
    unit: document.getElementById('prod-edit-unit').value.trim(),
    variant: document.getElementById('prod-edit-variant').value.trim(),
    color: document.getElementById('prod-edit-color').value.trim(),
    category: document.getElementById('prod-edit-cat').value.trim(),
    price: parseFloat(document.getElementById('prod-edit-price').value) || 0,
    photo_url: document.getElementById('prod-edit-photo').value.trim(),
    description: document.getElementById('prod-edit-desc').value.trim(),
    is_active: document.getElementById('prod-edit-active-ui').classList.contains('checked'),
    is_popular: document.getElementById('prod-edit-popular-ui').classList.contains('checked')
  };
  await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
  toast("Каталог обновлен");
  closeProductEditorModal();
  loadRootCatalog();
  loadCatalog();
}

async function deleteProductRoot(id) {
  if (!confirm("Удалить этот товар из базы?")) return;
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "admin_delete_product", admin_id: userId, admin_passcode: sessionPasscode, id: id })
  });
  loadRootCatalog();
  loadCatalog();
}

async function loadRootClients() {
  const container = document.getElementById('root-clients-container');
  const res = await fetch(`${API_URL}?action=admin_clients&admin_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`);
  allRootClients = await res.json();
  renderRootClients(allRootClients);
}

function filterRootClients() {
  const q = document.getElementById('root-client-search').value.toLowerCase().trim();
  const filtered = allRootClients.filter(c => 
    (c.name && c.name.toLowerCase().includes(q)) ||
    (c.phone && c.phone.includes(q)) ||
    (c.username && c.username.toLowerCase().includes(q))
  );
  renderRootClients(filtered);
}

function renderRootClients(clients) {
  const container = document.getElementById('root-clients-container');
  container.innerHTML = clients.map(c => {
    const hasTgUser = c.username && c.username !== 'скрыт' && c.username.length > 2;
    const tgLink = hasTgUser 
      ? `https://t.me/${c.username.replace('@','')}`
      : (!c.user_id.startsWith('anon_') ? `tg://user?id=${c.user_id}` : '');

    const isClientAdmin = c.is_admin === true || String(c.is_admin).trim().toUpperCase() === 'TRUE' || String(c.user_id) === ADMIN_TELEGRAM_ID;

    return `
      <div class="box-card" style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between;">
          <div>
            <b>${c.name}</b> ${isClientAdmin ? '<span style="font-size:10px; background:rgba(16,185,129,0.15); color:var(--green); padding:1px 6px; border-radius:4px; font-weight:800;">ADMIN</span>' : ''}<br>
            <span style="font-size:12px; color:var(--text-muted);">${c.phone}</span>
          </div>
          <div style="text-align:right;"><span style="color:var(--green); font-weight:800;">${c.total_spent} ₽</span></div>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin:4px 0;">Telegram: ${c.username || 'скрыт'} · Рег: ${c.reg_date}</div>
 
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:8px;">
          <a href="tel:${c.phone}" class="btn-metro btn-emerald" style="font-size:11px; padding:7px; text-decoration:none;">📞 Позвонить</a>
          ${tgLink ? `
            <a href="${tgLink}" target="_blank" class="btn-metro btn-secondary" style="font-size:11px; padding:7px; color:var(--cyan); text-decoration:none;">💬 Написать</a>
          ` : `
            <button class="btn-metro btn-secondary" style="font-size:11px; padding:7px; opacity:0.45;" disabled>💬 Чат скрыт</button>
          `}
        </div>

        <div style="display:flex; gap:6px; margin-top:6px;">
          <button class="btn-metro btn-secondary" style="font-size:11px; padding:6px;" onclick="editSpentPrompt('${c.user_id}', ${c.total_spent})">Изменить выкуп</button>
          <button class="btn-metro btn-danger" style="font-size:11px; padding:6px;" onclick="deleteUserRoot('${c.user_id}')">Сбросить</button>
        </div>
      </div>
    `;
  }).join('');
}

async function editSpentPrompt(uid, current) {
  const val = prompt("Новая сумма выкупа (₽):", current);
  if (!val || isNaN(val)) return;
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "admin_update_spent", admin_id: userId, admin_passcode: sessionPasscode, target_user_id: uid, total_spent: parseFloat(val) })
  });
  loadRootClients();
}

async function deleteUserRoot(uid) {
  if (!confirm("Сбросить аккаунт клиента?")) return;
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "admin_delete_user", admin_id: userId, admin_passcode: sessionPasscode, target_user_id: uid })
  });
  loadRootClients();
}

// ----------------- УПРАВЛЕНИЕ УВЕДОМЛЕНИЯМИ В ROOT -----------------

function selectRootNotifTab(val, label) {
  const hiddenInput = document.getElementById('root-notif-tab');
  const displaySpan = document.getElementById('root-notif-tab-display');
  const selectBox = document.getElementById('root-notif-tab-box');
  if (hiddenInput) hiddenInput.value = val;
  if (displaySpan) displaySpan.innerText = label;
  if (selectBox) selectBox.classList.remove('open');
}
window.selectRootNotifTab = selectRootNotifTab;

async function loadRootNotifications() {
  const container = document.getElementById('root-notifs-container');
  try {
    const res = await fetch(`${API_URL}?action=admin_notifications&admin_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`);
    allRootNotifs = await res.json();
    renderRootNotifications();
  } catch (e) {
    if (container) container.innerHTML = '<div style="color:var(--text-muted); font-size:12px; padding:12px 0;">Ошибка загрузки уведомлений</div>';
  }
}

function renderRootNotifications() {
  const container = document.getElementById('root-notifs-container');
  if (!container) return;

  if (!allRootNotifs.length) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:16px 0; font-size:12px;">Рассылок пока нет</div>';
    return;
  }

  container.innerHTML = allRootNotifs.map(n => {
    const targetTitle = getTabDisplayTitle(n.target_tab);
    return `
      <div class="box-card" style="margin-bottom:8px; border-left: 3px solid ${n.is_active ? 'var(--cyan)' : 'var(--border)'};">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
          <div>
            <b style="font-size:13px; color:var(--text);">${n.title}</b>
            <span style="font-size:10px; margin-left:6px; color:${n.is_active ? 'var(--cyan)' : 'var(--text-muted)'}; font-weight:700;">
              ${n.is_active ? 'АКТИВНО' : 'В АРХИВЕ'}
            </span>
          </div>
          <span style="font-size:10px; color:var(--text-muted);">${n.created_at || ''}</span>
        </div>
        <div style="font-size:12px; color:var(--text-muted); line-height:1.45; margin-bottom:6px;">${n.text}</div>
        <div style="font-size:11px; color:var(--cyan); margin-bottom:8px;">Целевой экран: <b>${targetTitle}</b></div>

        <div style="display:flex; gap:6px;">
          <button class="btn-metro btn-secondary" style="font-size:11px; padding:6px;" onclick="toggleNotificationActiveRoot('${n.id}')">
            ${n.is_active ? 'В архив' : 'Восстановить'}
          </button>
          <button class="btn-metro btn-secondary" style="font-size:11px; padding:6px; color:var(--cyan);" onclick="repeatNotificationRoot('${n.id}')">
            Повторить TG
          </button>
          <button class="btn-metro btn-danger" style="font-size:11px; padding:6px; max-width:80px;" onclick="deleteNotificationRoot('${n.id}')">
            Удалить
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function submitCreateNotification() {
  const title = document.getElementById('root-notif-title').value.trim();
  const text = document.getElementById('root-notif-text').value.trim();
  const targetTab = document.getElementById('root-notif-tab').value.trim() || 'catalog';
  const sendTg = document.getElementById('root-notif-tg-ui').classList.contains('checked');

  if (!title || !text) {
    toast("Заполните заголовок и текст");
    return;
  }

  toast("Создание и отправка...");
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: "admin_create_notification",
        admin_id: userId,
        admin_passcode: sessionPasscode,
        title: title,
        text: text,
        target_tab: targetTab,
        tg_broadcast: sendTg
      })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('root-notif-title').value = '';
      document.getElementById('root-notif-text').value = '';
      toast(sendTg ? "Уведомление отправлено всем клиентам!" : "Уведомление добавлено в приложение!");
      loadRootNotifications();
    }
  } catch (e) {
    toast("Ошибка создания уведомления");
  }
}

async function toggleNotificationActiveRoot(id) {
  toast("Обновление...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_toggle_notification",
      admin_id: userId,
      admin_passcode: sessionPasscode,
      id: id
    })
  });
  loadRootNotifications();
}

async function repeatNotificationRoot(id) {
  if (!confirm("Повторно отправить это оповещение в Telegram всем покупателям?")) return;
  toast("Рассылка...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_repeat_notification",
      admin_id: userId,
      admin_passcode: sessionPasscode,
      id: id
    })
  });
  toast("Сообщение отправлено!");
}

async function deleteNotificationRoot(id) {
  if (!confirm("Удалить это уведомление и очистить его статистику?")) return;
  toast("Удаление...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_delete_notification",
      admin_id: userId,
      admin_passcode: sessionPasscode,
      id: id
    })
  });
  loadRootNotifications();
}

// ----------------- СТАТИСТИКА И ДАШБОРД В ROOT -----------------

function switchStatsPeriod(period) {
  currentStatsPeriod = period;
  ['today', '7days', 'month'].forEach(p => {
    const el = document.getElementById('tab-stat-' + p);
    if (el) el.classList.toggle('active', p === period);
  });
  renderRootStats();
}
window.switchStatsPeriod = switchStatsPeriod;

async function loadRootStats(period = 'today') {
  currentStatsPeriod = period;
  try {
    const res = await fetch(`${API_URL}?action=admin_stats&admin_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`);
    cachedStatsData = await res.json();
    renderRootStats();
  } catch (e) {
    toast("Ошибка загрузки аналитики");
  }
}

function renderRootStats() {
  if (!cachedStatsData) return;

  let totalVisits = 0;
  let totalOrdersCount = 0;
  let totalRevenue = 0;
  let totalCompleted = 0;

  const breakdownBox = document.getElementById('stats-daily-breakdown');
  const breakdownTbody = document.getElementById('stats-daily-tbody');

  if (currentStatsPeriod === 'today') {
    if (breakdownBox) breakdownBox.style.display = 'none';
    totalVisits = cachedStatsData.today?.visits || 0;
    totalOrdersCount = cachedStatsData.today?.orders?.count || 0;
    totalRevenue = cachedStatsData.today?.orders?.total || 0;
    totalCompleted = cachedStatsData.today?.orders?.completed || 0;
  } else if (currentStatsPeriod === '7days') {
    if (breakdownBox) breakdownBox.style.display = 'block';
    const list = cachedStatsData.past7days || [];
    list.forEach(d => {
      totalVisits += d.visits;
      totalOrdersCount += d.orders_count;
      totalRevenue += d.orders_total;
      totalCompleted += d.completed_count;
    });

    if (breakdownTbody) {
      breakdownTbody.innerHTML = list.map(d => `
        <tr>
          <td><b>${d.date}</b></td>
          <td>${d.visits}</td>
          <td>${d.orders_count} (${d.completed_count})</td>
          <td style="color:var(--green); font-weight:700;">${d.orders_total} ₽</td>
        </tr>
      `).join('');
    }
  } else if (currentStatsPeriod === 'month') {
    if (breakdownBox) breakdownBox.style.display = 'none';
    const list = cachedStatsData.past7days || [];
    list.forEach(d => {
      totalVisits += d.visits;
      totalOrdersCount += d.orders_count;
      totalRevenue += d.orders_total;
      totalCompleted += d.completed_count;
    });
  }

  const vEl = document.getElementById('stat-val-visits');
  const oEl = document.getElementById('stat-val-orders');
  const rEl = document.getElementById('stat-val-revenue');
  const cEl = document.getElementById('stat-val-completed');

  if (vEl) vEl.innerText = totalVisits;
  if (oEl) oEl.innerText = totalOrdersCount;
  if (rEl) rEl.innerText = `${totalRevenue} ₽`;
  if (cEl) cEl.innerText = totalCompleted;

  // Рендер просмотров букетов
  const pList = document.getElementById('stats-products-list');
  if (pList) {
    const products = cachedStatsData.products_views || [];
    if (!products.length) {
      pList.innerHTML = '<div style="color:var(--text-muted); font-size:11px; padding:6px 0;">Нет данных о просмотрах</div>';
    } else {
      pList.innerHTML = products.slice(0, 15).map((p, idx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px;">
          <div><b>${idx + 1}.</b> ${p.title}</div>
          <div style="color:var(--cyan); font-weight:800;">${p.views} просм.</div>
        </div>
      `).join('');
    }
  }

  // Рендер статистики уведомлений
  const nList = document.getElementById('stats-notifs-list');
  if (nList) {
    const notifs = cachedStatsData.notifications_stats || [];
    if (!notifs.length) {
      nList.innerHTML = '<div style="color:var(--text-muted); font-size:11px; padding:6px 0;">Нет данных о рассылках</div>';
    } else {
      nList.innerHTML = notifs.map(n => `
        <div style="background:var(--card-inner); border-radius:6px; padding:8px 10px; margin-bottom:6px; border:1px solid var(--border); font-size:12px;">
          <div style="font-weight:700; color:var(--text); margin-bottom:4px;">${n.title}</div>
          <div style="display:flex; gap:12px; font-size:11px; color:var(--text-muted);">
            <span>Показов: <b style="color:var(--text);">${n.views}</b></span>
            <span>Прочтений: <b style="color:var(--cyan);">${n.reads}</b></span>
            <span>Переходов: <b style="color:var(--green);">${n.clicks}</b></span>
          </div>
        </div>
      `).join('');
    }
  }
}

// ----------------- FAQ (ROOT) -----------------

async function loadRootFaq() {
  const container = document.getElementById('root-faq-container');
  const res = await fetch(`${API_URL}?action=admin_faq&admin_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`);
  allRootFaq = await res.json();

  container.innerHTML = allRootFaq.map(f => `
    <div class="box-card" style="margin-bottom:8px; border-left: 3px solid ${f.is_active ? 'var(--green)' : 'var(--red)'};">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="font-weight:700; font-size:13px; max-width:70%;">${f.question}</div>
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:10px; font-weight:800; color:${f.is_active ? 'var(--green)' : 'var(--red)'};">
            ${f.is_active ? 'АКТИВЕН' : 'СКРЫТ'}
          </span>
          <button class="btn-trash-mini" style="font-size:14px; color:var(--cyan); padding:2px;" onclick="moveFaqOrder('${f.id}', 'up')">▲</button>
          <button class="btn-trash-mini" style="font-size:14px; color:var(--cyan); padding:2px;" onclick="moveFaqOrder('${f.id}', 'down')">▼</button>
        </div>
      </div>
      <div style="font-size:12px; color:var(--text-muted); margin:4px 0;">${f.answer}</div>
      <div style="display:flex; gap:6px; margin-top:6px;">
        <button class="btn-metro btn-secondary" style="font-size:11px; padding:6px;" onclick="openEditFaqModal('${f.id}')">Редактировать</button>
        <button class="btn-metro btn-secondary" style="font-size:11px; padding:6px; color:${f.is_active ? 'var(--red)' : 'var(--green)'};" onclick="toggleFaqActiveRoot('${f.id}', ${!f.is_active})">
          ${f.is_active ? 'Скрыть' : 'Показать'}
        </button>
        <button class="btn-metro btn-danger" style="font-size:11px; padding:6px; max-width:80px;" onclick="deleteFaqRoot('${f.id}')">Удалить</button>
      </div>
    </div>
  `).join('');
}

async function moveFaqOrder(id, direction) {
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_move_faq",
      admin_id: userId,
      admin_passcode: sessionPasscode,
      id: id,
      direction: direction
    })
  });
  loadRootFaq();
  cachedFaqData = null;
}

function openAddFaqModal() {
  editingFaqId = null;
  document.getElementById('faq-edit-title').innerText = "Новый вопрос";
  document.getElementById('faq-edit-q').value = "";
  document.getElementById('faq-edit-a').value = "";
  const actEl = document.getElementById('faq-edit-active-ui');
  actEl.classList.add('checked'); actEl.innerText = '✓';
  document.getElementById('faq-editor-modal').classList.add('open');
}

function openEditFaqModal(id) {
  const f = allRootFaq.find(i => String(i.id) === String(id));
  if (!f) return;
  editingFaqId = f.id;
  document.getElementById('faq-edit-title').innerText = `Вопрос ID: ${f.id}`;
  document.getElementById('faq-edit-q').value = f.question;
  document.getElementById('faq-edit-a').value = f.answer;
  const actEl = document.getElementById('faq-edit-active-ui');
  actEl.classList.toggle('checked', !!f.is_active);
  actEl.innerText = f.is_active ? '✓' : '';
  document.getElementById('faq-editor-modal').classList.add('open');
}
function closeFaqEditorModal() { document.getElementById('faq-editor-modal').classList.remove('open'); }

async function saveFaqEditor() {
  const q = document.getElementById('faq-edit-q').value.trim();
  const a = document.getElementById('faq-edit-a').value.trim();
  const isActive = document.getElementById('faq-edit-active-ui').classList.contains('checked');
  if (!q || !a) return;

  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_update_faq",
      admin_id: userId,
      admin_passcode: sessionPasscode,
      id: editingFaqId || "new",
      question: q,
      answer: a,
      is_active: isActive
    })
  });
  closeFaqEditorModal();
  loadRootFaq();
  cachedFaqData = null;
}

async function toggleFaqActiveRoot(id, nextState) {
  const f = allRootFaq.find(i => String(i.id) === String(id));
  if (!f) return;
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_update_faq",
      admin_id: userId,
      admin_passcode: sessionPasscode,
      id: f.id,
      question: f.question,
      answer: f.answer,
      is_active: nextState
    })
  });
  loadRootFaq();
  cachedFaqData = null;
}

async function deleteFaqRoot(id) {
  if (!confirm("Удалить этот вопрос?")) return;
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "admin_delete_faq", admin_id: userId, admin_passcode: sessionPasscode, id: id })
  });
  loadRootFaq();
  cachedFaqData = null;
}
