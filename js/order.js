let orderRecipientType = 'self';

function setDeliveryType(type) {
  triggerHaptic('selection');
  deliveryType = type;
  const btnDel = document.getElementById('btn-del');
  const btnPick = document.getElementById('btn-pick');
  const delExtra = document.getElementById('delivery-extra-fields');
  const pickExtra = document.getElementById('pickup-extra-fields');

  if (type === 'delivery') {
    btnDel.classList.add('active');
    btnPick.classList.remove('active');
    delExtra.style.display = 'block';
    pickExtra.style.display = 'none';
  } else {
    btnPick.classList.add('active');
    btnDel.classList.remove('active');
    delExtra.style.display = 'none';
    pickExtra.style.display = 'block';
    calculatedDeliveryCost = 0;
  }
  updateOrderModalTotals();
}
window.setDeliveryType = setDeliveryType;

function setRecipientType(type) {
  triggerHaptic('selection');
  orderRecipientType = type;
  const btnSelf = document.getElementById('btn-rec-self');
  const btnOther = document.getElementById('btn-rec-other');
  const otherFields = document.getElementById('other-rec-fields');

  if (type === 'self') {
    btnSelf.classList.add('active');
    btnOther.classList.remove('active');
    otherFields.style.display = 'none';
  } else {
    btnOther.classList.add('active');
    btnSelf.classList.remove('active');
    otherFields.style.display = 'block';
  }
}
window.setRecipientType = setRecipientType;

function renderOrderDeliveryTimes() {
  const optionsBox = document.getElementById('time-select-options');
  const displaySpan = document.getElementById('selected-time-display');
  if (!optionsBox) return;

  const mskFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    hour: 'numeric',
    hour12: false
  });
  const currentMskHour = parseInt(mskFormatter.format(new Date()), 10);

  const times = [];

  // "Как можно скорее (1-2 часа)" доступно строго до 18:00
  if (currentMskHour < 18) {
    times.push("Как можно скорее (1-2 часа)");
  }

  // Слоты на Сегодня (доступны только будущие интервалы)
  if (currentMskHour < 10) times.push("Сегодня: 10-12 ч.");
  if (currentMskHour < 12) times.push("Сегодня: 12-14 ч.");
  if (currentMskHour < 14) times.push("Сегодня: 14-16 ч.");
  if (currentMskHour < 16) times.push("Сегодня: 16-18 ч.");
  if (currentMskHour < 18) times.push("Сегодня: 18-20 ч.");

  // Слоты на Завтра
  times.push("Завтра: 10-12 ч.");
  times.push("Завтра: 12-14 ч.");
  times.push("Завтра: 14-16 ч.");
  times.push("Завтра: 16-18 ч.");
  times.push("Завтра: 18-20 ч.");

  // Согласование на другой день
  times.push("Другой день: согласовать");

  selectedDeliveryTimeValue = times[0];
  if (displaySpan) displaySpan.innerText = selectedDeliveryTimeValue;

  optionsBox.innerHTML = times.map(t => `
    <div class="custom-select-option" onclick="selectOrderDeliveryTime('${t}')">${t}</div>
  `).join('');
}

function selectOrderDeliveryTime(val) {
  triggerHaptic('selection');
  selectedDeliveryTimeValue = val;
  const disp = document.getElementById('selected-time-display');
  if (disp) disp.innerText = val;
  const box = document.getElementById('time-select-box');
  if (box) box.classList.remove('open');
}
window.selectOrderDeliveryTime = selectOrderDeliveryTime;

function openOrderModal() {
  triggerHaptic('selection');
  const count = Object.values(cart || {}).reduce((a, b) => a + b, 0);
  if (count <= 0) {
    toast("Корзина пуста");
    return;
  }

  setDeliveryType('delivery');
  setRecipientType('self');
  renderOrderDeliveryTimes();

  const savedBox = document.getElementById('order-saved-address-container');
  const pillsBox = document.getElementById('order-saved-address-pills');
  if (savedAddresses && savedAddresses.length > 0) {
    pillsBox.innerHTML = savedAddresses.map((a, idx) => `
      <div class="addr-pill" onclick="applySavedAddressToOrder(${idx}, this)">${a.label}</div>
    `).join('');
    savedBox.style.display = 'block';
  } else {
    savedBox.style.display = 'none';
  }

  document.getElementById('ord-suggest-input').value = "";
  document.getElementById('ord-entrance').value = "";
  document.getElementById('ord-floor').value = "";
  document.getElementById('ord-apt').value = "";
  document.getElementById('ord-intercom').value = "";
  document.getElementById('ord-comment').value = "";
  document.getElementById('ord-shop-comment').value = "";

  selectedAddressSuggestion = null;
  calculatedDeliveryCost = 0;
  ordSaveAddrChecked = false;
  const saveChk = document.getElementById('ord-save-addr-checkbox-ui');
  if (saveChk) { saveChk.classList.remove('checked'); saveChk.innerText = ''; }

  const badge = document.getElementById('delivery-calc-badge');
  if (badge) {
    badge.innerText = "📍 Введите адрес, чтобы рассчитать точную стоимость доставки (от 350 ₽)";
    badge.style.color = "var(--gold)";
  }

  updateOrderModalTotals();
  document.getElementById('order-modal').classList.add('open');
}
window.openOrderModal = openOrderModal;

