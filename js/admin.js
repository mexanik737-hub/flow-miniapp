let allRootOrders = [];
let allRootCatalog = [];
let allRootClients = [];
let allRootFaq = [];
let allRootNotices = [];
let currentRootSubTab = 'active';
let currentStatPeriod = 'today';

let activeCourierOrder = null;
let activeRootOrderForStatus = null;
let activeRootOrderForEdit = null;
let tempEditingItems = [];
let tempSelectedCatalogIdToAdd = "";
let editingProductId = null;
let editingFaqId = null;
let selectedNoticeTargetTab = 'catalog';

// Скрытый вход в Root: 1 клик для подтвержденного админа, 5 кликов для ввода кода
function handleHudRootTap() {
  if (isAdmin) {
    navigateTab('root', null);
    return;
  }

  // Если у пользователя явно прописан запрет в таблице — блокируем сразу
  if (currentUser && (currentUser.is_admin === false || String(currentUser.is_admin).toUpperCase() === 'FALSE' || String(currentUser.is_admin).toUpperCase() === 'ЛОЖЬ')) {
    toast("Доступ к панели управления запрещен");
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
      fetch(`${API_URL}?action=admin_orders&user_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            isAdmin = true;
            toast("Доступ подтвержден");
            navigateTab('root', null);
          } else {
            sessionPasscode = "";
            toast("Доступ запрещен или неверный код");
          }
        })
        .catch(() => toast("Ошибка проверки доступа"));
    }
  }
}

// Переключение разделов Root
function switchRootSection(sec) {
  const tabs = ['orders', 'catalog', 'clients', 'notices', 'stats', 'faq'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-root-${t}`);
    const section = document.getElementById(`root-sec-${t}`);
    if (btn) btn.classList.toggle('active', t === sec);
    if (section) section.style.display = (t === sec) ? 'block' : 'none';
  });

  if (sec === 'orders') loadRootOrders(true);
  if (sec === 'catalog') loadRootCatalog();
  if (sec === 'clients') loadRootClients();
  if (sec === 'notices') loadRootNotices();
  if (sec === 'stats') loadRootStats();
  if (sec === 'faq') loadRootFaq();
}

function switchRootSubTab(tab) {
  currentRootSubTab = tab;
  document.getElementById('tab-root-active').classList.toggle('active', tab === 'active');
  document.getElementById('tab-root-archive').classList.toggle('active', tab === 'archive');
  renderRootOrders();
}

