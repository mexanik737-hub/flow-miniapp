let orderDeliveryType = 'delivery';
let orderRecipientType = 'self';
let ordSaveAddrChecked = false;
let currentFlowersSubtotal = 0;
let currentDeliveryCost = 0;
let selectedAddressSuggestion = null;
let currentActiveOrderIdForPay = "";
let currentActiveOrderAmount = 0;
let paymentTimerInterval = null;

function setDeliveryType(type) {
  triggerHaptic('selection');
  orderDeliveryType = type;
  document.getElementById('btn-del').classList.toggle('active', type === 'delivery');
  document.getElementById('btn-pick').classList.toggle('active', type === 'pickup');

  document.getElementById('delivery-extra-fields').style.display = (type === 'delivery' ? 'block' : 'none');
  document.getElementById('pickup-extra-fields').style.display = (type === 'pickup' ? 'block' : 'none');

  if (type === 'pickup') {
    currentDeliveryCost = 0;
  }
  recalcOrderTotalsUI();
}
window.setDeliveryType = setDeliveryType;

function setRecipientType(type) {
  triggerHaptic('selection');
  orderRecipientType = type;
  document.getElementById('btn-rec-self').classList.toggle('active', type === 'self');
  document.getElementById('btn-rec-other').classList.toggle('active', type === 'other');
  document.getElementById('other-rec-fields').style.display = (type === 'other' ? 'block' : 'none');
}
window.setRecipientType = setRecipientType;

function populateDeliveryTimeSlots() {
  const optionsBox = document.getElementById('time-select-options');
  if (!optionsBox) return;

  const slots = [
    "Как можно скорее",
    "10:00 - 12:00",
    "12:00 - 14:00",
    "14:00 - 16:00",
    "16:00 - 18:00",
    "18:00 - 20:00",
    "Другой день (согласовать)"
  ];

  optionsBox.innerHTML = slots.map(slot => `
    <div class="custom-select-option" onclick="selectDeliveryTimeSlot('${slot}')">${slot}</div>
  `).join('');

  document.getElementById('selected-time-display').innerText = slots[0];
}

function selectDeliveryTimeSlot(slot) {
  triggerHaptic('selection');
  document.getElementById('selected-time-display').innerText = slot;
  document.getElementById('time-select-box').classList.remove('open');
}
window.selectDeliveryTimeSlot = selectDeliveryTimeSlot;

function onAddressInput(query) {
  clearTimeout(suggestDebounceTimer);
  const box = document.getElementById('ord-suggest-list');
  selectedAddressSuggestion = null;

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
        body: JSON.stringify({
          query: query,
          locations: [{ region: "Москва" }, { region: "Московская" }],
          count: 5
        })
      });
      const data = await res.json();
      const items = data.suggestions || [];
      if (!items.length) {
        if (box) box.style.display = 'none';
        return;
      }
      if (box) {
        box.innerHTML = items.map((s, idx) => `
          <div class="suggest-item" onclick="selectAddressItem(${idx})">${s.value}</div>
        `).join('');
        box.style.display = 'block';
      }
      window.currentAddressSuggestions = items;
    } catch (e) {}
  }, 250);
}
window.onAddressInput = onAddressInput;

function selectAddressItem(idx) {
  triggerHaptic('selection');
  const s = window.currentAddressSuggestions?.[idx];
  if (!s) return;
  document.getElementById('ord-suggest-input').value = s.value;
  document.getElementById('ord-suggest-list').style.display = 'none';
  selectedAddressSuggestion = s;
  recalculateDeliveryPrice(s);
}
window.selectAddressItem = selectAddressItem;

