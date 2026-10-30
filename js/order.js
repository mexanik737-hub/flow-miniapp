window.orderDelType = window.orderDelType || 'delivery';
window.orderRecType = window.orderRecType || 'self';
window.savedAddresses = window.savedAddresses || [];
window.currentFlowersSubtotal = window.currentFlowersSubtotal || 0;

let deliveryDistanceKm = 0;
let calculatedDeliveryPrice = 0;
let selectedAddressGeo = null;
let currentPendingPaymentOrderId = null;
let orderPaymentCountdownTimer = null;

function setDeliveryType(type) {
  triggerHaptic('selection');
  orderDelType = type;
  document.getElementById('btn-del')?.classList.toggle('active', type === 'delivery');
  document.getElementById('btn-pick')?.classList.toggle('active', type === 'pickup');

  const delExtra = document.getElementById('delivery-extra-fields');
  const pickExtra = document.getElementById('pickup-extra-fields');

  if (type === 'delivery') {
    if (delExtra) delExtra.style.display = 'block';
    if (pickExtra) pickExtra.style.display = 'none';
  } else {
    if (delExtra) delExtra.style.display = 'none';
    if (pickExtra) pickExtra.style.display = 'block';
    calculatedDeliveryPrice = 0;
  }
  recalcFinalOrderTotals();
  if (typeof saveCurrentOrderFormDraft === 'function') saveCurrentOrderFormDraft();
}
window.setDeliveryType = setDeliveryType;

function setRecipientType(type) {
  triggerHaptic('selection');
  orderRecType = type;
  document.getElementById('btn-rec-self')?.classList.toggle('active', type === 'self');
  document.getElementById('btn-rec-other')?.classList.toggle('active', type === 'other');

  const otherFields = document.getElementById('other-rec-fields');
  if (otherFields) {
    otherFields.style.display = (type === 'other') ? 'block' : 'none';
  }
  if (typeof saveCurrentOrderFormDraft === 'function') saveCurrentOrderFormDraft();
}
window.setRecipientType = setRecipientType;

function openOrderModal() {
  triggerHaptic('selection');
  if (typeof requestIosOrientationPermission === 'function') {
    requestIosOrientationPermission();
  }

  const cartEntries = Object.entries(cart || {});
  if (!cartEntries.length) {
    toast("Корзина пуста");
    return;
  }

  if (typeof loadCurrentOrderFormDraft === 'function') {
    loadCurrentOrderFormDraft();
  }

  renderSavedAddressPillsForOrder();
  recalcFinalOrderTotals();

  const m = document.getElementById('order-modal');
  if (m) m.classList.add('open');
}
window.openOrderModal = openOrderModal;

function closeOrderModal() {
  triggerHaptic('light');
  const m = document.getElementById('order-modal');
  if (m) m.classList.remove('open');
}
window.closeOrderModal = closeOrderModal;

function renderSavedAddressPillsForOrder() {
  const container = document.getElementById('order-saved-address-container');
  const pillsBox = document.getElementById('order-saved-address-pills');
  if (!container || !pillsBox) return;

  if (!savedAddresses || !savedAddresses.length) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  pillsBox.innerHTML = savedAddresses.map((a, idx) => `
    <div class="addr-pill" onclick="selectSavedAddressForOrder(${idx})">
      📍 ${a.label}: ${a.address}
    </div>
  `).join('');
}

function selectSavedAddressForOrder(idx) {
  triggerHaptic('selection');
  const a = savedAddresses[idx];
  if (!a) return;

  document.querySelectorAll('#order-saved-address-pills .addr-pill').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });

  const input = document.getElementById('ord-suggest-input');
  if (input) input.value = a.address;

  document.getElementById('ord-entrance').value = a.entrance || '';
  document.getElementById('ord-floor').value = a.floor || '';
  document.getElementById('ord-apt').value = a.apt || '';
  document.getElementById('ord-intercom').value = a.intercom || '';

  selectedAddressGeo = { lat: a.lat, lon: a.lon };
  calculateDeliveryCostByCoords(a.lat, a.lon);

  const suggestList = document.getElementById('ord-suggest-list');
  if (suggestList) suggestList.style.display = 'none';
  if (typeof saveCurrentOrderFormDraft === 'function') saveCurrentOrderFormDraft();
}
window.selectSavedAddressForOrder = selectSavedAddressForOrder;

