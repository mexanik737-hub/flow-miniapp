let currentDeliveryType = 'delivery';
let currentRecipientType = 'self';
let calculatedDeliveryCost = 0;
let isDeliveryCostCalculated = false;
let selectedAddressCoords = null;
let selectedDeliveryTimeValue = "";
let payTimerInterval = null;

// Генерация точных интервалов времени доставки
function generateDeliveryTimeOptions() {
  const optionsBox = document.getElementById('time-select-options');
  const displaySpan = document.getElementById('selected-time-display');
  if (!optionsBox) return;

  const now = new Date();
  const mskFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    hour: 'numeric',
    hour12: false
  });
  const curHour = parseInt(mskFormatter.format(now), 10);

  const slots = [];

  // "Как можно скорее (1-2 часа)" доступно строго в рабочее время приема доставок (10:00 - 19:00 МСК)
  if (curHour >= 10 && curHour < 19) {
    slots.push({ value: "Как можно скорее (1-2 часа)", label: "Как можно скорее (1-2 часа)" });
  }

  // Слоты на Сегодня (с отсечкой прошедших)
  const todayTimelines = [
    { start: 10, label: "Сегодня 10-12" },
    { start: 12, label: "Сегодня 12-14" },
    { start: 14, label: "Сегодня 14-16" },
    { start: 16, label: "Сегодня 16-18" },
    { start: 18, label: "Сегодня 18-20" }
  ];

  todayTimelines.forEach(t => {
    if (curHour < t.start) {
      slots.push({ value: t.label, label: t.label });
    }
  });

  // Слоты на Завтра
  const tomorrowTimelines = [
    "Завтра 10-12",
    "Завтра 12-14",
    "Завтра 14-16",
    "Завтра 16-18",
    "Завтра 18-20"
  ];
  tomorrowTimelines.forEach(lbl => {
    slots.push({ value: lbl, label: lbl });
  });

  // Согласование на другой день
  slots.push({ value: "Другой день (согласовать)", label: "Другой день (согласовать)" });

  optionsBox.innerHTML = slots.map(s => `
    <div class="custom-select-option" onclick="selectDeliveryTimeOption('${s.value}')">
      ${s.label}
    </div>
  `).join('');

  if (slots.length > 0) {
    selectedDeliveryTimeValue = slots[0].value;
    if (displaySpan) displaySpan.innerText = slots[0].label;
  }
}

function selectDeliveryTimeOption(val) {
  triggerHaptic('selection');
  selectedDeliveryTimeValue = val;
  const displaySpan = document.getElementById('selected-time-display');
  if (displaySpan) displaySpan.innerText = val;
  const box = document.getElementById('time-select-box');
  if (box) box.classList.remove('open');
}
window.selectDeliveryTimeOption = selectDeliveryTimeOption;

function openOrderModal() {
  triggerHaptic('selection');
  const count = Object.values(cart || {}).reduce((a, b) => a + b, 0);
  if (count <= 0) {
    toast("Корзина пуста");
    return;
  }

  generateDeliveryTimeOptions();
  renderOrderSavedAddressesPills();
  setDeliveryType(currentDeliveryType);
  setRecipientType(currentRecipientType);
  recalcOrderTotals();

  document.getElementById('order-modal').classList.add('open');
}
window.openOrderModal = openOrderModal;

function closeOrderModal() {
  triggerHaptic('light');
  document.getElementById('order-modal').classList.remove('open');
}
window.closeOrderModal = closeOrderModal;

function setDeliveryType(type) {
  triggerHaptic('selection');
  currentDeliveryType = type;
  document.getElementById('btn-del').classList.toggle('active', type === 'delivery');
  document.getElementById('btn-pick').classList.toggle('active', type === 'pickup');

  const delFields = document.getElementById('delivery-extra-fields');
  const pickFields = document.getElementById('pickup-extra-fields');

  if (type === 'delivery') {
    if (delFields) delFields.style.display = 'block';
    if (pickFields) pickFields.style.display = 'none';
  } else {
    if (delFields) delFields.style.display = 'none';
    if (pickFields) pickFields.style.display = 'block';
    calculatedDeliveryCost = 0;
    isDeliveryCostCalculated = true;
  }
  recalcOrderTotals();
}
window.setDeliveryType = setDeliveryType;