// Заказы
async function loadRootOrders(force = false) {
  if (!isAdmin) return;
  try {
    const res = await fetch(`${API_URL}?action=admin_orders&user_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`);
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
      ? (ord.delivery_cost ? `${ord.delivery_cost} ₽` : 'По тарифу')
      : '0 ₽ (Самовывоз)';

    const itemsListText = (ord.items || []).map(i => {
      const parts = [];
      if (i.variant) parts.push(i.variant);
      if (i.color) parts.push(i.color);
      const detailStr = parts.length ? ` (${parts.join(', ')})` : '';
      const bqTag = i.in_bouquet ? ' <b>[в букет]</b>' : '';
      return `• ${i.title}${detailStr} × ${i.qty} [${i.unit || '1 шт.'}] = ${i.price * i.qty} ₽${bqTag}`;
    }).join('<br>');

    const safeAddr = (ord.address || "").replace(/'/g, "\\'");

    return `
      <div class="box-card" style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <b>${ord.order_id}</b>
          <span class="status-badge st-building">${ord.status}</span>
        </div>
        <div style="font-size:12px; line-height:1.55; color:var(--text); background:var(--card-inner); padding:8px 10px; border-radius:8px; margin-bottom:8px;">
          <b>Заказчик:</b> ${ord.user_name} (${ord.user_phone})<br>
          ${ord.recipient_info ? `<b style="color:var(--cyan);">Получатель:</b> ${ord.recipient_info}<br>` : ''}
          <b>Адрес:</b> ${ord.address}<br>
          <b>Доставка:</b> ${deliveryCostText}<br>
          <b>Желаемое время:</b> ${ord.delivery_time || 'Как можно скорее'}<br>
          ${ord.shop_comment ? `<b>Комментарий салону:</b> ${ord.shop_comment}<br>` : ''}
          <div style="margin:6px 0; padding-top:6px; border-top:1px dashed var(--border);">
            <b>Состав:</b><br>
            ${itemsListText || '<i>Нет данных о составе</i>'}
          </div>
          <b>Сумма к оплате:</b> <span style="color:var(--green); font-weight:800;">${ord.total_amount} ₽</span>
        </div>

        ${isAssembly ? `
          <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); border-radius:8px; padding:8px; font-size:11px; color:var(--amber); margin-bottom:6px;">
            💐 <b>Требуется сборка букета!</b> Согласуйте упаковку с клиентом, скорректируйте сумму в «Составе заказа» и выставьте счёт.
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

// Модалка «Для курьера» с 5 изолированными блоками
function openCourierModal(orderId) {
  const ord = allRootOrders.find(o => o.order_id === orderId);
  if (!ord) return;
  activeCourierOrder = ord;

  document.getElementById('courier-modal-title').innerText = `Курьеру: ${ord.order_id}`;
  document.getElementById('cour-row-addr').innerText = ord.address || "Адрес не указан";

  let recName = ord.user_name;
  let rawPhone = ord.user_phone;

  if (ord.recipient_info) {
    const match = ord.recipient_info.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      recName = match[1].trim();
      rawPhone = match[2].trim();
    } else {
      recName = ord.recipient_info;
    }
  }

  // Очистка телефона от первой 8/7, скобок и тире для прямого набора курьером
  let cleanPhone = String(rawPhone || "").replace(/\D/g, '');
  if (cleanPhone.startsWith('7') || cleanPhone.startsWith('8')) {
    cleanPhone = cleanPhone.substring(1);
  }

  document.getElementById('cour-row-name').innerText = recName || "Клиент";
  document.getElementById('cour-row-phone').innerText = cleanPhone || "Номер не указан";

  const commWrap = document.getElementById('cour-comment-wrap');
  if (ord.shop_comment) {
    document.getElementById('cour-row-comm').innerText = ord.shop_comment;
    commWrap.style.display = 'block';
  } else {
    commWrap.style.display = 'none';
  }

  document.getElementById('courier-modal').classList.add('open');
}

function closeCourierModal() {
  document.getElementById('courier-modal').classList.remove('open');
}

function copyCourierSingleField(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const txt = el.innerText.trim();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt);
    toast("Скопировано в буфер");
  }
}

function copyCourierAllFields() {
  if (!activeCourierOrder) return;
  const ord = activeCourierOrder;

  let recName = ord.user_name;
  let rawPhone = ord.user_phone;
  if (ord.recipient_info) {
    const match = ord.recipient_info.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      recName = match[1].trim();
      rawPhone = match[2].trim();
    }
  }

  let cleanPhone = String(rawPhone || "").replace(/\D/g, '');
  if (cleanPhone.startsWith('7') || cleanPhone.startsWith('8')) cleanPhone = cleanPhone.substring(1);

  const fullText = `Адрес: ${ord.address}\nПолучатель: ${recName}\nТелефон: ${cleanPhone}\n` +
    (ord.shop_comment ? `Комментарий: ${ord.shop_comment}\n` : '') +
    `Примечание: Хрупкий товар — ЦВЕТЫ. Везти вертикально, аккуратно`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(fullText);
    toast("Все данные курьера скопированы!");
  }
}

async function confirmOrderRoot(orderId) {
  toast("Подтверждение оплаты...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_update_order",
      user_id: userId,
      admin_passcode: sessionPasscode,
      order_id: orderId,
      status: "Собирается"
    })
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
    body: JSON.stringify({
      action: "admin_update_order",
      user_id: userId,
      admin_passcode: sessionPasscode,
      order_id: oid,
      status: st
    })
  });
  loadRootOrders(true);
}