function onAddressInput(query) {
  clearTimeout(suggestDebounceTimer);
  const box = document.getElementById('ord-suggest-list');
  selectedAddressGeo = null;

  if (typeof saveCurrentOrderFormDraft === 'function') saveCurrentOrderFormDraft();

  if (!query || query.trim().length < 2) {
    if (box) box.style.display = 'none';
    return;
  }

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
      if (!items.length) { if (box) box.style.display = 'none'; return; }
      if (box) {
        box.innerHTML = items.map((s, idx) => `
          <div class="suggest-item" onclick="selectOrderAddressSuggestItem(${idx})">${s.value}</div>
        `).join('');
        box.style.display = 'block';
      }
      window.orderAddressSuggestions = items;
    } catch (e) {}
  }, 250);
}
window.onAddressInput = onAddressInput;

function selectOrderAddressSuggestItem(idx) {
  triggerHaptic('selection');
  const s = window.orderAddressSuggestions?.[idx];
  if (!s) return;

  const input = document.getElementById('ord-suggest-input');
  if (input) input.value = s.value;

  const box = document.getElementById('ord-suggest-list');
  if (box) box.style.display = 'none';

  if (s.data?.geo_lat && s.data?.geo_lon) {
    selectedAddressGeo = { lat: parseFloat(s.data.geo_lat), lon: parseFloat(s.data.geo_lon) };
    calculateDeliveryCostByCoords(selectedAddressGeo.lat, selectedAddressGeo.lon);
  }
  if (typeof saveCurrentOrderFormDraft === 'function') saveCurrentOrderFormDraft();
}
window.selectOrderAddressSuggestItem = selectOrderAddressSuggestItem;

function calculateDeliveryCostByCoords(lat, lon) {
  const storeLat = parseFloat(SERVER_CONFIG.store_lat) || 55.966987;
  const storeLon = parseFloat(SERVER_CONFIG.store_lon) || 37.151059;

  const dist = calcHaversineDistance(storeLat, storeLon, lat, lon);
  deliveryDistanceKm = Math.round(dist * 10) / 10;

  if (deliveryDistanceKm <= 2.0) {
    calculatedDeliveryPrice = 350;
  } else {
    calculatedDeliveryPrice = Math.round(350 + (deliveryDistanceKm - 2.0) * 40);
  }

  const badge = document.getElementById('delivery-calc-badge');
  if (badge) {
    badge.innerHTML = `📍 Расстояние: <b>${deliveryDistanceKm} км</b> · Доставка: <b>${calculatedDeliveryPrice} ₽</b>`;
  }
  recalcFinalOrderTotals();
}

function recalcFinalOrderTotals() {
  const subtotal = currentFlowersSubtotal || 0;
  const delCost = (orderDelType === 'delivery') ? calculatedDeliveryPrice : 0;
  const finalTotal = subtotal + delCost;

  const subEl = document.getElementById('order-subtotal-val');
  const delEl = document.getElementById('order-delivery-val');
  const finEl = document.getElementById('order-final-val');

  if (subEl) subEl.innerText = `${subtotal} ₽`;
  if (delEl) delEl.innerText = `${delCost} ₽`;
  if (finEl) finEl.innerText = `${finalTotal} ₽`;
}
window.recalcFinalOrderTotals = recalcFinalOrderTotals;