function recalculateDeliveryPrice(suggestion) {
  const badge = document.getElementById('delivery-calc-badge');
  if (!suggestion || !suggestion.data || !suggestion.data.geo_lat || !suggestion.data.geo_lon) {
    currentDeliveryCost = 350;
    if (badge) badge.innerHTML = `📍 Адрес сохранен. Базовый тариф доставки: <b>350 ₽</b>`;
    recalcOrderTotalsUI();
    return;
  }

  const clientLat = parseFloat(suggestion.data.geo_lat);
  const clientLon = parseFloat(suggestion.data.geo_lon);
  const storeLat = SERVER_CONFIG.store_lat || 55.966987;
  const storeLon = SERVER_CONFIG.store_lon || 37.151059;

  const distKm = calcHaversineDistance(storeLat, storeLon, clientLat, clientLon);

  let cost = 350;
  if (distKm > 2.0) {
    const extraKm = Math.ceil(distKm - 2.0);
    cost += extraKm * 40;
  }
  currentDeliveryCost = cost;

  if (badge) {
    badge.innerHTML = `🚚 Расстояние от салона: <b>~${distKm.toFixed(1)} км</b> · Стоимость доставки: <b>${cost} ₽</b>`;
  }
  recalcOrderTotalsUI();
}

function renderSavedAddressesInOrder() {
  const container = document.getElementById('order-saved-address-container');
  const pillsWrap = document.getElementById('order-saved-address-pills');
  if (!container || !pillsWrap) return;

  if (!savedAddresses || !savedAddresses.length) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  pillsWrap.innerHTML = savedAddresses.map((a, idx) => `
    <div class="addr-pill" onclick="applySavedAddressToOrder(${idx})">
      📍 ${a.label}: ${a.address}
    </div>
  `).join('');
}

function applySavedAddressToOrder(idx) {
  triggerHaptic('selection');
  const a = savedAddresses[idx];
  if (!a) return;

  document.getElementById('ord-suggest-input').value = a.address;
  document.getElementById('ord-entrance').value = a.entrance || '';
  document.getElementById('ord-floor').value = a.floor || '';
  document.getElementById('ord-apt').value = a.apt || '';
  document.getElementById('ord-intercom').value = a.intercom || '';

  if (a.lat && a.lon) {
    selectedAddressSuggestion = {
      value: a.address,
      data: { house: "1", geo_lat: a.lat, geo_lon: a.lon }
    };
    recalculateDeliveryPrice(selectedAddressSuggestion);
  } else {
    currentDeliveryCost = 350;
    recalcOrderTotalsUI();
  }
}
window.applySavedAddressToOrder = applySavedAddressToOrder;

function recalcOrderTotalsUI() {
  const subtotal = currentFlowersSubtotal;
  const delivery = (orderDeliveryType === 'delivery') ? currentDeliveryCost : 0;
  const finalVal = subtotal + delivery;

  const subEl = document.getElementById('order-subtotal-val');
  const delEl = document.getElementById('order-delivery-val');
  const finEl = document.getElementById('order-final-val');

  if (subEl) subEl.innerText = `${subtotal} ₽`;
  if (delEl) delEl.innerText = `${delivery} ₽`;
  if (finEl) finEl.innerText = `${finalVal} ₽`;
}

