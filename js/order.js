let pendingOrderPayload = null;

function setDeliveryType(type) {
  triggerHaptic('selection');
  currentDeliveryType = type;
  document.getElementById('btn-del').classList.toggle('active', type === 'delivery');
  document.getElementById('btn-pick').classList.toggle('active', type === 'pickup');

  document.getElementById('delivery-extra-fields').style.display = (type === 'delivery') ? 'block' : 'none';
  document.getElementById('pickup-extra-fields').style.display = (type === 'pickup') ? 'block' : 'none';

  if (type === 'pickup') {
    currentDeliveryCost = 0;
  } else {
    recalcDeliveryCost();
  }
  updateOrderFinalValues();
}
window.setDeliveryType = setDeliveryType;

function setRecipientType(type) {
  triggerHaptic('selection');
  currentRecipientType = type;
  document.getElementById('btn-rec-self').classList.toggle('active', type === 'self');
  document.getElementById('btn-rec-other').classList.toggle('active', type === 'other');
  document.getElementById('other-rec-fields').style.display = (type === 'other') ? 'block' : 'none';
}
window.setRecipientType = setRecipientType;

function populateTimeSlots() {
  const optionsBox = document.getElementById('time-select-options');
  const displaySpan = document.getElementById('selected-time-display');
  if (!optionsBox || !displaySpan) return;

  const now = new Date();
  const mskUtc = now.getTime() + (now.getTimezoneOffset() * 60000) + (3 * 3600000);
  const curHour = new Date(mskUtc).getHours();

  // Жесткие интервалы по задаче
  const standardSlots = [
    { start: 10, label: "10:00 – 12:00" },
    { start: 12, label: "12:00 – 14:00" },
    { start: 14, label: "14:00 – 16:00" },
    { start: 16, label: "16:00 – 18:00" },
    { start: 18, label: "18:00 – 20:00" }
  ];

  let availableSlots = [];

  if (curHour < 19) {
    availableSlots.push("Как можно скорее (1-2 часа)");
    standardSlots.forEach(slot => {
      if (curHour < slot.start + 1) {
        availableSlots.push(`Сегодня: ${slot.label}`);
      }
    });
  }

  // Обязательный пункт в самом низу
  availableSlots.push("Другой день (согласовать)");

  optionsBox.innerHTML = availableSlots.map(t => `
    <div class="custom-select-option" onclick="selectTimeSlot('${t}')">${t}</div>
  `).join('');

  selectedDeliveryTime = availableSlots[0];
  displaySpan.innerText = selectedDeliveryTime;
}

function selectTimeSlot(t) {
  triggerHaptic('selection');
  selectedDeliveryTime = t;
  const disp = document.getElementById('selected-time-display');
  if (disp) disp.innerText = t;
  const box = document.getElementById('time-select-box');
  if (box) box.classList.remove('open');
}
window.selectTimeSlot = selectTimeSlot;