function proceedToOrderSummary() {
  triggerHaptic('medium');

  const cartEntries = Object.entries(cart || {});
  if (!cartEntries.length) {
    toast("Корзина пуста");
    return;
  }

  if (orderDelType === 'delivery') {
    const street = document.getElementById('ord-suggest-input')?.value.trim();
    const ent = document.getElementById('ord-entrance')?.value.trim();
    const flr = document.getElementById('ord-floor')?.value.trim();
    const apt = document.getElementById('ord-apt')?.value.trim();
    const intc = document.getElementById('ord-intercom')?.value.trim();

    if (!street) {
      toast("Укажите улицу и номер дома");
      return;
    }
    if (!ent || !flr || !apt || !intc) {
      toast("Заполните все поля адреса: подъезд, этаж, квартиру и домофон");
      return;
    }
  }

  if (orderRecType === 'other') {
    const recName = document.getElementById('ord-rec-name')?.value.trim();
    const recPhone = document.getElementById('ord-rec-phone')?.value.trim();
    if (!recName || !recPhone || recPhone.length < 17) {
      toast("Укажите имя и полный телефон получателя");
      return;
    }
  }

  renderOrderSummaryBox();
  closeOrderModal();
  document.getElementById('order-summary-modal')?.classList.add('open');
}
window.proceedToOrderSummary = proceedToOrderSummary;

function closeOrderSummaryModal() {
  triggerHaptic('light');
  document.getElementById('order-summary-modal')?.classList.remove('open');
  document.getElementById('order-modal')?.classList.add('open');
}
window.closeOrderSummaryModal = closeOrderSummaryModal;

function renderOrderSummaryBox() {
  const box = document.getElementById('order-summary-box');
  if (!box) return;

  const subtotal = currentFlowersSubtotal || 0;
  const delCost = (orderDelType === 'delivery') ? calculatedDeliveryPrice : 0;
  const finalTotal = subtotal + delCost;

  let recInfo = "Заказчик лично";
  if (orderRecType === 'other') {
    const n = document.getElementById('ord-rec-name')?.value.trim();
    const p = document.getElementById('ord-rec-phone')?.value.trim();
    recInfo = `${n} (${p})`;
  }

  let addressDisplay = "Самовывоз: Зеленоград, Георгиевский пр-т, 37к2";
  if (orderDelType === 'delivery') {
    const street = document.getElementById('ord-suggest-input')?.value.trim();
    const ent = document.getElementById('ord-entrance')?.value.trim();
    const flr = document.getElementById('ord-floor')?.value.trim();
    const apt = document.getElementById('ord-apt')?.value.trim();
    const intc = document.getElementById('ord-intercom')?.value.trim();
    addressDisplay = `${street}, под. ${ent}, эт. ${flr}, кв. ${apt}, дом. ${intc}`;
  }

  const desiredTime = document.getElementById('selected-time-display')?.innerText || "10:00 – 12:00";
  const shopComment = document.getElementById('ord-shop-comment')?.value.trim();

  box.innerHTML = `
    <div class="summary-line">
      <span class="summary-line-label">Получатель:</span>
      <span class="summary-line-val">${recInfo}</span>
    </div>
    <div class="summary-line">
      <span class="summary-line-label">Тип:</span>
      <span class="summary-line-val">${orderDelType === 'delivery' ? '🚚 Доставка курьером' : '📍 Самовывоз из салона'}</span>
    </div>
    <div class="summary-line">
      <span class="summary-line-label">Адрес:</span>
      <span class="summary-line-val">${addressDisplay}</span>
    </div>
    <div class="summary-line">
      <span class="summary-line-label">Время:</span>
      <span class="summary-line-val">${desiredTime}</span>
    </div>
    ${shopComment ? `
      <div class="summary-line">
        <span class="summary-line-label">Пожелания:</span>
        <span class="summary-line-val">${shopComment}</span>
      </div>
    ` : ''}
    <div class="summary-line">
      <span class="summary-line-label">Цветы:</span>
      <span class="summary-line-val">${subtotal} ₽</span>
    </div>
    <div class="summary-line">
      <span class="summary-line-label">Доставка:</span>
      <span class="summary-line-val">${delCost} ₽</span>
    </div>
    <div class="summary-line" style="border-bottom:none; padding-top:8px;">
      <span class="summary-line-label" style="font-size:14px; font-weight:800; color:var(--text);">ИТОГО:</span>
      <span class="summary-line-val" style="font-size:16px; font-weight:900; color:var(--green);">${finalTotal} ₽</span>
    </div>
  `;
}