function openOrderModal() {
  triggerHaptic('selection');
  if (!currentUser) {
    const regModal = document.getElementById('reg-modal');
    if (regModal) regModal.classList.add('open');
    return;
  }

  setDeliveryType('delivery');
  setRecipientType('self');
  populateDeliveryTimeSlots();
  renderSavedAddressesInOrder();
  recalcOrderTotalsUI();

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

// ----------------- ЭТАП 2: МОДАЛКА КРАТКОЙ СВОДКИ ЗАКАЗА -----------------

function openOrderSummaryModal() {
  triggerHaptic('medium');

  if (orderRecipientType === 'other') {
    const rName = document.getElementById('ord-rec-name').value.trim();
    const rPhone = document.getElementById('ord-rec-phone').value.trim();
    if (!rName || rPhone.length < 17) {
      toast("Укажите имя и телефон получателя полностью: 8 (***) ***-**-**");
      return;
    }
  }

  if (orderDeliveryType === 'delivery') {
    const addr = document.getElementById('ord-suggest-input').value.trim();
    const ent = document.getElementById('ord-entrance').value.trim();
    const flr = document.getElementById('ord-floor').value.trim();
    const apt = document.getElementById('ord-apt').value.trim();
    const intc = document.getElementById('ord-intercom').value.trim();

    if (!addr) {
      toast("Укажите адрес доставки");
      return;
    }
    if (!selectedAddressSuggestion || !selectedAddressSuggestion.data?.house) {
      toast("Выберите точный адрес с номером дома из подсказок DaData");
      return;
    }
    if (!ent || !flr || !apt || !intc) {
      toast("Заполните все поля адреса: подъезд, этаж, квартиру и домофон");
      return;
    }
  }

  // Заполняем краткую сводку
  const itemsSummaryBox = document.getElementById('summary-items-list');
  const entries = Object.entries(cart || {});
  if (itemsSummaryBox) {
    itemsSummaryBox.innerHTML = entries.map(([cartKey, qty]) => {
      const [id, selectedUnit, selectedVar, selectedColor] = cartKey.split(':::');
      const it = catalog.find(i => String(i.id) === String(id));
      if (!it) return '';
      const fullTitle = formatFullItemTitle(it.title, selectedUnit || it.unit, selectedVar, selectedColor);
      const isAsm = isAssemblyMode && cartAssemblyItems[cartKey];
      return `<div>• ${fullTitle} × ${qty} шт. = <b>${it.price * qty} ₽</b>${isAsm ? ' <span style="color:var(--gold);">[в букет]</span>' : ''}</div>`;
    }).join('');
  }

  const delTypeEl = document.getElementById('summary-delivery-type');
  const addrRow = document.getElementById('summary-address-row');
  const addrVal = document.getElementById('summary-address-val');
  const timeVal = document.getElementById('summary-time-val');
  const recVal = document.getElementById('summary-recipient-val');
  const totalVal = document.getElementById('summary-total-val');

  if (delTypeEl) delTypeEl.innerText = (orderDeliveryType === 'delivery' ? '🚚 Курьерская доставка' : '📍 Самовывоз (Георгиевский пр-т, 37к2)');

  if (orderDeliveryType === 'delivery') {
    const addr = document.getElementById('ord-suggest-input').value.trim();
    const ent = document.getElementById('ord-entrance').value.trim();
    const flr = document.getElementById('ord-floor').value.trim();
    const apt = document.getElementById('ord-apt').value.trim();
    const intc = document.getElementById('ord-intercom').value.trim();
    if (addrRow) addrRow.style.display = 'block';
    if (addrVal) addrVal.innerText = `${addr}, под. ${ent}, эт. ${flr}, кв. ${apt}, дом. ${intc}`;
  } else {
    if (addrRow) addrRow.style.display = 'none';
  }

  if (timeVal) timeVal.innerText = document.getElementById('selected-time-display').innerText;

  if (recVal) {
    if (orderRecipientType === 'other') {
      const rName = document.getElementById('ord-rec-name').value.trim();
      const rPhone = document.getElementById('ord-rec-phone').value.trim();
      recVal.innerText = `${rName} (${rPhone})`;
    } else {
      recVal.innerText = `Заказчик лично (${currentUser.name})`;
    }
  }

  const finalSum = currentFlowersSubtotal + ((orderDeliveryType === 'delivery') ? currentDeliveryCost : 0);
  if (totalVal) totalVal.innerText = `${finalSum} ₽`;

  closeOrderModal();
  const summaryModal = document.getElementById('order-summary-modal');
  if (summaryModal) summaryModal.classList.add('open');
}
window.openOrderSummaryModal = openOrderSummaryModal;

function closeOrderSummaryModal() {
  triggerHaptic('light');
  const m = document.getElementById('order-summary-modal');
  if (m) m.classList.remove('open');
}
window.closeOrderSummaryModal = closeOrderSummaryModal;

// ----------------- ФИНАЛЬНОЕ СОЗДАНИЕ ЗАКАЗА -----------------

async function submitFinalOrder() {
  triggerHaptic('medium');
  toast("Оформление заказа...");

  let fullAddress = "Самовывоз: Зеленоград, Георгиевский пр-т, 37к2";
  if (orderDeliveryType === 'delivery') {
    const addr = document.getElementById('ord-suggest-input').value.trim();
    const ent = document.getElementById('ord-entrance').value.trim();
    const flr = document.getElementById('ord-floor').value.trim();
    const apt = document.getElementById('ord-apt').value.trim();
    const intc = document.getElementById('ord-intercom').value.trim();
    const comment = document.getElementById('ord-comment').value.trim();
    fullAddress = `${addr}, под. ${ent}, эт. ${flr}, кв. ${apt}, дом. ${intc}` + (comment ? ` [курьеру: ${comment}]` : '');

    if (ordSaveAddrChecked && selectedAddressSuggestion) {
      if (savedAddresses.length < 3) {
        savedAddresses.push({
          label: "Адрес " + (savedAddresses.length + 1),
          address: addr, entrance: ent, floor: flr, apt: apt, intercom: intc,
          lat: selectedAddressSuggestion.data.geo_lat,
          lon: selectedAddressSuggestion.data.geo_lon
        });
        if (typeof syncSavedAddresses === 'function') syncSavedAddresses();
      }
    }
  }

  let recipientInfo = "Заказчик лично";
  if (orderRecipientType === 'other') {
    recipientInfo = `${document.getElementById('ord-rec-name').value.trim()} (${document.getElementById('ord-rec-phone').value.trim()})`;
  }

  const itemsArr = Object.entries(cart || {}).map(([cartKey, qty]) => {
    const [id, selectedUnit, selectedVar, selectedColor] = cartKey.split(':::');
    const it = catalog.find(i => String(i.id) === String(id));
    return {
      id: it.id,
      title: it.title,
      unit: selectedUnit || it.unit || '1 шт.',
      variant: selectedVar || it.variant || '',
      color: selectedColor || it.color || '',
      price: it.price,
      qty: qty,
      in_bouquet: (isAssemblyMode && cartAssemblyItems[cartKey])
    };
  });

  const finalAmount = currentFlowersSubtotal + ((orderDeliveryType === 'delivery') ? currentDeliveryCost : 0);
  const deliveryTime = document.getElementById('selected-time-display').innerText;
  const shopComment = document.getElementById('ord-shop-comment').value.trim();

  const payload = {
    action: "create_order",
    user_id: userId,
    user_name: currentUser.name || "Клиент",
    user_phone: currentUser.phone || "",
    delivery_type: orderDeliveryType,
    recipient_info: recipientInfo,
    address: fullAddress,
    delivery_time: deliveryTime,
    items_json: JSON.stringify(itemsArr),
    total_amount: finalAmount,
    need_assembly: isAssemblyMode,
    shop_comment: shopComment,
    delivery_cost: (orderDeliveryType === 'delivery') ? currentDeliveryCost : 0
  };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      if (typeof clearCartStorage === 'function') clearCartStorage();
      if (typeof updateCartUI === 'function') updateCartUI();
      closeOrderSummaryModal();

      if (isAssemblyMode) {
        document.getElementById('asm-modal-order-id').innerText = result.order_id;
        document.getElementById('assembly-call-modal').classList.add('open');
      } else {
        openPaymentModal(result.order_id, result.total_amount, null);
      }
    } else {
      toast("Ошибка оформления заказа");
    }
  } catch (e) {
    toast("Ошибка связи с сервером");
  }
}
window.submitFinalOrder = submitFinalOrder;