function openEditItemsModal(orderId) {
  const ord = allRootOrders.find(o => o.order_id === orderId);
  if (!ord) return;
  activeRootOrderForEdit = ord;
  tempEditingItems = JSON.parse(JSON.stringify(ord.items || []));
  tempSelectedCatalogIdToAdd = "";
  document.getElementById('add-item-catalog-display').innerText = "Выберите цветок для добавления...";
  document.getElementById('edit-items-modal-title').innerText = `Состав ${orderId}`;

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
    const parts = [];
    if (it.variant) parts.push(it.variant);
    if (it.color) parts.push(it.color);
    const detailStr = parts.length ? ` (${parts.join(', ')})` : '';
    const packTag = it.in_bouquet ? ' <b>[в букет]</b>' : '';
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px;">
        <div>${it.title}${detailStr}${packTag} (${it.price} ₽ × ${it.qty})</div>
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

function populateCatalogDropdown() {
  const optionsBox = document.getElementById('add-item-catalog-options');
  if (!optionsBox) return;
  optionsBox.innerHTML = catalog.map(c => {
    const parts = [];
    if (c.variant) parts.push(c.variant);
    if (c.color) parts.push(c.color);
    const detailStr = parts.length ? ` (${parts.join(', ')})` : '';
    return `
      <div class="custom-select-option" onclick="selectItemToAddToOrder('${c.id}')">
        ${c.title}${detailStr} [${c.unit}] — ${c.price} ₽
      </div>
    `;
  }).join('');
}

function selectItemToAddToOrder(cid) {
  tempSelectedCatalogIdToAdd = cid;
  const c = catalog.find(i => String(i.id) === String(cid));
  if (c) {
    document.getElementById('add-item-catalog-display').innerText = `${c.title} — ${c.price} ₽`;
  }
  document.getElementById('add-item-catalog-box').classList.remove('open');
}

function addItemToCurrentOrder() {
  if (!tempSelectedCatalogIdToAdd) { toast("Выберите цветок из списка"); return; }
  const c = catalog.find(i => String(i.id) === String(tempSelectedCatalogIdToAdd));
  if (!c) return;

  const ex = tempEditingItems.find(i => String(i.id) === String(c.id));
  if (ex) {
    ex.qty++;
  } else {
    tempEditingItems.push({
      id: c.id,
      title: c.title,
      unit: c.unit ? c.unit.split('/')[0].trim() : '1 шт.',
      variant: c.variant ? c.variant.split('/')[0].trim() : '',
      color: c.color ? c.color.split('/')[0].trim() : '',
      price: c.price,
      qty: 1
    });
  }
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

  toast("Сохранение состава...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_update_order",
      user_id: userId,
      admin_passcode: sessionPasscode,
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
    body: JSON.stringify({
      action: "admin_delete_order",
      user_id: userId,
      admin_passcode: sessionPasscode,
      order_id: orderId
    })
  });
  loadRootOrders(true);
}

// Управление товарами (с поддержкой color)
async function loadRootCatalog() {
  const container = document.getElementById('root-catalog-container');
  const res = await fetch(`${API_URL}?action=admin_full_catalog&user_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`);
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

      return `
        <div class="box-card" style="margin-bottom:8px; border-left: 3px solid var(--cyan);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <b>${c.title}</b> <span style="font-size:10px; background:rgba(56,189,248,0.15); color:var(--cyan); padding:2px 6px; border-radius:4px; font-weight:700;">Группа (${c.items.length})</span>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Категория: ${c.items[0].category}</div>
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
      const details = [];
      if (it.variant) details.push(`Высота: ${it.variant}`);
      if (it.color) details.push(`Цвет: ${it.color}`);

      return `
        <div class="box-card" style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between;">
            <b>${it.title} ${it.is_popular ? '(🔥 Хит)' : ''}</b>
            <span style="color:var(--green); font-weight:800;">${it.price} ₽</span>
          </div>
          <div style="font-size:11px; color:var(--cyan); margin:2px 0;">Формат: ${it.unit || '1 шт.'} · ${details.join(' · ') || 'Без модификаторов'}</div>
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

function openAddProductModal() {
  editingProductId = null;
  document.getElementById('prod-edit-title').innerText = "Новый одиночный товар";
  document.getElementById('prod-edit-name').value = "";
  document.getElementById('prod-edit-unit').value = "1 шт.";
  document.getElementById('prod-edit-variant').value = "";
  if (document.getElementById('prod-edit-color')) document.getElementById('prod-edit-color').value = "";
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
  if (document.getElementById('prod-edit-color')) document.getElementById('prod-edit-color').value = item.color || "";
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
    user_id: userId,
    admin_passcode: sessionPasscode,
    id: editingProductId,
    title: document.getElementById('prod-edit-name').value.trim(),
    unit: document.getElementById('prod-edit-unit').value.trim(),
    variant: document.getElementById('prod-edit-variant').value.trim(),
    color: document.getElementById('prod-edit-color') ? document.getElementById('prod-edit-color').value.trim() : '',
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
    body: JSON.stringify({ action: "admin_delete_product", user_id: userId, admin_passcode: sessionPasscode, id: id })
  });
  loadRootCatalog();
  loadCatalog();
}