async function submitFinalOrder() {
  triggerHaptic('medium');
  toast("Создание заказа...");

  const cartEntries = Object.entries(cart || {});
  const itemsPayload = cartEntries.map(([key, qty]) => {
    const [id, unit, variant, color] = key.split(':::');
    const it = catalog.find(c => String(c.id) === String(id));
    return {
      id: id,
      title: it ? it.title : "Цветы",
      unit: unit,
      variant: variant,
      color: color,
      price: it ? it.price : 0,
      qty: qty,
      in_bouquet: !!cartAssemblyItems[key]
    };
  });

  const subtotal = currentFlowersSubtotal || 0;
  const delCost = (orderDelType === 'delivery') ? calculatedDeliveryPrice : 0;
  const finalTotal = subtotal + delCost;

  let recInfo = "Заказчик лично";
  if (orderRecType === 'other') {
    const n = document.getElementById('ord-rec-name')?.value.trim();
    const p = document.getElementById('ord-rec-phone')?.value.trim();
    recInfo = `${n} (${p})`;
  }

  let fullAddress = "Самовывоз: Зеленоград, Георгиевский пр-т, 37к2";
  let courierComment = document.getElementById('ord-comment')?.value.trim();

  if (orderDelType === 'delivery') {
    const street = document.getElementById('ord-suggest-input')?.value.trim();
    const ent = document.getElementById('ord-entrance')?.value.trim();
    const flr = document.getElementById('ord-floor')?.value.trim();
    const apt = document.getElementById('ord-apt')?.value.trim();
    const intc = document.getElementById('ord-intercom')?.value.trim();
    fullAddress = `${street}, под. ${ent}, эт. ${flr}, кв. ${apt}, дом. ${intc}`;
    if (courierComment) {
      fullAddress += ` [курьеру: ${courierComment}]`;
    }

    if (ordSaveAddrChecked && selectedAddressGeo && savedAddresses.length < 3) {
      savedAddresses.push({
        label: "Дом",
        address: street,
        entrance: ent,
        floor: flr,
        apt: apt,
        intercom: intc,
        lat: selectedAddressGeo.lat,
        lon: selectedAddressGeo.lon
      });
      if (typeof syncSavedAddresses === 'function') syncSavedAddresses();
    }
  }

  const desiredTime = document.getElementById('selected-time-display')?.innerText || "10:00 – 12:00";
  const shopComment = document.getElementById('ord-shop-comment')?.value.trim();

  if (ordSaveNextDefaultsChecked) {
    try {
      const defaults = {
        recType: orderRecType,
        delType: orderDelType,
        recName: document.getElementById('ord-rec-name')?.value || '',
        recPhone: document.getElementById('ord-rec-phone')?.value || '',
        street: document.getElementById('ord-suggest-input')?.value || '',
        entrance: document.getElementById('ord-entrance')?.value || '',
        floor: document.getElementById('ord-floor')?.value || '',
        apt: document.getElementById('ord-apt')?.value || '',
        intercom: document.getElementById('ord-intercom')?.value || '',
        comment: courierComment || '',
        shopComment: shopComment || ''
      };
      localStorage.setItem('flw_order_saved_defaults', JSON.stringify(defaults));
    } catch (e) {}
  }

  localStorage.removeItem('flw_order_draft');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: "create_order",
        user_id: userId,
        user_name: currentUser?.name || tgFirstName || "Клиент",
        user_phone: currentUser?.phone || "",
        delivery_type: orderDelType,
        recipient_info: recInfo,
        address: fullAddress,
        delivery_time: desiredTime,
        shop_comment: shopComment,
        delivery_cost: delCost,
        items_json: JSON.stringify(itemsPayload),
        total_amount: finalTotal,
        need_assembly: isAssemblyMode
      })
    });

    const data = await res.json();
    if (data.success) {
      document.getElementById('order-summary-modal')?.classList.remove('open');
      clearCartStorage();
      if (typeof updateCartUI === 'function') updateCartUI();

      if (isAssemblyMode) {
        document.getElementById('asm-modal-order-id').innerText = data.order_id;
        document.getElementById('assembly-call-modal')?.classList.add('open');
      } else {
        openPaymentModal(data.order_id, data.total_amount);
      }
    } else {
      toast("Ошибка оформления заказа");
    }
  } catch (err) {
    toast("Ошибка связи с сервером");
  }
}
window.submitFinalOrder = submitFinalOrder;