function setRecipientType(type) {
  triggerHaptic('selection');
  currentRecipientType = type;
  document.getElementById('btn-rec-self').classList.toggle('active', type === 'self');
  document.getElementById('btn-rec-other').classList.toggle('active', type === 'other');

  const otherFields = document.getElementById('other-rec-fields');
  if (otherFields) {
    otherFields.style.display = type === 'other' ? 'block' : 'none';
  }
}
window.setRecipientType = setRecipientType;

function renderOrderSavedAddressesPills() {
  const container = document.getElementById('order-saved-address-container');
  const pillsBox = document.getElementById('order-saved-address-pills');
  if (!container || !pillsBox) return;

  if (!savedAddresses || !savedAddresses.length) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  pillsBox.innerHTML = savedAddresses.map((a, idx) => `
    <div class="addr-pill" onclick="selectOrderSavedAddress(${idx})">${a.label}: ${a.address}</div>
  `).join('');
}

function selectOrderSavedAddress(idx) {
  triggerHaptic('selection');
  const a = savedAddresses[idx];
  if (!a) return;

  document.querySelectorAll('#order-saved-address-pills .addr-pill').forEach((p, i) => {
    p.classList.toggle('active', i === idx);
  });

  const input = document.getElementById('ord-suggest-input');
  if (input) input.value = a.address;
  document.getElementById('ord-entrance').value = a.entrance || "";
  document.getElementById('ord-floor').value = a.floor || "";
  document.getElementById('ord-apt').value = a.apt || "";
  document.getElementById('ord-intercom').value = a.intercom || "";

  if (a.lat && a.lon) {
    selectedAddressCoords = { lat: a.lat, lon: a.lon };
    calcDeliveryCost(a.lat, a.lon);
  }
}
window.selectOrderSavedAddress = selectOrderSavedAddress;

function onAddressInput(query) {
  clearTimeout(suggestDebounceTimer);
  const list = document.getElementById('ord-suggest-list');
  selectedAddressCoords = null;
  isDeliveryCostCalculated = false;

  const badge = document.getElementById('delivery-calc-badge');
  if (badge) {
    badge.innerHTML = "📍 Введите адрес, чтобы рассчитать точную стоимость доставки (от 350 ₽)";
    badge.style.color = "var(--gold)";
  }

  if (!query || query.trim().length < 2) {
    if (list) list.style.display = 'none';
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
      if (!items.length) { if (list) list.style.display = 'none'; return; }

      if (list) {
        list.innerHTML = items.map((s, idx) => `
          <div class="suggest-item" onclick="selectAddressSuggestion(${idx})">${s.value}</div>
        `).join('');
        list.style.display = 'block';
      }
      window.orderAddressSuggestions = items;
    } catch (e) {}
  }, 250);
}
window.onAddressInput = onAddressInput;

function selectAddressSuggestion(idx) {
  triggerHaptic('selection');
  const s = window.orderAddressSuggestions?.[idx];
  if (!s) return;

  const input = document.getElementById('ord-suggest-input');
  if (input) input.value = s.value;
  document.getElementById('ord-suggest-list').style.display = 'none';

  if (!s.data?.house) {
    toast("Укажите номер дома или строения");
    return;
  }

  if (s.data?.geo_lat && s.data?.geo_lon) {
    selectedAddressCoords = { lat: parseFloat(s.data.geo_lat), lon: parseFloat(s.data.geo_lon) };
    calcDeliveryCost(selectedAddressCoords.lat, selectedAddressCoords.lon);
  }
}
window.selectAddressSuggestion = selectAddressSuggestion;