function closeAssemblyModal() {
  triggerHaptic('light');
  document.getElementById('assembly-call-modal').classList.remove('open');
  if (typeof navigateTab === 'function') navigateTab('profile', null);
}
window.closeAssemblyModal = closeAssemblyModal;

function openPaymentModal(orderId, amount, createdAtStr) {
  currentActiveOrderIdForPay = orderId;
  currentActiveOrderAmount = amount;

  document.getElementById('pay-modal-order-id').innerText = `Оплата: ${orderId}`;
  document.getElementById('pay-modal-amount').innerText = `${amount} ₽`;

  const sbpBtn = document.getElementById('pay-sbp-btn');
  if (sbpBtn && SERVER_CONFIG.sbp_url) {
    sbpBtn.href = SERVER_CONFIG.sbp_url;
  }

  const qrImg = document.getElementById('sbp-qr-image-tag');
  if (qrImg && SERVER_CONFIG.sbp_qr) {
    qrImg.src = SERVER_CONFIG.sbp_qr;
  }

  startPaymentTimer(createdAtStr);
  document.getElementById('payment-modal').classList.add('open');
}
window.openPaymentModal = openPaymentModal;

function closePaymentModal() {
  triggerHaptic('light');
  clearInterval(paymentTimerInterval);
  document.getElementById('payment-modal').classList.remove('open');
}
window.closePaymentModal = closePaymentModal;