function closeAssemblyModal() {
  triggerHaptic('light');
  document.getElementById('assembly-call-modal')?.classList.remove('open');
  navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
}
window.closeAssemblyModal = closeAssemblyModal;

function openPaymentModal(orderId, totalAmount, orderDateTimeStr = null) {
  triggerHaptic('selection');
  currentPendingPaymentOrderId = orderId;

  document.getElementById('pay-modal-order-id').innerText = `Оплата ${orderId}`;
  document.getElementById('pay-modal-amount').innerText = `${totalAmount} ₽`;

  startPaymentCountdown(orderDateTimeStr);
  document.getElementById('payment-modal')?.classList.add('open');
}
window.openPaymentModal = openPaymentModal;

function closePaymentModal() {
  triggerHaptic('light');
  if (orderPaymentCountdownTimer) clearInterval(orderPaymentCountdownTimer);
  document.getElementById('payment-modal')?.classList.remove('open');
}
window.closePaymentModal = closePaymentModal;

function startPaymentCountdown(orderDateTimeStr) {
  if (orderPaymentCountdownTimer) clearInterval(orderPaymentCountdownTimer);

  const timerValEl = document.getElementById('pay-timer-val');
  const createdTs = orderDateTimeStr ? parseOrderDateToTs(orderDateTimeStr) : Date.now();
  const TIMEOUT_MS = 15.5 * 60 * 1000;

  function update() {
    const elapsed = Date.now() - createdTs;
    const leftMs = TIMEOUT_MS - elapsed;

    if (leftMs <= 0) {
      if (timerValEl) timerValEl.innerText = "00:00 (Истекло)";
      clearInterval(orderPaymentCountdownTimer);
      return;
    }

    const totalSec = Math.floor(leftMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (timerValEl) {
      timerValEl.innerText = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    }
  }

  update();
  orderPaymentCountdownTimer = setInterval(update, 1000);
}

function copyPaymentAmount() {
  triggerHaptic('selection');
  const amtText = document.getElementById('pay-modal-amount')?.innerText || '';
  const cleanAmt = amtText.replace(/[^\d]/g, '');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(cleanAmt);
    toast("Сумма скопирована!");
  }
}
window.copyPaymentAmount = copyPaymentAmount;

async function confirmPaymentByClient() {
  triggerHaptic('medium');
  if (!currentPendingPaymentOrderId) return;

  toast("Отправка подтверждения...");
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: "client_paid", order_id: currentPendingPaymentOrderId })
    });

    closePaymentModal();
    document.getElementById('order-success-modal')?.classList.add('open');
    if (typeof startConfettiAnimation === 'function') {
      startConfettiAnimation();
    }
  } catch (e) {
    toast("Ошибка подтверждения");
  }
}
window.confirmPaymentByClient = confirmPaymentByClient;

function closeOrderSuccessModalAndGoToOrders() {
  triggerHaptic('light');
  if (typeof stopConfettiAnimation === 'function') stopConfettiAnimation();
  document.getElementById('order-success-modal')?.classList.remove('open');
  navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
}
window.closeOrderSuccessModalAndGoToOrders = closeOrderSuccessModalAndGoToOrders;