function convertProductToGroup(id) {
  const it = allRootCatalog.find(i => String(i.id) === String(id));
  if (!it) return;

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
  document.getElementById('group-edit-title').innerText = "Создать группу вариаций";
  document.getElementById('group-edit-name').value = "";
  document.getElementById('group-edit-cat').value = "Цветы";
  document.getElementById('group-edit-desc').value = "";

  const popEl = document.getElementById('group-edit-popular-ui');
  popEl.classList.remove('checked'); popEl.innerText = '';

  renderGroupEditorPhotos("");

  const tbody = document.getElementById('group-variants-tbody');
  tbody.innerHTML = "";
  addGroupVariantRow({ unit: "15 шт.", variant: "50 см", color: "Красные", price: 3500, is_active: true });
  addGroupVariantRow({ unit: "15 шт.", variant: "60 см", color: "Белые", price: 4000, is_active: true });
  document.getElementById('group-editor-modal').classList.add('open');
}

function openEditGroupModal(encodedTitle) {
  const title = decodeURIComponent(encodedTitle);
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
  groupItems.forEach(item => addGroupVariantRow(item));

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
    <td><input type="text" class="gv-color" value="${data.color || ''}" placeholder="Красные"></td>
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
    color: r.querySelector('.gv-color') ? r.querySelector('.gv-color').value.trim() : '',
    price: parseFloat(r.querySelector('.gv-price').value) || 0,
    is_active: r.querySelector('.custom-checkbox').classList.contains('checked')
  }));

  toast("Сохранение группы...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_save_group",
      user_id: userId,
      admin_passcode: sessionPasscode,
      title: title,
      category: cat,
      photo_url: photo,
      description: desc,
      is_popular: isPop,
      variants_json: JSON.stringify(variants)
    })
  });

  toast("Группа сохранена!");
  closeGroupEditorModal();
  loadRootCatalog();
  loadCatalog();
}

// Фото
function triggerOrderPhotoUpload(orderId) {
  uploadTargetContext = { type: 'order', id: orderId };
  document.getElementById('camera-file-input').click();
}
function triggerProductPhotoUpload(target) {
  driveModalTarget = target;
  uploadTargetContext = { type: 'product', target: target };
  document.getElementById('camera-file-input').click();
}
function renderProductEditorPhotos(urlsStr) {
  const box = document.getElementById('prod-photo-strip');
  const hiddenInput = document.getElementById('prod-edit-photo');
  hiddenInput.value = urlsStr || "";
  const urls = (urlsStr || "").split(',').map(s => s.trim()).filter(Boolean);
  if (!urls.length) { box.innerHTML = '<span style="font-size:11px; color:var(--text-muted); padding:4px 0;">Нет фото</span>'; return; }
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
  renderProductEditorPhotos(cur ? `${cur}, ${url}` : url);
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
  if (!urls.length) { box.innerHTML = '<span style="font-size:11px; color:var(--text-muted); padding:4px 0;">Нет фото</span>'; return; }
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
  renderGroupEditorPhotos(cur ? `${cur}, ${url}` : url);
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
  fetch(`${API_URL}?action=admin_drive_media&user_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`)
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
  if (driveModalTarget === 'group') addGroupPhotoUrl(url); else addProductPhotoUrl(url);
  closeDriveMediaModal();
  toast("Фото прикреплено");
}

// Клиенты Root
async function loadRootClients() {
  const container = document.getElementById('root-clients-container');
  const res = await fetch(`${API_URL}?action=admin_clients&user_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`);
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

    const isClientAdmin = c.is_admin === true || String(c.is_admin).trim().toUpperCase() === 'TRUE';

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
    body: JSON.stringify({ action: "admin_update_spent", user_id: userId, admin_passcode: sessionPasscode, target_user_id: uid, total_spent: parseFloat(val) })
  });
  loadRootClients();
}

async function deleteUserRoot(uid) {
  if (!confirm("Сбросить аккаунт клиента?")) return;
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "admin_delete_user", user_id: userId, admin_passcode: sessionPasscode, target_user_id: uid })
  });
  loadRootClients();
}