function calcDeliveryCost(lat, lon) {
  const storeLat = SERVER_CONFIG.store_lat || 55.966987;
  const storeLon = SERVER_CONFIG.store_lon || 37.151059;

  const distKm = calcHaversineDistance(storeLat, storeLon, lat, lon);
  let cost = 350;

  if (distKm > 2) {
    cost = 350 + Math.ceil(distKm - 2) * 40;
  }

  calculatedDeliveryCost = cost;
  isDeliveryCostCalculated = true;

  const badge = document.getElementById('delivery-calc-badge');
  if (badge) {
    badge.innerHTML = `🚚 Расстояние: ~${distKm.toFixed(1)} км · Доставка: <b>${cost} ₽</b>`;
    badge.style.color = "var(--green)";
  }

  recalcOrderTotals();
}

function recalcOrderTotals() {
  const subtotalEl = document.getElementById('order-subtotal-val');
  const delivEl = document.getElementById('order-delivery-val');
  const finalEl = document.getElementById('order-final-val');

  const flowersTotal = currentFlowersSubtotal || 0;
  const delCost = currentDeliveryType === 'delivery' ? calculatedDeliveryCost : 0;
  const finalAmount = flowersTotal + delCost;

  if (subtotalEl) subtotalEl.innerText = `${flowersTotal} ₽`;
  if (delivEl) delivEl.innerText = `${delCost} ₽`;
  if (finalEl) finalEl.innerText = `${finalAmount} ₽`;
}

async function submitFinalOrder() {
  triggerHaptic('medium');
  if (!currentUser) {
    document.getElementById('reg-modal').classList.add('open');
    toast("Заполните контактные данные");
    return;
  }

  const isDelivery = (currentDeliveryType === 'delivery');
  let finalAddress = "Самовывоз: Георгиевский пр-т, 37к2";
  let fullAddrObj = null;

  if (isDelivery) {
    const street = document.getElementById('ord-suggest-input').value.trim();
    const ent = document.getElementById('ord-entrance').value.trim();
    const flr = document.getElementById('ord-floor').value.trim();
    const apt = document.getElementById('ord-apt').value.trim();
    const intc = document.getElementById('ord-intercom').value.trim();
    const comm = document.getElementById('ord-comment').value.trim();

    if (!street || !selectedAddressCoords || !isDeliveryCostCalculated) {
      toast("Выберите точный адрес дома из подсказок для расчета доставки");
      return;
    }
    if (!ent || !flr || !apt || !intc) {
      toast("Заполните подъезд, этаж, квартиру и домофон");
      return;
    }

    finalAddress = `${street}, под. ${ent}, эт. ${flr}, кв. ${apt}, дом. ${intc}`;
    if (comm) finalAddress += ` [курьеру: ${comm}]`;

    fullAddrObj = {
      label: "Заказ",
      address: street,
      entrance: ent,
      floor: flr,
      apt: apt,
      intercom: intc,
      lat: selectedAddressCoords.lat,
      lon: selectedAddressCoords.lon
    };

    if (ordSaveAddrChecked && savedAddresses.length < 3) {
      const alreadyHas = savedAddresses.some(a => a.address === street);
      if (!alreadyHas) {
        savedAddresses.push(fullAddrObj);
        localStorage.setItem('flw_saved_addresses', JSON.stringify(savedAddresses));
        if (typeof syncSavedAddresses === 'function') syncSavedAddresses();
      }
    }
  }

  let recipientInfo = "Заказчик лично";
  if (currentRecipientType === 'other') {
    const rName = document.getElementById('ord-rec-name').value.trim();
    const rPhone = document.getElementById('ord-rec-phone').value.trim();
    if (!rName || rPhone.length < 17) {
      toast("Заполните имя и номер телефона получателя");
      return;
    }
    recipientInfo = `${rName} (${rPhone})`;
  }

  const itemsPayload = Object.entries(cart || {}).map(([key, qty]) => {
    const [id, selectedUnit, selectedVar, selectedColor] = key.split(':::');
    const item = catalog.find(i => String(i.id) === String(id));
    return {
      id: id,
      title: item ? item.title : "Цветы",
      unit: selectedUnit || (item ? item.unit : "1 шт."),
      variant: selectedVar || "",
      color: selectedColor || "",
      price: item ? item.price : 0,
      qty: qty,
      in_bouquet: isAssemblyMode && !!cartAssemblyItems[key]
    };
  });

  const flowersTotal = currentFlowersSubtotal || 0;
  const deliveryCostNum = isDelivery ? calculatedDeliveryCost : 0;
  const finalTotalAmount = flowersTotal + deliveryCostNum;
  const shopCommentVal = document.getElementById('ord-shop-comment').value.trim();

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
        delivery_type: currentDeliveryType,
        recipient_info: recipientInfo,
        address: finalAddress,
        delivery_time: selectedDeliveryTimeValue || "Как можно скорее (1-2 часа)",
        shop_comment: shopCommentVal,
        delivery_cost: deliveryCostNum,
        total_amount: finalTotalAmount,
        need_assembly: isAssemblyMode,
        items_json: JSON.stringify(itemsPayload)
      })
    });

    const data = await res.json();
    if (data.success) {
      closeOrderModal();
      clearCartStorage();
      if (typeof updateCartUI === 'function') updateCartUI();

      if (isAssemblyMode) {
        document.getElementById('asm-modal-order-id').innerText = data.order_id;
        document.getElementById('assembly-call-modal').classList.add('open');
      } else {
        openPaymentModal(data.order_id, data.total_amount, UtilitiesFormatNowClient());
      }
    } else {
      toast("Ошибка создания заказа");
    }
  } catch (err) {
    toast("Ошибка связи с сервером");
  }
}
window.submitFinalOrder = submitFinalOrder;