function copyPaymentAmount() {
  triggerHaptic('selection');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(String(currentActiveOrderAmount));
    toast(`Сумма ${currentActiveOrderAmount} ₽ скопирована!`);
  }
}
window.copyPaymentAmount = copyPaymentAmount;

function startPaymentTimer(createdAtStr) {
  clearInterval(paymentTimerInterval);
  const timerVal = document.getElementById('pay-timer-val');
  const timerBox = document.getElementById('pay-timer-box');

  const nowTs = Date.now();
  const createdTs = createdAtStr ? parseOrderDateToTs(createdAtStr) : nowTs;
  const startTs = createdTs || nowTs;
  const TIMEOUT_SEC = 15 * 60;

  function update() {
    const elapsed = Math.floor((Date.now() - startTs) / 1000);
    const left = TIMEOUT_SEC - elapsed;

    if (left <= 0) {
      clearInterval(paymentTimerInterval);
      if (timerVal) timerVal.innerText = "00:00 (Истекло)";
      if (timerBox) timerBox.style.background = "rgba(220,38,38,0.25)";
      toast("Время ожидания оплаты истекло. Заказ отменен.");
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: "cancel_order_timeout", order_id: currentActiveOrderIdForPay })
      }).catch(() => {});
      closePaymentModal();
      if (typeof loadUserOrders === 'function') loadUserOrders();
      return;
    }

    const m = Math.floor(left / 60);
    const s = left % 60;
    if (timerVal) {
      timerVal.innerText = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    }
  }

  update();
  paymentTimerInterval = setInterval(update, 1000);
}

// Подтверждение оплаты клиентом с открытием модалки поздравления и конфетти
async function confirmPaymentByClient() {
  triggerHaptic('medium');
  toast("Отправка подтверждения...");
  clearInterval(paymentTimerInterval);

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: "client_paid", order_id: currentActiveOrderIdForPay })
    });

    closePaymentModal();

    // Открываем модалку ожидания подтверждения с запуском конфетти
    const succModal = document.getElementById('payment-success-modal');
    if (succModal) succModal.classList.add('open');
    if (typeof startConfettiAnimation === 'function') startConfettiAnimation();

  } catch (e) {
    toast("Ошибка связи");
  }
}
window.confirmPaymentByClient = confirmPaymentByClient;

function closePaymentSuccessModalAndGoOrders() {
  triggerHaptic('selection');
  if (typeof stopConfettiAnimation === 'function') stopConfettiAnimation();
  const succModal = document.getElementById('payment-success-modal');
  if (succModal) succModal.classList.remove('open');

  if (typeof navigateTab === 'function') {
    navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
  }
  if (typeof loadUserOrders === 'function') loadUserOrders();
}
window.closePaymentSuccessModalAndGoOrders = closePaymentSuccessModalAndGoOrders;