function renderOrderSavedAddressPills() {
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
      📍 ${a.label}
    </div>
  `).join('');
}

function applySavedAddressToOrder(idx) {
  triggerHaptic('selection');
  const a = savedAddresses[idx];
  if (!a) return;

  selectedAddressSuggestion = {
    value: a.address,
    data: {
      house: "1",
      geo_lat: a.lat,
      geo_lon: a.lon
    }
  };

  document.getElementById('ord-suggest-input').value = a.address;
  document.getElementById('ord-entrance').value = a.entrance || "";
  document.getElementById('ord-floor').value = a.floor || "";
  document.getElementById('ord-apt').value = a.apt || "";
  document.getElementById('ord-intercom').value = a.intercom || "";

  document.querySelectorAll('.addr-pill').forEach((p, i) => p.classList.toggle('active', i === idx));
  recalcDeliveryCost();
  updateOrderFinalValues();
}
window.applySavedAddressToOrder = applySavedAddressToOrder;

function onAddressInput(query) {
  clearTimeout(suggestDebounceTimer);
  const box = document.getElementById('ord-suggest-list');
  selectedAddressSuggestion = null;

  if (!query || query.trim().length < 2) {
    if (box) box.style.display = 'none';
    currentDeliveryCost = 0;
    updateOrderFinalValues();
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
      window.lastAddressSuggestions = items;
    } catch (e) {}
  }, 250);
}
window.onAddressInput = onAddressInput;

function selectAddressItem(idx) {
  triggerHaptic('selection');
  const s = window.lastAddressSuggestions?.[idx];
  if (!s) return;
  document.getElementById('ord-suggest-input').value = s.value;
  document.getElementById('ord-suggest-list').style.display = 'none';
  selectedAddressSuggestion = s;
  recalcDeliveryCost();
  updateOrderFinalValues();
}
window.selectAddressItem = selectAddressItem;

function recalcDeliveryCost() {
  const badge = document.getElementById('delivery-calc-badge');
  if (currentDeliveryType === 'pickup') {
    currentDeliveryCost = 0;
    if (badge) badge.innerHTML = "📍 Самовывоз: Зеленоград, Георгиевский пр-т, 37к2 (бесплатно)";
    return;
  }

  if (!selectedAddressSuggestion || !selectedAddressSuggestion.data?.geo_lat || !selectedAddressSuggestion.data?.geo_lon) {
    currentDeliveryCost = 350;
    if (badge) badge.innerHTML = "📍 Введите адрес, чтобы рассчитать точную стоимость доставки (от 350 ₽)";
    return;
  }

  const userLat = parseFloat(selectedAddressSuggestion.data.geo_lat);
  const userLon = parseFloat(selectedAddressSuggestion.data.geo_lon);
  const storeLat = parseFloat(SERVER_CONFIG.store_lat || 55.966987);
  const storeLon = parseFloat(SERVER_CONFIG.store_lon || 37.151059);

  const distKm = calcHaversineDistance(storeLat, storeLon, userLat, userLon);

  let cost = 350;
  if (distKm > 2) {
    cost += Math.round((distKm - 2) * 40);
  }
  currentDeliveryCost = cost;

  if (badge) {
    badge.innerHTML = `🚚 Доставка: ~<b>${distKm.toFixed(1)} км</b> от салона — <b>${cost} ₽</b>`;
  }
}

function updateOrderFinalValues() {
  const subtotalEl = document.getElementById('order-subtotal-val');
  const deliveryEl = document.getElementById('order-delivery-val');
  const finalEl = document.getElementById('order-final-val');

  if (subtotalEl) subtotalEl.innerText = `${currentFlowersSubtotal} ₽`;
  if (deliveryEl) deliveryEl.innerText = (currentDeliveryType === 'pickup') ? '0 ₽' : `${currentDeliveryCost} ₽`;
  if (finalEl) finalEl.innerText = `${currentFlowersSubtotal + currentDeliveryCost} ₽`;
}

function openOrderModal() {
  triggerHaptic('medium');
  if (!currentUser) {
    toast("Завершите регистрацию для оформления заказа");
    const regModal = document.getElementById('reg-modal');
    if (regModal) regModal.classList.add('open');
    return;
  }

  const entries = Object.entries(cart || {});
  if (!entries.length) {
    toast("Корзина пуста");
    return;
  }

  setDeliveryType('delivery');
  setRecipientType('self');
  populateTimeSlots();
  renderOrderSavedAddressPills();
  updateOrderFinalValues();

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

// Валидация полей и переход к модалке сводки заказа
function proceedToOrderSummary() {
  triggerHaptic('medium');

  let recInfo = "Заказчик лично";
  if (currentRecipientType === 'other') {
    const oName = document.getElementById('ord-rec-name').value.trim();
    const oPhone = document.getElementById('ord-rec-phone').value.trim();
    if (!oName || oPhone.length < 17) {
      toast("Укажите имя и телефон получателя полностью: 8 (***) ***-**-**");
      return;
    }
    recInfo = `${oName} (${oPhone})`;
  }

  let finalAddressStr = "Самовывоз: Георгиевский пр-т, 37к2";
  if (currentDeliveryType === 'delivery') {
    const rawAddr = document.getElementById('ord-suggest-input').value.trim();
    const ent = document.getElementById('ord-entrance').value.trim();
    const flr = document.getElementById('ord-floor').value.trim();
    const apt = document.getElementById('ord-apt').value.trim();
    const intc = document.getElementById('ord-intercom').value.trim();
    const comm = document.getElementById('ord-comment').value.trim();

    if (!rawAddr) {
      toast("Укажите улицу и номер дома");
      return;
    }
    if (!selectedAddressSuggestion || !selectedAddressSuggestion.data?.house) {
      toast("Выберите точный адрес с номером дома из подсказок DaData");
      return;
    }
    if (!ent || !flr || !apt || !intc) {
      toast("Заполните все поля: подъезд, этаж, квартиру и домофон");
      return;
    }

    finalAddressStr = `${rawAddr}, под. ${ent}, эт. ${flr}, кв. ${apt}, дом. ${intc}${comm ? ` [курьеру: ${comm}]` : ''}`;

    if (ordSaveAddrChecked && !savedAddresses.some(a => a.address === rawAddr)) {
      if (savedAddresses.length < 3) {
        savedAddresses.push({
          label: "Адрес " + (savedAddresses.length + 1),
          address: rawAddr,
          entrance: ent,
          floor: flr,
          apt: apt,
          intercom: intc,
          lat: selectedAddressSuggestion.data.geo_lat,
          lon: selectedAddressSuggestion.data.geo_lon
        });
        if (typeof syncSavedAddresses === 'function') syncSavedAddresses();
      }
    }
  }

  const itemsList = [];
  Object.entries(cart || {}).forEach(([cartKey, qty]) => {
    const [id, selectedUnit, selectedVar, selectedColor] = cartKey.split(':::');
    const item = catalog.find(i => String(i.id) === String(id));
    if (item) {
      itemsList.push({
        id: item.id,
        title: item.title,
        unit: selectedUnit || item.unit,
        variant: selectedVar || item.variant,
        color: selectedColor || item.color,
        price: item.price,
        qty: qty,
        in_bouquet: isAssemblyMode && !!cartAssemblyItems[cartKey]
      });
    }
  });

  const totalAmount = currentFlowersSubtotal + currentDeliveryCost;
  const shopComment = document.getElementById('ord-shop-comment').value.trim();

  // Сохраняем подготовленный пэйлоад
  pendingOrderPayload = {
    action: "create_order",
    user_id: userId,
    user_name: currentUser.name || "Клиент",
    user_phone: currentUser.phone || "",
    delivery_type: currentDeliveryType,
    recipient_info: recInfo,
    address: finalAddressStr,
    delivery_time: selectedDeliveryTime,
    shop_comment: shopComment,
    delivery_cost: currentDeliveryCost,
    total_amount: totalAmount,
    items_json: JSON.stringify(itemsList),
    need_assembly: isAssemblyMode
  };

  // Отрисовываем сводку в `#order-summary-modal`
  document.getElementById('summary-del-type').innerText = (currentDeliveryType === 'delivery') ? '🚚 Доставка курьером' : '📍 Самовывоз из салона';
  document.getElementById('summary-address-val').innerText = finalAddressStr;
  document.getElementById('summary-time-val').innerText = selectedDeliveryTime;
  document.getElementById('summary-recipient-val').innerText = recInfo;

  const itemsBox = document.getElementById('summary-items-list');
  itemsBox.innerHTML = itemsList.map(it => {
    const fullT = formatFullItemTitle(it.title, it.unit, it.variant, it.color);
    const bqTag = it.in_bouquet ? ' <span style="color:var(--gold); font-weight:800;">[в букет]</span>' : '';
    return `<div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px;">
      <span style="color:var(--text);">${fullT}${bqTag} × ${it.qty}</span>
      <b style="color:var(--text);">${it.price * it.qty} ₽</b>
    </div>`;
  }).join('');

  document.getElementById('summary-subtotal-val').innerText = `${currentFlowersSubtotal} ₽`;
  document.getElementById('summary-delivery-cost-val').innerText = `${currentDeliveryCost} ₽`;
  document.getElementById('summary-total-amount-val').innerText = `${totalAmount} ₽`;

  closeOrderModal();
  document.getElementById('order-summary-modal').classList.add('open');
}
window.proceedToOrderSummary = proceedToOrderSummary;