// --- Управление рассылкой уведомлений ---
async function loadRootNotices() {
  const container = document.getElementById('root-notices-container');
  if (!container) return;
  try {
    const res = await fetch(`${API_URL}?action=admin_notifications&user_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`);
    allRootNotices = await res.json();

    if (!allRootNotices.length) {
      container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:16px 0;">Уведомлений пока не создано</div>';
      return;
    }

    container.innerHTML = allRootNotices.map(n => `
      <div class="box-card" style="margin-bottom:8px; border-left:3px solid ${n.is_active ? 'var(--cyan)' : 'var(--text-muted)'};">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <b>${n.title}</b>
            <span style="font-size:10px; background:rgba(56,189,248,0.15); color:var(--cyan); padding:2px 6px; border-radius:4px;">➔ ${n.target_tab}</span>
          </div>
          <span style="font-size:10px; font-weight:800; color:${n.is_active ? 'var(--green)' : 'var(--red)'};">
            ${n.is_active ? 'АКТИВНО' : 'В АРХИВЕ'}
          </span>
        </div>
        <div style="font-size:12px; color:var(--text); margin:6px 0;">${n.text}</div>
        <div style="font-size:10px; color:var(--text-muted); margin-bottom:8px;">Создано: ${n.date}</div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
          <button class="btn-metro btn-secondary" style="font-size:11px; padding:6px;" onclick="toggleNoticeActiveRoot('${n.id}', ${!n.is_active})">
            ${n.is_active ? 'В архив' : 'Активировать'}
          </button>
          <button class="btn-metro btn-secondary" style="font-size:11px; padding:6px; color:var(--amber);" onclick="resendNoticeRoot('${n.id}')">
            Повторить
          </button>
          <button class="btn-metro btn-danger" style="font-size:11px; padding:6px;" onclick="deleteNoticeRoot('${n.id}')">
            Удалить
          </button>
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

function openSendNoticeModal() {
  document.getElementById('notice-new-title').value = "";
  document.getElementById('notice-new-text').value = "";
  selectedNoticeTargetTab = 'catalog';
  document.getElementById('notice-target-display').innerText = "В каталог товаров";
  const chk = document.getElementById('notice-send-tg-ui');
  chk.classList.add('checked'); chk.innerText = '✓';
  document.getElementById('send-notice-modal').classList.add('open');
}
function closeSendNoticeModal() { document.getElementById('send-notice-modal').classList.remove('open'); }

function selectNoticeTarget(tab, label) {
  selectedNoticeTargetTab = tab;
  document.getElementById('notice-target-display').innerText = label;
  document.getElementById('notice-target-box').classList.remove('open');
}

async function submitNewNotificationRoot() {
  const title = document.getElementById('notice-new-title').value.trim();
  const text = document.getElementById('notice-new-text').value.trim();
  const sendTg = document.getElementById('notice-send-tg-ui').classList.contains('checked');

  if (!title || !text) { toast("Заполните заголовок и текст"); return; }

  toast("Отправка уведомления...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_send_notification",
      user_id: userId,
      admin_passcode: sessionPasscode,
      title: title,
      text: text,
      target_tab: selectedNoticeTargetTab,
      send_tg: sendTg
    })
  });
  closeSendNoticeModal();
  loadRootNotices();
  toast("Уведомление успешно создано!");
}

async function toggleNoticeActiveRoot(id, nextState) {
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_manage_notification",
      user_id: userId,
      admin_passcode: sessionPasscode,
      id: id,
      sub_action: "toggle_active",
      is_active: nextState
    })
  });
  loadRootNotices();
}

async function resendNoticeRoot(id) {
  toast("Повторная рассылка...");
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_manage_notification",
      user_id: userId,
      admin_passcode: sessionPasscode,
      id: id,
      sub_action: "resend"
    })
  });
  toast("Разослано в Telegram!");
}

async function deleteNoticeRoot(id) {
  if (!confirm("Удалить уведомление и всю его статистику?")) return;
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_manage_notification",
      user_id: userId,
      admin_passcode: sessionPasscode,
      id: id,
      sub_action: "delete"
    })
  });
  loadRootNotices();
  toast("Удалено");
}

// --- Статистика и аналитика ---
function switchStatPeriod(period) {
  currentStatPeriod = period;
  ['today', '7days', 'month'].forEach(p => {
    const btn = document.getElementById(`stat-btn-${p}`);
    if (btn) btn.classList.toggle('active', p === period);
  });
  loadRootStats();
}

async function loadRootStats() {
  const container = document.getElementById('root-stats-content');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Загрузка аналитики...</div>';

  try {
    const res = await fetch(`${API_URL}?action=admin_get_stats&user_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}&period=${currentStatPeriod}`);
    const data = await res.json();
    renderRootStats(data);
  } catch (e) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--red);">Ошибка загрузки аналитики</div>';
  }
}

function renderRootStats(d) {
  const container = document.getElementById('root-stats-content');
  if (!container) return;

  const topProductsHtml = Object.entries(d.product_views || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([entId, cnt]) => {
      const p = catalog.find(i => String(i.id) === String(entId)) || displayCatalog.find(g => String(g.id) === String(entId));
      const title = p ? p.title : `ID: ${entId}`;
      return `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:12px;"><span>${title}</span><b>${cnt} просп.</b></div>`;
    }).join('') || '<div style="color:var(--text-muted); font-size:11px;">Нет просмотров за период</div>';

  const noticesHtml = Object.entries(d.notice_stats || {}).map(([nid, s]) => {
    const notif = allRootNotices.find(n => String(n.id) === String(nid));
    const title = notif ? notif.title : `Уведомление #${nid}`;
    return `
      <div style="background:var(--card-inner); padding:8px; border-radius:6px; margin-bottom:6px; font-size:11px;">
        <b>${title}</b><br>
        Открыли: <b>${s.views}</b> · Прочитали: <b>${s.reads}</b> · Перешли по ссылке: <b style="color:var(--cyan);">${s.clicks}</b>
      </div>
    `;
  }).join('') || '<div style="color:var(--text-muted); font-size:11px;">Нет данных по уведомлениям</div>';

  const daysHtml = Object.entries(d.days_breakdown || {}).map(([day, val]) => `
    <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border); font-size:11px;">
      <span>${day}</span>
      <span>Входов: <b>${val.opens}</b> | Заказов: <b style="color:var(--green);">${val.orders}</b></span>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
      <div class="box-card" style="padding:10px; text-align:center;">
        <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Запусков приложения</div>
        <div style="font-size:22px; font-weight:900; color:var(--cyan); margin-top:2px;">${d.total_opens}</div>
      </div>
      <div class="box-card" style="padding:10px; text-align:center;">
        <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Оформлено заказов</div>
        <div style="font-size:22px; font-weight:900; color:var(--green); margin-top:2px;">${d.total_orders}</div>
      </div>
    </div>

    <div class="box-card" style="margin-bottom:10px;">
      <div style="font-size:11px; font-weight:800; color:var(--cyan); text-transform:uppercase; margin-bottom:6px;">🔥 Популярные товары (просмотры):</div>
      ${topProductsHtml}
    </div>

    <div class="box-card" style="margin-bottom:10px;">
      <div style="font-size:11px; font-weight:800; color:var(--cyan); text-transform:uppercase; margin-bottom:6px;">📊 Воронка уведомлений:</div>
      ${noticesHtml}
    </div>

    ${daysHtml ? `
      <div class="box-card">
        <div style="font-size:11px; font-weight:800; color:var(--cyan); text-transform:uppercase; margin-bottom:6px;">📅 Динамика по дням:</div>
        ${daysHtml}
      </div>
    ` : ''}
  `;
}

