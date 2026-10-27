// Состояние панели Root
let isTextEditActive = false;
let isFabVisible = false;
let allRootOrders = [];
let allRootCatalog = [];
let allRootClients = [];
let allRootFaq = [];
let currentRootSubTab = 'active';

let activeRootOrderForStatus = null;
let activeRootOrderForEdit = null;
let tempEditingItems = [];
let tempSelectedCatalogIdToAdd = "";
let uploadTargetContext = null;
let driveModalTarget = null;
let editingProductId = null;
let editingGroupName = null;
let editingFaqId = null;

let hudTapCount = 0;
let hudTapTimer = null;

function handleHudRootTap() {
  if (isAdmin) {
    navigateTab('root', null);
    return;
  }

  hudTapCount++;
  clearTimeout(hudTapTimer);
  hudTapTimer = setTimeout(() => { hudTapCount = 0; }, 1800);

  if (hudTapCount >= 5) {
    hudTapCount = 0;
    const pass = prompt("Код доступа Root:");
    if (pass) {
      sessionPasscode = pass.trim();
      apiGet('admin_orders', { user_id: userId, admin_passcode: sessionPasscode })
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

function toggleEditorFabVisibility() {
  isFabVisible = !isFabVisible;
  const chk = document.getElementById('root-toggle-editor-btn');
  const fab = document.getElementById('floating-editor-btn');

  if (chk) {
    chk.classList.toggle('checked', isFabVisible);
    chk.innerText = isFabVisible ? '✓' : '';
  }
  if (fab) {
    fab.style.display = isFabVisible ? 'flex' : 'none';
  }

  if (!isFabVisible && isTextEditActive) {
    toggleTextEditingMode();
  }
}

function toggleTextEditingMode(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  isTextEditActive = !isTextEditActive;
  document.body.classList.toggle('in-text-edit-mode', isTextEditActive);

  const fab = document.getElementById('floating-editor-btn');
  if (fab) fab.classList.toggle('active', isTextEditActive);

  if (isTextEditActive) {
    toast("Режим правок включен! Нажмите на любой текст с пунктиром");
    attachTextEditHandlers();
  } else {
    toast("Режим правок отключен");
    detachTextEditHandlers();
  }
}

function attachTextEditHandlers() {
  document.querySelectorAll('[data-config-key]').forEach(el => {
    el.onclick = handleConfigKeyClick;
  });
}

function detachTextEditHandlers() {
  document.querySelectorAll('[data-config-key]').forEach(el => {
    el.onclick = null;
  });
}

async function handleConfigKeyClick(e) {
  if (!isTextEditActive) return;
  e.preventDefault();
  e.stopPropagation();

  const key = this.getAttribute('data-config-key');
  const currentVal = this.innerText.trim();
  const newVal = prompt(`Изменить текст [${key}]:`, currentVal);

  if (newVal !== null && newVal !== currentVal) {
    this.innerText = newVal;
    try {
      await apiPost({
        action: "admin_save_config",
        user_id: userId,
        admin_passcode: sessionPasscode,
        key: key,
        value: newVal
      });
      toast("Текст сохранен!");
    } catch (err) {
      toast("Ошибка сохранения текста на сервере");
    }
  }
}

function initDraggableFab() {
  const fab = document.getElementById('floating-editor-btn');
  if (!fab) return;

  let isDragging = false;
  let startX, startY, initLeft, initTop;

  fab.addEventListener('pointerdown', (e) => {
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = fab.getBoundingClientRect();
    initLeft = rect.left;
    initTop = rect.top;
    fab.setPointerCapture(e.pointerId);
  });

  fab.addEventListener('pointermove', (e) => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      isDragging = true;
      fab.style.left = `${initLeft + dx}px`;
      fab.style.top = `${initTop + dy}px`;
      fab.style.right = 'auto';
      fab.style.bottom = 'auto';
    }
  });

  fab.addEventListener('pointerup', (e) => {
    fab.releasePointerCapture(e.pointerId);
    if (!isDragging) {
      toggleTextEditingMode(e);
    }
  });
}

function switchRootSection(sec) {
  document.querySelectorAll('#screen-root .toggle-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-root-${sec}`).classList.add('active');

  ['orders', 'catalog', 'clients', 'faq'].forEach(s => {
    document.getElementById(`root-sec-${s}`).style.display = (s === sec) ? 'block' : 'none';
  });

  if (sec === 'orders') loadRootOrders();
  if (sec === 'catalog') loadRootCatalog();
  if (sec === 'clients') loadRootClients();
  if (sec === 'faq') loadRootFaq();
}

function switchRootSubTab(sub) {
  currentRootSubTab = sub;
  document.getElementById('tab-root-active').classList.toggle('active', sub === 'active');
  document.getElementById('tab-root-archive').classList.toggle('active', sub === 'archive');
  renderRootOrders();
}

async function loadRootOrders(showToast = true) {
  try {
    if (showToast) toast("Загрузка заказов...");
    allRootOrders = await apiGet('admin_orders', { user_id: userId, admin_passcode: sessionPasscode });
    renderRootOrders();
  } catch (e) {
    toast("Ошибка загрузки заказов");
  }
}

function renderRootOrders() {
  const container = document.getElementById('root-orders-container');
  if (!container) return;

  const isArchive = (currentRootSubTab === 'archive');
  const filtered = allRootOrders.filter(o => {
    const closed = (o.status === 'Завершен' || o.status.startsWith('Отменен'));
    return isArchive ? closed : !closed;
  });

  if (!filtered.length) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px; font-size:12px;">Заказов нет</div>`;
    return;
  }

  container.innerHTML = filtered.map(o => {
    const items = o.items || [];
    const itemsSummary = items.map(i => `${i.title} × ${i.qty}`).join(', ');

    return `
      <div class="box-card neon-glow" style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <b style="color:var(--cyan); font-size:13px;">${o.order_id}</b>
          <span class="status-badge">${o.status}</span>
        </div>
        <div style="font-size:12px; color:var(--text); font-weight:700;">${o.user_name} • ${o.user_phone}</div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:3px;">${o.delivery_type === 'delivery' ? '🚚 Доставка: ' + o.address : '📍 Самовывоз'}</div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Время: <b>${o.delivery_time || '—'}</b></div>
        <div style="font-size:11px; color:var(--cyan); margin-top:4px;">Состав: ${itemsSummary}</div>
        <div style="font-size:14px; font-weight:800; color:var(--green); margin-top:6px;">Итого: ${o.total_amount} ₽</div>

        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-top:10px;">
          <button class="btn-metro btn-secondary" style="font-size:11px; padding:7px;" onclick="openStatusModal('${o.order_id}')">Статус</button>
          <button class="btn-metro btn-secondary" style="font-size:11px; padding:7px;" onclick="openEditItemsModal('${o.order_id}')">Состав</button>
          <button class="btn-metro btn-danger" style="font-size:11px; padding:7px;" onclick="openTopConfirm('${o.order_id}')">Удалить</button>
        </div>
        ${o.delivery_type === 'delivery' ? `
          <button class="btn-metro" style="font-size:11px; padding:7px; margin-top:6px; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);" onclick="openYandexGoDelivery('${o.address.replace(/'/g, "\\'")}')">
            🚕 Открыть Яндекс Go
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

function openStatusModal(orderId) {
  activeRootOrderForStatus = orderId;
  document.getElementById('status-modal-title').innerText = `Статус: ${orderId}`;
  document.getElementById('status-modal').classList.add('open');
}

function closeStatusModal() {
  document.getElementById('status-modal').classList.remove('open');
}

async function applyStatusChoice(status) {
  if (!activeRootOrderForStatus) return;
  try {
    toast(`Установка статуса: ${status}...`);
    await apiPost({
      action: "admin_update_order",
      user_id: userId,
      admin_passcode: sessionPasscode,
      order_id: activeRootOrderForStatus,
      status: status
    });
    closeStatusModal();
    loadRootOrders(false);
  } catch (e) {
    toast("Ошибка смены статуса");
  }
}

function openEditItemsModal(orderId) {
  const order = allRootOrders.find(o => o.order_id === orderId);
  if (!order) return;

  activeRootOrderForEdit = order;
  tempEditingItems = JSON.parse(JSON.stringify(order.items || []));

  document.getElementById('edit-items-modal-title').innerText = `Заказ: ${orderId}`;
  document.getElementById('edit-order-delivery-input').value = order.delivery_cost || 0;
  document.getElementById('edit-order-assembly-input').value = 0;
  document.getElementById('edit-order-total-input').value = order.total_amount;

  renderEditItemsList();
  populateCatalogDropdown();
  document.getElementById('edit-items-modal').classList.add('open');
}

function closeEditItemsModal() {
  document.getElementById('edit-items-modal').classList.remove('open');
}

function renderEditItemsList() {
  const container = document.getElementById('edit-items-list');
  if (!container) return;

  container.innerHTML = tempEditingItems.map((it, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px;">
      <div>
        <b>${it.title}</b> ${it.variant ? `(${it.variant})` : ''}
        <div style="font-size:10px; color:var(--text-muted);">${it.price} ₽ × ${it.qty} = ${it.price * it.qty} ₽</div>
      </div>
      <button class="btn-trash-mini" style="color:var(--red);" onclick="tempEditingItems.splice(${idx}, 1); renderEditItemsList(); recalcEditOrderTotalFromInputs();">✕</button>
    </div>
  `).join('');
}

function populateCatalogDropdown() {
  const optionsBox = document.getElementById('add-item-catalog-options');
  if (!optionsBox) return;

  optionsBox.innerHTML = catalog.map(c => `
    <div class="custom-select-option" onclick="selectItemToAddToOrder('${c.id}')">${c.title} (${c.price} ₽)</div>
  `).join('');
}

function selectItemToAddToOrder(id) {
  tempSelectedCatalogIdToAdd = id;
  const c = catalog.find(i => String(i.id) === String(id));
  document.getElementById('add-item-catalog-display').innerText = c ? `${c.title} (${c.price} ₽)` : "Выберите цветок...";
  document.getElementById('add-item-catalog-box').classList.remove('open');
}

function addItemToCurrentOrder() {
  if (!tempSelectedCatalogIdToAdd) {
    toast("Выберите цветок из списка");
    return;
  }

  const c = catalog.find(i => String(i.id) === String(tempSelectedCatalogIdToAdd));
  if (!c) return;

  const existing = tempEditingItems.find(i => String(i.id) === String(c.id));
  if (existing) {
    existing.qty += 1;
  } else {
    tempEditingItems.push({
      id: c.id,
      title: c.title,
      price: c.price,
      unit: c.unit || "1 шт.",
      variant: c.variant || "",
      qty: 1
    });
  }

  renderEditItemsList();
  recalcEditOrderTotalFromInputs();
}

function recalcEditOrderTotalFromInputs() {
  let itemsSum = 0;
  tempEditingItems.forEach(i => { itemsSum += i.price * i.qty; });

  const del = parseFloat(document.getElementById('edit-order-delivery-input').value) || 0;
  const asm = parseFloat(document.getElementById('edit-order-assembly-input').value) || 0;
  document.getElementById('edit-order-total-input').value = itemsSum + del + asm;
}

async function saveEditedOrderItems() {
  if (!activeRootOrderForEdit) return;
  const finalTotal = parseFloat(document.getElementById('edit-order-total-input').value) || 0;

  try {
    toast("Сохранение состава...");
    await apiPost({
      action: "admin_update_order",
      user_id: userId,
      admin_passcode: sessionPasscode,
      order_id: activeRootOrderForEdit.order_id,
      items: tempEditingItems,
      total_amount: finalTotal,
      status: "Ожидает оплаты"
    });
    closeEditItemsModal();
    loadRootOrders(false);
  } catch (e) {
    toast("Ошибка сохранения состава");
  }
}

function openTopConfirm(orderId) {
  const popup = document.getElementById('top-confirm-popup');
  document.getElementById('top-confirm-text').innerText = `Удалить заказ ${orderId} безвозвратно?`;
  document.getElementById('top-confirm-yes-btn').onclick = () => confirmDeleteOrderExecute(orderId);
  popup.classList.add('show');
}

function closeTopConfirm() {
  document.getElementById('top-confirm-popup').classList.remove('show');
}

async function confirmDeleteOrderExecute(orderId) {
  closeTopConfirm();
  try {
    toast("Удаление заказа...");
    await apiPost({
      action: "admin_delete_order",
      user_id: userId,
      admin_passcode: sessionPasscode,
      order_id: orderId
    });
    loadRootOrders(false);
  } catch (e) {
    toast("Ошибка удаления");
  }
}

function openYandexGoDelivery(orderAddress = "") {
  if (orderAddress && navigator.clipboard) {
    navigator.clipboard.writeText(orderAddress);
    toast("Адрес скопирован! Вставьте его в Яндекс Go");
  }
  const lat = SERVER_CONFIG.store_lat || 55.966987;
  const lon = SERVER_CONFIG.store_lon || 37.151059;
  const url = `https://3.redirect.appmetrica.yandex.com/route?start-lat=${lat}&start-lon=${lon}&appmetrica_tracking_id=1178268795219780156`;
  if (tg && tg.openLink) tg.openLink(url);
  else window.open(url, '_blank');
}

// ----------------------------------------------------
// КАТАЛОГ ROOT (ТОВАРЫ И ГРУППЫ)
// ----------------------------------------------------

async function loadRootCatalog() {
  try {
    toast("Загрузка каталога...");
    allRootCatalog = await apiGet('admin_full_catalog', { user_id: userId, admin_passcode: sessionPasscode });
    renderRootCatalog();
  } catch (e) {
    toast("Ошибка загрузки");
  }
}

function renderRootCatalog() {
  const container = document.getElementById('root-catalog-container');
  if (!container) return;

  container.innerHTML = allRootCatalog.map(p => `
    <div class="box-card neon-glow" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <b style="font-size:13px; color:var(--text);">${p.title}</b>
        <div style="font-size:11px; color:var(--cyan);">${p.unit} • ${p.variant || 'базовый'} • ${p.price} ₽</div>
        <div style="font-size:10px; color:${p.is_active ? 'var(--green)' : 'var(--red)'};">${p.is_active ? '● В наличии' : '○ Скрыт'}</div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn-metro btn-secondary" style="font-size:11px; padding:6px 10px;" onclick="openEditProductModal('${p.id}')">✏️</button>
        <button class="btn-metro btn-danger" style="font-size:11px; padding:6px 10px;" onclick="deleteProductRoot('${p.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

function openAddProductModal() {
  editingProductId = 'new';
  document.getElementById('prod-edit-title').innerText = "Новый товар";
  document.getElementById('prod-edit-name').value = "";
  document.getElementById('prod-edit-unit').value = "1 шт.";
  document.getElementById('prod-edit-variant').value = "";
  document.getElementById('prod-edit-cat').value = "Цветы";
  document.getElementById('prod-edit-price').value = "";
  document.getElementById('prod-edit-desc').value = "";
  document.getElementById('prod-edit-photo').value = "";
  renderProductEditorPhotos();

  document.getElementById('product-editor-modal').classList.add('open');
}

function openEditProductModal(id) {
  const p = allRootCatalog.find(i => String(i.id) === String(id));
  if (!p) return;

  editingProductId = id;
  document.getElementById('prod-edit-title').innerText = `Редактирование: ${p.title}`;
  document.getElementById('prod-edit-name').value = p.title;
  document.getElementById('prod-edit-unit').value = p.unit;
  document.getElementById('prod-edit-variant').value = p.variant;
  document.getElementById('prod-edit-cat').value = p.category;
  document.getElementById('prod-edit-price').value = p.price;
  document.getElementById('prod-edit-desc').value = p.description;
  document.getElementById('prod-edit-photo').value = p.photo_url || "";
  renderProductEditorPhotos();

  document.getElementById('product-editor-modal').classList.add('open');
}

function closeProductEditorModal() {
  document.getElementById('product-editor-modal').classList.remove('open');
}

async function saveProductEditor() {
  const title = document.getElementById('prod-edit-name').value.trim();
  const price = parseFloat(document.getElementById('prod-edit-price').value) || 0;
  if (!title || price <= 0) {
    toast("Заполните название и цену");
    return;
  }

  const payload = {
    action: (editingProductId === 'new') ? "admin_add_product" : "admin_update_product",
    id: editingProductId,
    user_id: userId,
    admin_passcode: sessionPasscode,
    title: title,
    unit: document.getElementById('prod-edit-unit').value.trim(),
    variant: document.getElementById('prod-edit-variant').value.trim(),
    category: document.getElementById('prod-edit-cat').value.trim(),
    price: price,
    description: document.getElementById('prod-edit-desc').value.trim(),
    photo_url: document.getElementById('prod-edit-photo').value.trim(),
    is_active: document.getElementById('prod-edit-active-ui').classList.contains('checked'),
    is_popular: document.getElementById('prod-edit-popular-ui').classList.contains('checked')
  };

  try {
    toast("Сохранение товара...");
    await apiPost(payload);
    closeProductEditorModal();
    loadRootCatalog();
    loadCatalog();
  } catch (e) {
    toast("Ошибка сохранения");
  }
}

async function deleteProductRoot(id) {
  if (!confirm("Удалить товар?")) return;
  try {
    toast("Удаление...");
    await apiPost({ action: "admin_delete_product", user_id: userId, admin_passcode: sessionPasscode, id: id });
    loadRootCatalog();
    loadCatalog();
  } catch (e) {
    toast("Ошибка удаления");
  }
}

function openAddGroupModal() {
  editingGroupName = 'new';
  document.getElementById('group-edit-title').innerText = "Новая группа вариаций";
  document.getElementById('group-edit-name').value = "";
  document.getElementById('group-edit-cat').value = "Цветы";
  document.getElementById('group-edit-desc').value = "";
  document.getElementById('group-edit-photo').value = "";
  document.getElementById('group-variants-tbody').innerHTML = "";
  renderGroupEditorPhotos();
  addGroupVariantRow();

  document.getElementById('group-editor-modal').classList.add('open');
}

function closeGroupEditorModal() {
  document.getElementById('group-editor-modal').classList.remove('open');
}

function addGroupVariantRow(unit = "15 шт.", variant = "60 см", price = "3000", isActive = true) {
  const tbody = document.getElementById('group-variants-tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="gv-unit" value="${unit}"></td>
    <td><input type="text" class="gv-variant" value="${variant}"></td>
    <td><input type="number" class="gv-price" value="${price}"></td>
    <td style="text-align:center;"><input type="checkbox" class="gv-active" ${isActive ? 'checked' : ''}></td>
    <td style="text-align:center;"><button class="btn-trash-mini" style="color:var(--red);" onclick="this.closest('tr').remove()">✕</button></td>
  `;
  tbody.appendChild(tr);
}

async function saveGroupEditor() {
  const title = document.getElementById('group-edit-name').value.trim();
  if (!title) {
    toast("Укажите базовое название группы");
    return;
  }

  const rows = document.querySelectorAll('#group-variants-tbody tr');
  const variants = [];
  rows.forEach(r => {
    variants.push({
      unit: r.querySelector('.gv-unit').value.trim(),
      variant: r.querySelector('.gv-variant').value.trim(),
      price: parseFloat(r.querySelector('.gv-price').value) || 0,
      is_active: r.querySelector('.gv-active').checked
    });
  });

  if (!variants.length) {
    toast("Добавьте хотя бы один вариант");
    return;
  }

  const payload = {
    action: "admin_save_group",
    user_id: userId,
    admin_passcode: sessionPasscode,
    title: title,
    category: document.getElementById('group-edit-cat').value.trim(),
    description: document.getElementById('group-edit-desc').value.trim(),
    photo_url: document.getElementById('group-edit-photo').value.trim(),
    is_popular: document.getElementById('group-edit-popular-ui').classList.contains('checked'),
    variants_json: JSON.stringify(variants)
  };

  try {
    toast("Сохранение группы...");
    await apiPost(payload);
    closeGroupEditorModal();
    loadRootCatalog();
    loadCatalog();
  } catch (e) {
    toast("Ошибка сохранения группы");
  }
}

// Управление фотографиями в модалках товаров
function renderProductEditorPhotos() {
  const strip = document.getElementById('prod-photo-strip');
  const input = document.getElementById('prod-edit-photo');
  const urls = (input.value || "").split(',').map(s => s.trim()).filter(Boolean);

  strip.innerHTML = urls.map((u, idx) => `
    <div class="prod-photo-thumb-wrap">
      <img src="${u}">
      <button class="prod-photo-del-btn" onclick="removeProductPhoto(${idx})">✕</button>
    </div>
  `).join('');
}

function removeProductPhoto(idx) {
  const input = document.getElementById('prod-edit-photo');
  const urls = input.value.split(',').map(s => s.trim()).filter(Boolean);
  urls.splice(idx, 1);
  input.value = urls.join(',');
  renderProductEditorPhotos();
}

function renderGroupEditorPhotos() {
  const strip = document.getElementById('group-photo-strip');
  const input = document.getElementById('group-edit-photo');
  const urls = (input.value || "").split(',').map(s => s.trim()).filter(Boolean);

  strip.innerHTML = urls.map((u, idx) => `
    <div class="prod-photo-thumb-wrap">
      <img src="${u}">
      <button class="prod-photo-del-btn" onclick="removeGroupPhoto(${idx})">✕</button>
    </div>
  `).join('');
}

function removeGroupPhoto(idx) {
  const input = document.getElementById('group-edit-photo');
  const urls = input.value.split(',').map(s => s.trim()).filter(Boolean);
  urls.splice(idx, 1);
  input.value = urls.join(',');
  renderGroupEditorPhotos();
}

function triggerProductPhotoUpload(ctx) {
  uploadTargetContext = ctx;
  document.getElementById('camera-file-input').click();
}

async function handleNativeFileSelect(input) {
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      toast("Загрузка фото на Google Диск...");
      const res = await apiPost({
        action: "admin_upload_photo",
        user_id: userId,
        admin_passcode: sessionPasscode,
        base64: e.target.result,
        content_type: file.type
      });

      if (res && res.photo_url) {
        if (uploadTargetContext === 'single') {
          const pInput = document.getElementById('prod-edit-photo');
          pInput.value = pInput.value ? `${pInput.value},${res.photo_url}` : res.photo_url;
          renderProductEditorPhotos();
        } else if (uploadTargetContext === 'group') {
          const gInput = document.getElementById('group-edit-photo');
          gInput.value = gInput.value ? `${gInput.value},${res.photo_url}` : res.photo_url;
          renderGroupEditorPhotos();
        }
        toast("Фото прикреплено!");
      }
    } catch (err) {
      toast("Сбой загрузки фото");
    }
  };
  reader.readAsDataURL(file);
}

async function openDriveMediaModal(ctx) {
  driveModalTarget = ctx;
  document.getElementById('drive-media-modal').classList.add('open');
  const container = document.getElementById('drive-media-container');

  try {
    const list = await apiGet('admin_drive_media', { user_id: userId, admin_passcode: sessionPasscode });
    container.innerHTML = list.map(m => `
      <div class="drive-media-item" onclick="selectDrivePhoto('${m.url}')">
        <img src="${m.url}">
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div style="grid-column:1/-1; color:var(--red); text-align:center;">Ошибка медиатеки</div>`;
  }
}

function closeDriveMediaModal() {
  document.getElementById('drive-media-modal').classList.remove('remove');
  document.getElementById('drive-media-modal').classList.remove('open');
}

function selectDrivePhoto(url) {
  if (driveModalTarget === 'single') {
    const pInput = document.getElementById('prod-edit-photo');
    pInput.value = pInput.value ? `${pInput.value},${url}` : url;
    renderProductEditorPhotos();
  } else if (driveModalTarget === 'group') {
    const gInput = document.getElementById('group-edit-photo');
    gInput.value = gInput.value ? `${gInput.value},${url}` : url;
    renderGroupEditorPhotos();
  }
  closeDriveMediaModal();
  toast("Фото прикреплено");
}

// ----------------------------------------------------
// КЛИЕНТЫ И FAQ ROOT
// ----------------------------------------------------

async function loadRootClients() {
  try {
    toast("Загрузка клиентов...");
    allRootClients = await apiGet('admin_clients', { user_id: userId, admin_passcode: sessionPasscode });
    renderRootClients(allRootClients);
  } catch (e) {
    toast("Ошибка загрузки клиентов");
  }
}

function renderRootClients(clients) {
  const container = document.getElementById('root-clients-container');
  if (!container) return;

  container.innerHTML = clients.map(c => `
    <div class="box-card neon-glow" style="margin-bottom:8px; font-size:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <b>${c.name}</b>
        <span style="color:var(--green); font-weight:800;">${c.total_spent} ₽</span>
      </div>
      <div style="color:var(--text-muted); margin-top:2px;">${c.phone} • ID: ${c.user_id}</div>
      <div style="display:flex; gap:6px; margin-top:8px;">
        <button class="btn-metro btn-secondary" style="font-size:10px; padding:6px;" onclick="editSpentPrompt('${c.user_id}', ${c.total_spent})">Выкуп</button>
        <button class="btn-metro btn-danger" style="font-size:10px; padding:6px;" onclick="deleteUserRoot('${c.user_id}')">Сброс</button>
      </div>
    </div>
  `).join('');
}

function filterRootClients() {
  const q = document.getElementById('root-client-search').value.toLowerCase();
  const filtered = allRootClients.filter(c => 
    c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.user_id.includes(q)
  );
  renderRootClients(filtered);
}

async function editSpentPrompt(targetUid, curSpent) {
  const val = prompt("Новая сумма выкупа (₽):", curSpent);
  if (val !== null) {
    await apiPost({
      action: "admin_update_spent",
      user_id: userId,
      admin_passcode: sessionPasscode,
      target_user_id: targetUid,
      total_spent: parseFloat(val) || 0
    });
    loadRootClients();
  }
}

async function deleteUserRoot(targetUid) {
  if (!confirm("Удалить профиль клиента?")) return;
  await apiPost({
    action: "admin_delete_user",
    user_id: userId,
    admin_passcode: sessionPasscode,
    target_user_id: targetUid
  });
  loadRootClients();
}

async function loadRootFaq() {
  try {
    allRootFaq = await apiGet('admin_faq', { user_id: userId, admin_passcode: sessionPasscode });
    renderRootFaq();
  } catch (e) {
    toast("Ошибка FAQ");
  }
}

function renderRootFaq() {
  const container = document.getElementById('root-faq-container');
  if (!container) return;

  container.innerHTML = allRootFaq.map(f => `
    <div class="box-card neon-glow" style="margin-bottom:8px; font-size:12px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <b style="color:var(--cyan);">${f.question}</b>
        <div style="display:flex; gap:4px;">
          <button class="btn-metro btn-secondary" style="font-size:10px; padding:4px 8px;" onclick="moveFaqOrder('${f.id}', 'up')">▲</button>
          <button class="btn-metro btn-secondary" style="font-size:10px; padding:4px 8px;" onclick="moveFaqOrder('${f.id}', 'down')">▼</button>
          <button class="btn-metro btn-secondary" style="font-size:10px; padding:4px 8px;" onclick="openEditFaqModal('${f.id}')">✏️</button>
          <button class="btn-metro btn-danger" style="font-size:10px; padding:4px 8px;" onclick="deleteFaqRoot('${f.id}')">✕</button>
        </div>
      </div>
      <div style="color:var(--text-muted); margin-top:4px;">${f.answer}</div>
    </div>
  `).join('');
}

async function moveFaqOrder(id, dir) {
  await apiPost({ action: "admin_move_faq", user_id: userId, admin_passcode: sessionPasscode, id: id, direction: dir });
  loadRootFaq();
}

function openAddFaqModal() {
  editingFaqId = 'new';
  document.getElementById('faq-edit-title').innerText = "Новый вопрос FAQ";
  document.getElementById('faq-edit-q').value = "";
  document.getElementById('faq-edit-a').value = "";
  document.getElementById('faq-editor-modal').classList.add('open');
}

function openEditFaqModal(id) {
  const f = allRootFaq.find(i => String(i.id) === String(id));
  if (!f) return;
  editingFaqId = id;
  document.getElementById('faq-edit-title').innerText = "Редактирование FAQ";
  document.getElementById('faq-edit-q').value = f.question;
  document.getElementById('faq-edit-a').value = f.answer;
  document.getElementById('faq-editor-modal').classList.add('open');
}

function closeFaqEditorModal() {
  document.getElementById('faq-editor-modal').classList.remove('open');
}

async function saveFaqEditor() {
  const q = document.getElementById('faq-edit-q').value.trim();
  const a = document.getElementById('faq-edit-a').value.trim();
  if (!q || !a) {
    toast("Заполните вопрос и ответ");
    return;
  }

  await apiPost({
    action: "admin_update_faq",
    user_id: userId,
    admin_passcode: sessionPasscode,
    id: editingFaqId,
    question: q,
    answer: a,
    is_active: document.getElementById('faq-edit-active-ui').classList.contains('checked')
  });

  closeFaqEditorModal();
  loadRootFaq();
}

async function deleteFaqRoot(id) {
  if (!confirm("Удалить вопрос?")) return;
  await apiPost({ action: "admin_delete_faq", user_id: userId, admin_passcode: sessionPasscode, id: id });
  loadRootFaq();
}