function UtilitiesFormatNowClient() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function openPaymentModal(orderId, amount, orderDateStr) {
  triggerHaptic('selection');
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

  const createdTs = parseOrderDateToTs(orderDateStr) || Date.now();
  startPaymentCountdown(orderId, createdTs);

  document.getElementById('payment-modal').classList.add('open');
}
window.openPaymentModal = openPaymentModal;

function closePaymentModal() {
  triggerHaptic('light');
  clearInterval(payTimerInterval);
  document.getElementById('payment-modal').classList.remove('open');
  navigateTab('profile', null);
}
window.closePaymentModal = closePaymentModal;

function startPaymentCountdown(orderId, startTs) {
  clearInterval(payTimerInterval);
  const timerVal = document.getElementById('pay-timer-val');

  function tick() {
    const elapsed = Math.floor((Date.now() - startTs) / 1000);
    const left = (15 * 60) - elapsed;

    if (left <= 0) {
      clearInterval(payTimerInterval);
      if (timerVal) timerVal.innerText = "00:00 (Истекло)";
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: "cancel_order_timeout", order_id: orderId })
      }).catch(() => {});
      toast("Время оплаты истекло");
      closePaymentModal();
      return;
    }

    const m = Math.floor(left / 60);
    const s = left % 60;
    if (timerVal) timerVal.innerText = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  }

  tick();
  payTimerInterval = setInterval(tick, 1000);
}

function copyPaymentAmount() {
  triggerHaptic('selection');
  const txt = document.getElementById('pay-modal-amount')?.innerText.replace(/[^\d]/g, '');
  if (txt && navigator.clipboard) {
    navigator.clipboard.writeText(txt);
    toast("Сумма скопирована!");
  }
}
window.copyPaymentAmount = copyPaymentAmount;

async function confirmPaymentByClient() {
  triggerHaptic('medium');
  const title = document.getElementById('pay-modal-order-id')?.innerText || "";
  const match = title.match(/ORD-\d+/);
  const orderId = match ? match[0] : "";

  if (!orderId) return;

  toast("Отправка подтверждения...");
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: "client_paid", order_id: orderId })
    });
    toast("Оплата принята на проверку!");
    closePaymentModal();
  } catch (e) {
    toast("Ошибка отправки");
  }
}
window.confirmPaymentByClient = confirmPaymentByClient;

function closeAssemblyModal() {
  triggerHaptic('light');
  document.getElementById('assembly-call-modal').classList.remove('open');
  navigateTab('profile', null);
}
window.closeAssemblyModal = closeAssemblyModal;