// Root FAQ
async function loadRootFaq() {
  const container = document.getElementById('root-faq-container');
  const res = await fetch(`${API_URL}?action=admin_faq&user_id=${userId}&admin_passcode=${encodeURIComponent(sessionPasscode)}`);
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
    body: JSON.stringify({ action: "admin_move_faq", user_id: userId, admin_passcode: sessionPasscode, id: id, direction: direction })
  });
  loadRootFaq();
  cachedFaq = null;
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
      user_id: userId,
      admin_passcode: sessionPasscode,
      id: editingFaqId || "new",
      question: q,
      answer: a,
      is_active: isActive
    })
  });
  closeFaqEditorModal();
  loadRootFaq();
  cachedFaq = null;
}

async function toggleFaqActiveRoot(id, nextState) {
  const f = allRootFaq.find(i => String(i.id) === String(id));
  if (!f) return;
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: "admin_update_faq",
      user_id: userId,
      admin_passcode: sessionPasscode,
      id: f.id,
      question: f.question,
      answer: f.answer,
      is_active: nextState
    })
  });
  loadRootFaq();
  cachedFaq = null;
}

async function deleteFaqRoot(id) {
  if (!confirm("Удалить этот вопрос?")) return;
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "admin_delete_faq", user_id: userId, admin_passcode: sessionPasscode, id: id })
  });
  loadRootFaq();
  cachedFaq = null;
}