function closeOrderModal() {
  triggerHaptic('light');
  document.getElementById('order-modal').classList.remove('open');
}
window.closeOrderModal = closeOrderModal;

function applySavedAddressToOrder(idx, pillEl) {
  triggerHaptic('selection');
  document.querySelectorAll('#order-saved-address-pills .addr-pill').forEach(p => p.classList.remove('active'));
  if (pillEl) pillEl.classList.add('active');

  const a = savedAddresses[idx];
  if (!a) return;

  document.getElementById('ord-suggest-input').value = a.address;
  document.getElementById('ord-entrance').value = a.entrance || "";
  document.getElementById('ord-floor').value = a.floor || "";
  document.getElementById('ord-apt').value = a.apt || "";
  document.getElementById('ord-intercom').value = a.intercom || "";

  selectedAddressSuggestion = {
    value: a.address,
    data: { house: "1", geo_lat: a.lat, geo_lon: a.lon }
  };

  calculateDeliveryFee(a.lat, a.lon);
}
window.applySavedAddressToOrder = applySavedAddressToOrder;

function onAddressInput(query) {
  clearTimeout(suggestDebounceTimer);
  const box = document.getElementById('ord-suggest-list');
  selectedAddressSuggestion = null;
  calculatedDeliveryCost = 0;
  updateOrderModalTotals();

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

  if (s.data && s.data.geo_lat && s.data.geo_lon) {
    calculateDeliveryFee(s.data.geo_lat, s.data.geo_lon);
  }
}
window.selectAddressItem = selectAddressItem;

function calculateDeliveryFee(destLat, destLon) {
  const storeLat = SERVER_CONFIG.store_lat || 55.966987;
  const storeLon = SERVER_CONFIG.store_lon || 37.151059;

  const distKm = calcHaversineDistance(storeLat, storeLon, parseFloat(destLat), parseFloat(destLon));
  let cost = 350;

  if (distKm > 2) {
    cost = 350 + Math.ceil(distKm - 2) * 40;
  }

  calculatedDeliveryCost = cost;
  updateOrderModalTotals();

  const badge = document.getElementById('delivery-calc-badge');
  if (badge) {
    badge.innerText = `🚗 Расстояние: ~${distKm.toFixed(1)} км. Доставка: ${cost} ₽`;
    badge.style.color = "var(--green)";
  }
}

function updateOrderModalTotals() {
  const subtotalEl = document.getElementById('order-subtotal-val');
  const delivEl = document.getElementById('order-delivery-val');
  const finalEl = document.getElementById('order-final-val');

  if (subtotalEl) subtotalEl.innerText = `${currentFlowersSubtotal} ₽`;
  if (delivEl) delivEl.innerText = `${deliveryType === 'delivery' ? calculatedDeliveryCost : 0} ₽`;

  const total = currentFlowersSubtotal + (deliveryType === 'delivery' ? calculatedDeliveryCost : 0);
  if (finalEl) finalEl.innerText = `${total} ₽`;
}