function closeOrderSummaryModal() {
  triggerHaptic('light');
  document.getElementById('order-summary-modal').classList.remove('open');
}
window.closeOrderSummaryModal = closeOrderSummaryModal;

async function confirmAndSubmitFinalOrder() {
  if (!pendingOrderPayload) return;
  triggerHaptic('medium');
  toast("Создание заказа...");

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(pendingOrderPayload)
    });
    const data = await res.json();

    if (data.success) {
      currentPaymentOrderId = data.order_id;
      currentPaymentAmount = data.total_amount;
      closeOrderSummaryModal();
      clearCartStorage();
      if (typeof updateCartUI === 'function') updateCartUI();

      if (pendingOrderPayload.need_assembly) {
        document.getElementById('asm-modal-order-id').innerText = data.order_id;
        document.getElementById('assembly-call-modal').classList.add('open');
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
window.confirmAndSubmitFinalOrder = confirmAndSubmitFinalOrder;

function closeAssemblyModal() {
  triggerHaptic('light');
  document.getElementById('assembly-call-modal').classList.remove('open');
  navigateTab('profile', null);
}
window.closeAssemblyModal = closeAssemblyModal;

function openPaymentModal(orderId, amount, orderCreatedAt = null) {
  triggerHaptic('medium');
  currentPaymentOrderId = orderId;
  currentPaymentAmount = amount;

  document.getElementById('pay-modal-order-id').innerText = `Оплата ${orderId}`;
  document.getElementById('pay-modal-amount').innerText = `${amount} ₽`;

  const sbpBtn = document.getElementById('pay-sbp-btn');
  if (sbpBtn && SERVER_CONFIG.sbp_url) {
    sbpBtn.href = SERVER_CONFIG.sbp_url;
  }

  const qrImg = document.getElementById('sbp-qr-image-tag');
  if (qrImg && SERVER_CONFIG.sbp_qr) {
    qrImg.src = SERVER_CONFIG.sbp_qr;
  }

  startPaymentTimer(orderCreatedAt);
  document.getElementById('payment-modal').classList.add('open');
}
window.openPaymentModal = openPaymentModal;

function closePaymentModal() {
  triggerHaptic('light');
  clearInterval(paymentTimerInterval);
  document.getElementById('payment-modal').classList.remove('open');
}
window.closePaymentModal = closePaymentModal;

function startPaymentTimer(createdDateTimeStr) {
  clearInterval(paymentTimerInterval);
  const timerVal = document.getElementById('pay-timer-val');
  if (!timerVal) return;

  const nowTs = Date.now();
  const createdTs = createdDateTimeStr ? parseOrderDateToTs(createdDateTimeStr) : nowTs;
  const elapsedSec = Math.floor((nowTs - createdTs) / 1000);
  let leftSec = (15 * 60) - elapsedSec;

  if (leftSec <= 0) {
    timerVal.innerText = "00:00";
    closePaymentModal();
    toast("Время оплаты заказа истекло");
    return;
  }

  function update() {
    if (leftSec <= 0) {
      clearInterval(paymentTimerInterval);
      timerVal.innerText = "00:00";
      closePaymentModal();
      toast("Время оплаты заказа истекло");
      return;
    }
    const m = Math.floor(leftSec / 60);
    const s = leftSec % 60;
    timerVal.innerText = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    leftSec--;
  }

  update();
  paymentTimerInterval = setInterval(update, 1000);
}

function copyPaymentAmount() {
  triggerHaptic('selection');
  if (!currentPaymentAmount) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(String(currentPaymentAmount));
    toast("Сумма скопирована в буфер!");
  }
}
window.copyPaymentAmount = copyPaymentAmount;

async function confirmPaymentByClient() {
  if (!currentPaymentOrderId) return;
  triggerHaptic('medium');
  toast("Отправка подтверждения...");

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: "client_paid", order_id: currentPaymentOrderId })
    });
    const d = await res.json();
    if (d.success) {
      closePaymentModal();

      // Открываем модалку подтверждения и запускаем праздничный салют конфетти
      document.getElementById('success-modal-order-id').innerText = `Заказ: ${currentPaymentOrderId}`;
      document.getElementById('payment-success-modal').classList.add('open');
      if (typeof launchConfettiShower === 'function') {
        launchConfettiShower();
      }
    }
  } catch (e) {
    toast("Ошибка связи");
  }
}
window.confirmPaymentByClient = confirmPaymentByClient;

function closePaymentSuccessModal() {
  triggerHaptic('light');
  document.getElementById('payment-success-modal').classList.remove('open');
}
window.closePaymentSuccessModal = closePaymentSuccessModal;

function closePaymentSuccessModalAndGoOrders() {
  closePaymentSuccessModal();
  navigateTab('profile', null);
}
window.closePaymentSuccessModalAndGoOrders = closePaymentSuccessModalAndGoOrders;