async function submitFinalOrder() {
  triggerHaptic('medium');

  if (!currentUser) {
    toast("Пройдите быструю регистрацию");
    return;
  }

  const shopCommentVal = document.getElementById('ord-shop-comment').value.trim();
  let fullAddress = "";

  if (deliveryType === 'delivery') {
    const addrInput = document.getElementById('ord-suggest-input').value.trim();
    const ent = document.getElementById('ord-entrance').value.trim();
    const flr = document.getElementById('ord-floor').value.trim();
    const apt = document.getElementById('ord-apt').value.trim();
    const intc = document.getElementById('ord-intercom').value.trim();
    const courierComment = document.getElementById('ord-comment').value.trim();

    if (!addrInput) { toast("Укажите улицу и дом"); return; }
    if (!selectedAddressSuggestion || !selectedAddressSuggestion.data?.house) {
      toast("Выберите точный адрес с номером дома из подсказок DaData");
      return;
    }
    if (!ent || !flr || !apt || !intc) {
      toast("Заполните подъезд, этаж, квартиру и домофон");
      return;
    }

    fullAddress = `${addrInput}, под. ${ent}, эт. ${flr}, кв. ${apt}, дом. ${intc}`;
    if (courierComment) fullAddress += ` [курьеру: ${courierComment}]`;

    if (ordSaveAddrChecked) {
      const alreadySaved = savedAddresses.some(a => a.address === addrInput && a.apt === apt);
      if (!alreadySaved && savedAddresses.length < 3) {
        savedAddresses.push({
          label: `Адрес ${savedAddresses.length + 1}`,
          address: addrInput,
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
  } else {
    fullAddress = "Самовывоз: Зеленоград, Георгиевский пр-т, 37к2";
  }

  let recipientText = "Заказчик лично";
  if (orderRecipientType === 'other') {
    const rName = document.getElementById('ord-rec-name').value.trim();
    const rPhone = document.getElementById('ord-rec-phone').value.trim();
    if (!rName || rPhone.length < 17) {
      toast("Заполните имя и номер телефона получателя полностью: 8 (***) ***-**-**");
      return;
    }
    recipientText = `${rName} (${rPhone})`;
  }

  const itemsPayload = Object.entries(cart || {}).map(([key, qty]) => {
    const [itemId, selectedUnit, selectedVar, selectedColor] = key.split(':::');
    const catalogItem = catalog.find(i => String(i.id) === String(itemId));
    return {
      id: itemId,
      title: catalogItem ? catalogItem.title : "Цветы",
      unit: selectedUnit || (catalogItem ? catalogItem.unit : "1 шт."),
      variant: selectedVar || "",
      color: selectedColor || "",
      price: catalogItem ? catalogItem.price : 0,
      qty: qty,
      in_bouquet: !!cartAssemblyItems[key]
    };
  });

  const finalTotal = currentFlowersSubtotal + (deliveryType === 'delivery' ? calculatedDeliveryCost : 0);

  toast("Оформление заказа...");
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: "create_order",
        user_id: userId,
        user_name: currentUser.name,
        user_phone: currentUser.phone,
        delivery_type: deliveryType,
        recipient_info: recipientText,
        address: fullAddress,
        delivery_time: selectedDeliveryTimeValue,
        shop_comment: shopCommentVal,
        delivery_cost: deliveryType === 'delivery' ? calculatedDeliveryCost : 0,
        items_json: JSON.stringify(itemsPayload),
        total_amount: finalTotal,
        need_assembly: isAssemblyMode
      })
    });

    const data = await res.json();
    if (data.success) {
      closeOrderModal();
      clearCartStorage();
      if (typeof updateCartUI === 'function') updateCartUI();

      if (isAssemblyMode) {
        openAssemblyModal(data.order_id);
      } else {
        openPaymentModal(data.order_id, data.total_amount, new Date().toISOString());
      }
    } else {
      toast(data.error || "Ошибка оформления");
    }
  } catch (err) {
    toast("Ошибка связи с сервером");
  }
}
window.submitFinalOrder = submitFinalOrder;

function openAssemblyModal(orderId) {
  triggerHaptic('medium');
  document.getElementById('asm-modal-order-id').innerText = orderId;
  document.getElementById('assembly-call-modal').classList.add('open');
}

function closeAssemblyModal() {
  triggerHaptic('light');
  document.getElementById('assembly-call-modal').classList.remove('open');
  navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
}
window.closeAssemblyModal = closeAssemblyModal;

function openPaymentModal(orderId, amount, createdAtStr) {
  triggerHaptic('medium');
  currentPaymentOrderId = orderId;
  currentPaymentAmount = amount;

  document.getElementById('pay-modal-order-id').innerText = `Заказ: ${orderId}`;
  document.getElementById('pay-modal-amount').innerText = `${amount} ₽`;

  startPaymentTimer(createdAtStr);
  document.getElementById('payment-modal').classList.add('open');
}
window.openPaymentModal = openPaymentModal;

function closePaymentModal() {
  triggerHaptic('light');
  clearInterval(paymentTimerInterval);
  document.getElementById('payment-modal').classList.remove('open');
  navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
}
window.closePaymentModal = closePaymentModal;

function startPaymentTimer(createdAtStr) {
  clearInterval(paymentTimerInterval);
  const timerValEl = document.getElementById('pay-timer-val');
  const timerBoxEl = document.getElementById('pay-timer-box');

  const createdTs = parseOrderDateToTs(createdAtStr) || Date.now();
  const expiresTs = createdTs + (15 * 60 * 1000);

  function update() {
    const leftSec = Math.max(0, Math.floor((expiresTs - Date.now()) / 1000));
    const m = Math.floor(leftSec / 60);
    const s = leftSec % 60;
    if (timerValEl) timerValEl.innerText = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;

    if (leftSec <= 0) {
      clearInterval(paymentTimerInterval);
      if (timerBoxEl) timerBoxEl.innerText = "⏳ Время на оплату истекло. Заказ отменен.";
      toast("Время оплаты заказа истекло");
    }
  }
  update();
  paymentTimerInterval = setInterval(update, 1000);
}

function copyPaymentAmount() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(String(currentPaymentAmount));
    toast("Сумма скопирована!");
  }
}
window.copyPaymentAmount = copyPaymentAmount;

async function confirmPaymentByClient() {
  if (!currentPaymentOrderId) return;
  triggerHaptic('medium');
  toast("Уведомляем салон...");

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: "client_paid",
        order_id: currentPaymentOrderId
      })
    });
    toast("Платеж отправлен на проверку флористу!");
    closePaymentModal();
  } catch (e) {
    toast("Ошибка подтверждения");
  }
}
window.confirmPaymentByClient = confirmPaymentByClient;
