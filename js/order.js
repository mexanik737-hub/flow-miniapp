window.deliveryType = window.deliveryType || 'delivery';
window.recipientType = window.recipientType || 'self';
window.selectedDeliveryTimeValue = window.selectedDeliveryTimeValue || 'Как можно скорее (1-2 часа)';
window.selectedSuggestAddress = window.selectedSuggestAddress || null;
window.calculatedDeliveryCost = window.calculatedDeliveryCost || 0;
window.calculatedDistanceKm = window.calculatedDistanceKm || 0;
window.ordSaveAddrChecked = window.ordSaveAddrChecked || false;
window.currentFlowersSubtotal = window.currentFlowersSubtotal || 0;
window.savedAddresses = window.savedAddresses || [];
window.suggestDebounceTimer = window.suggestDebounceTimer || null;
window.activePaymentOrderId = window.activePaymentOrderId || null;
window.paymentCountdownTimer = window.paymentCountdownTimer || null;

let pendingOrderPayload = null;

function setDeliveryType(type) {
  triggerHaptic('selection');
  deliveryType = type;

  const btnDel = document.getElementById('btn-del');
  const btnPick = document.getElementById('btn-pick');
  if (btnDel) btnDel.classList.toggle('active', type === 'delivery');
  if (btnPick) btnPick.classList.toggle('active', type === 'pickup');

  const delFields = document.getElementById('delivery-extra-fields');
  const pickFields = document.getElementById('pickup-extra-fields');
  if (delFields) delFields.style.display = (type === 'delivery') ? 'block' : 'none';
  if (pickFields) pickFields.style.display = (type === 'pickup') ? 'block' : 'none';

  if (type === 'pickup') {
    calculatedDeliveryCost = 0;
  } else {
    recalcDeliveryCostFromCurrentState();
  }
  updateOrderModalPriceSummary();
}
window.setDeliveryType = setDeliveryType;

function setRecipientType(type) {
  triggerHaptic('selection');
  recipientType = type;

  const btnSelf = document.getElementById('btn-rec-self');
  const btnOther = document.getElementById('btn-rec-other');
  if (btnSelf) btnSelf.classList.toggle('active', type === 'self');
  if (btnOther) btnOther.classList.toggle('active', type === 'other');

  const otherFields = document.getElementById('other-rec-fields');
  if (otherFields) otherFields.style.display = (type === 'other') ? 'block' : 'none';
}
window.setRecipientType = setRecipientType;

function generateDeliveryTimeOptions() {
  const optionsBox = document.getElementById('time-select-options');
  if (!optionsBox) return;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const intervals = [
    { label: "10:00 - 12:00", endH: 12 },
    { label: "12:00 - 14:00", endH: 14 },
    { label: "14:00 - 16:00", endH: 16 },
    { label: "16:00 - 18:00", endH: 18 },
    { label: "18:00 - 20:00", endH: 20 }
  ];

  let html = `<div class="custom-select-option" onclick="selectOrderDeliveryTime('Как можно скорее (1-2 часа)')">⚡ Как можно скорее (1-2 часа)</div>`;

  intervals.forEach(int => {
    if (currentHour < int.endH - 1 || (currentHour === int.endH - 1 && currentMinute <= 15)) {
      html += `<div class="custom-select-option" onclick="selectOrderDeliveryTime('${int.label}')">🕒 Сегодня: ${int.label}</div>`;
    }
  });

  html += `<div class="custom-select-option" onclick="selectOrderDeliveryTime('Завтра: 10:00 - 12:00')">📅 Завтра: 10:00 - 12:00</div>`;
  html += `<div class="custom-select-option" onclick="selectOrderDeliveryTime('Завтра: 12:00 - 15:00')">📅 Завтра: 12:00 - 15:00</div>`;
  html += `<div class="custom-select-option" onclick="selectOrderDeliveryTime('Завтра: 15:00 - 18:00')">📅 Завтра: 15:00 - 18:00</div>`;
  html += `<div class="custom-select-option" onclick="selectOrderDeliveryTime('Завтра: 18:00 - 20:00')">📅 Завтра: 18:00 - 20:00</div>`;

  optionsBox.innerHTML = html;
  selectedDeliveryTimeValue = "Как можно скорее (1-2 часа)";
  const disp = document.getElementById('selected-time-display');
  if (disp) disp.innerText = "⚡ Как можно скорее (1-2 часа)";
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
  try {
    triggerHaptic('selection');
    const count = Object.values(window.cart || {}).reduce((a, b) => a + b, 0);
    if (!count) { toast("Корзина пуста"); return; }

    setDeliveryType('delivery');
    setRecipientType('self');
    generateDeliveryTimeOptions();

    renderOrderSavedAddressPills();

    const fields = [
      'ord-suggest-input', 'ord-entrance', 'ord-floor', 'ord-apt',
      'ord-intercom', 'ord-comment', 'ord-shop-comment', 'ord-rec-name', 'ord-rec-phone'
    ];
    fields.forEach(fId => {
      const el = document.getElementById(fId);
      if (el) el.value = "";
    });

    selectedSuggestAddress = null;
    calculatedDeliveryCost = 0;
    ordSaveAddrChecked = false;
    const chk = document.getElementById('ord-save-addr-checkbox-ui');
    if (chk) { chk.classList.remove('checked'); chk.innerText = ''; }

    const badge = document.getElementById('delivery-calc-badge');
    if (badge) {
      badge.innerHTML = '📍 Введите адрес, чтобы рассчитать точную стоимость доставки (от 350 ₽)';
      badge.style.color = 'var(--gold)';
    }

    updateOrderModalPriceSummary();

    const modal = document.getElementById('order-modal');
    if (modal) {
      modal.classList.add('open');
      if (typeof syncModalDepthState === 'function') syncModalDepthState();
    }
  } catch (err) {
    console.error("openOrderModal error:", err);
    toast("Ошибка открытия формы заказа");
  }
}
window.openOrderModal = openOrderModal;

function closeOrderModal() {
  triggerHaptic('light');
  const modal = document.getElementById('order-modal');
  if (modal) modal.classList.remove('open');
  if (typeof syncModalDepthState === 'function') syncModalDepthState();
}
window.closeOrderModal = closeOrderModal;

function renderOrderSavedAddressPills() {
  const container = document.getElementById('order-saved-address-container');
  const pillsBox = document.getElementById('order-saved-address-pills');
  if (!container || !pillsBox) return;

  const addrs = window.savedAddresses || [];
  if (!addrs.length) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  pillsBox.innerHTML = addrs.map((a, idx) => `
    <div class="addr-pill" onclick="selectSavedAddressForOrder(${idx})">
      <b>${a.label}</b>: ${a.address}
    </div>
  `).join('');
}

function selectSavedAddressForOrder(idx) {
  triggerHaptic('selection');
  const a = (window.savedAddresses || [])[idx];
  if (!a) return;

  document.querySelectorAll('#order-saved-address-pills .addr-pill').forEach((p, i) => {
    p.classList.toggle('active', i === idx);
  });

  const sugInput = document.getElementById('ord-suggest-input');
  if (sugInput) sugInput.value = a.address;
  const ent = document.getElementById('ord-entrance');
  if (ent) ent.value = a.entrance || "";
  const flr = document.getElementById('ord-floor');
  if (flr) flr.value = a.floor || "";
  const apt = document.getElementById('ord-apt');
  if (apt) apt.value = a.apt || "";
  const intc = document.getElementById('ord-intercom');
  if (intc) intc.value = a.intercom || "";

  selectedSuggestAddress = {
    value: a.address,
    data: {
      house: "1",
      geo_lat: a.lat,
      geo_lon: a.lon
    }
  };

  recalcDeliveryCostFromCurrentState();
  updateOrderModalPriceSummary();
}
window.selectSavedAddressForOrder = selectSavedAddressForOrder;

function onAddressInput(query) {
  clearTimeout(suggestDebounceTimer);
  const box = document.getElementById('ord-suggest-list');
  selectedSuggestAddress = null;
  calculatedDeliveryCost = 0;
  updateOrderModalPriceSummary();

  const badge = document.getElementById('delivery-calc-badge');
  if (badge) {
    badge.innerHTML = '📍 Введите адрес, чтобы рассчитать точную стоимость доставки (от 350 ₽)';
    badge.style.color = 'var(--gold)';
  }

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
          "Authorization": "Token " + (window.SERVER_CONFIG?.dadata_token || "")
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
          <div class="suggest-item" onclick="selectSuggestItem(${idx})">${s.value}</div>
        `).join('');
        box.style.display = 'block';
      }
      window.currentAddressSuggestions = items;
    } catch (e) {}
  }, 250);
}
window.onAddressInput = onAddressInput;

function selectSuggestItem(idx) {
  triggerHaptic('selection');
  const s = window.currentAddressSuggestions?.[idx];
  if (!s) return;

  const sugInput = document.getElementById('ord-suggest-input');
  if (sugInput) sugInput.value = s.value;
  const list = document.getElementById('ord-suggest-list');
  if (list) list.style.display = 'none';
  selectedSuggestAddress = s;

  recalcDeliveryCostFromCurrentState();
  updateOrderModalPriceSummary();
}
window.selectSuggestItem = selectSuggestItem;

function recalcDeliveryCostFromCurrentState() {
  const badge = document.getElementById('delivery-calc-badge');
  if (!badge) return;

  if (!selectedSuggestAddress || !selectedSuggestAddress.data || !selectedSuggestAddress.data.geo_lat || !selectedSuggestAddress.data.geo_lon) {
    calculatedDeliveryCost = 0;
    badge.innerHTML = '⚠️ Выберите точный адрес с номером дома из выпадающего списка DaData';
    badge.style.color = 'var(--amber)';
    return;
  }

  const destLat = parseFloat(selectedSuggestAddress.data.geo_lat);
  const destLon = parseFloat(selectedSuggestAddress.data.geo_lon);
  const storeLat = parseFloat(window.SERVER_CONFIG?.store_lat || 55.966987);
  const storeLon = parseFloat(window.SERVER_CONFIG?.store_lon || 37.151059);

  const distKm = calcHaversineDistance(storeLat, storeLon, destLat, destLon);
  calculatedDistanceKm = Math.round(distKm * 10) / 10;

  if (distKm <= 2) {
    calculatedDeliveryCost = 350;
  } else {
    calculatedDeliveryCost = 350 + Math.ceil(distKm - 2) * 40;
  }

  badge.innerHTML = `🚚 Доставка: <b>${calculatedDeliveryCost} ₽</b> (дистанция ~${calculatedDistanceKm} км от салона)`;
  badge.style.color = 'var(--green)';
}

function updateOrderModalPriceSummary() {
  const subtotalEl = document.getElementById('order-subtotal-val');
  const delivEl = document.getElementById('order-delivery-val');
  const finalEl = document.getElementById('order-final-val');

  const deliv = (deliveryType === 'delivery') ? (calculatedDeliveryCost || 0) : 0;
  const flowersSum = window.currentFlowersSubtotal || 0;
  const finalSum = flowersSum + deliv;

  if (subtotalEl) subtotalEl.innerText = `${flowersSum} ₽`;
  if (delivEl) delivEl.innerText = `${deliv} ₽`;
  if (finalEl) finalEl.innerText = `${finalSum} ₽`;
}

// ----------------- ДВУХЭТАПНОЕ ОФОРМЛЕНИЕ ЗАКАЗА -----------------

function openOrderConfirmModal() {
  triggerHaptic('medium');

  const count = Object.values(window.cart || {}).reduce((a, b) => a + b, 0);
  if (!count) { toast("Корзина пуста"); return; }

  let recName = window.currentUser?.name || window.tgFirstName || "Клиент";
  let recPhone = window.currentUser?.phone || "";

  if (recipientType === 'other') {
    recName = document.getElementById('ord-rec-name')?.value.trim() || "";
    recPhone = document.getElementById('ord-rec-phone')?.value.trim() || "";
    if (!recName || recPhone.length < 17) {
      toast("Укажите имя и телефон получателя полностью: 8 (***) ***-**-**");
      return;
    }
  }

  let finalAddressStr = "Самовывоз из салона: Зеленоград, Георгиевский пр-т, 37к2";
  if (deliveryType === 'delivery') {
    const rawStreet = document.getElementById('ord-suggest-input')?.value.trim();
    if (!rawStreet) {
      toast("Укажите адрес доставки");
      return;
    }
    if (!selectedSuggestAddress || !selectedSuggestAddress.data?.house || !selectedSuggestAddress.data?.geo_lat) {
      toast("Выберите точный адрес с номером дома из подсказок DaData");
      return;
    }

    const ent = document.getElementById('ord-entrance')?.value.trim() || "";
    const flr = document.getElementById('ord-floor')?.value.trim() || "";
    const apt = document.getElementById('ord-apt')?.value.trim() || "";
    const intc = document.getElementById('ord-intercom')?.value.trim() || "";

    if (!ent || !flr || !apt || !intc) {
      toast("Заполните подъезд, этаж, квартиру/офис и домофон");
      return;
    }

    const courierComm = document.getElementById('ord-comment')?.value.trim() || "";
    finalAddressStr = `${selectedSuggestAddress.value}, под. ${ent}, эт. ${flr}, кв./оф. ${apt}, дом. ${intc}`;
    if (courierComm) {
      finalAddressStr += ` [курьеру: ${courierComm}]`;
    }

    if (ordSaveAddrChecked) {
      const exists = (window.savedAddresses || []).some(a => a.address === selectedSuggestAddress.value && a.apt === apt);
      if (!exists && (window.savedAddresses || []).length < 3) {
        window.savedAddresses.push({
          label: "Адрес " + (window.savedAddresses.length + 1),
          address: selectedSuggestAddress.value,
          entrance: ent,
          floor: flr,
          apt: apt,
          intercom: intc,
          lat: selectedSuggestAddress.data.geo_lat,
          lon: selectedSuggestAddress.data.geo_lon
        });
        if (typeof syncSavedAddresses === 'function') syncSavedAddresses();
      }
    }
  }

  const shopComment = document.getElementById('ord-shop-comment')?.value.trim() || "";
  const deliveryTime = selectedDeliveryTimeValue || "Как можно скорее (1-2 часа)";
  const delivCost = (deliveryType === 'delivery') ? (calculatedDeliveryCost || 0) : 0;
  const flowersSum = window.currentFlowersSubtotal || 0;
  const totalAmount = flowersSum + delivCost;

  const itemsPayload = [];
  Object.entries(window.cart || {}).forEach(([cartKey, qty]) => {
    const [id, unit, variant, color] = cartKey.split(':::');
    const item = (window.catalog || []).find(i => String(i.id) === String(id));
    if (item) {
      itemsPayload.push({
        id: item.id,
        title: item.title,
        unit: unit || item.unit || '1 шт.',
        variant: variant || item.variant || '',
        color: color || item.color || '',
        price: item.price,
        qty: qty,
        in_bouquet: !!(window.cartAssemblyItems && window.cartAssemblyItems[cartKey])
      });
    }
  });

  pendingOrderPayload = {
    user_id: window.userId,
    user_name: window.currentUser?.name || window.tgFirstName || "Клиент",
    user_phone: window.currentUser?.phone || "",
    delivery_type: deliveryType,
    recipient_info: (recipientType === 'other') ? `${recName} (${recPhone})` : "Заказчик лично",
    address: finalAddressStr,
    delivery_time: deliveryTime,
    items_json: JSON.stringify(itemsPayload),
    items_list: itemsPayload,
    total_amount: totalAmount,
    shop_comment: shopComment,
    delivery_cost: delivCost,
    need_assembly: !!window.isAssemblyMode
  };

  const summaryBox = document.getElementById('order-confirm-summary');
  if (summaryBox) {
    const itemsHtml = itemsPayload.map(it => {
      const fullTitle = formatFullItemTitle(it.title, it.unit, it.variant, it.color);
      const bqTag = it.in_bouquet ? ' <b style="color:var(--gold);">[в букет]</b>' : '';
      return `• ${fullTitle} × ${it.qty} шт. = <b>${it.price * it.qty} ₽</b>${bqTag}`;
    }).join('<br>');

    summaryBox.innerHTML = `
      <div style="background:var(--card-inner); border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px; font-size:12px; line-height:1.55; color:var(--text); margin-bottom:12px;">
        <div style="font-size:11px; font-weight:800; color:var(--gold); text-transform:uppercase; margin-bottom:6px;">Сводка заказа:</div>
        <b>Тип:</b> ${deliveryType === 'delivery' ? '🚚 Доставка курьером' : '📍 Самовывоз из салона'}<br>
        <b>Адрес:</b> ${finalAddressStr}<br>
        <b>Получатель:</b> ${pendingOrderPayload.recipient_info}<br>
        <b>Желаемое время:</b> ${deliveryTime}<br>
        ${shopComment ? `<b>Пожелания салону:</b> ${shopComment}<br>` : ''}
        ${window.isAssemblyMode ? `<div style="margin-top:4px; color:var(--gold); font-weight:700;">💐 Выбрана сборка цветов в букет (упаковка согласуется по звонку)</div>` : ''}
        
        <div style="margin:8px 0; padding-top:6px; border-top:1px dashed var(--border);">
          <b>Состав:</b><br>${itemsHtml}
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:6px; border-top:1px solid var(--border); font-size:14px; font-weight:900;">
          <span>ИТОГО К ОПЛАТЕ:</span>
          <span style="color:var(--green);">${totalAmount} ₽</span>
        </div>
      </div>
    `;
  }

  const confirmModal = document.getElementById('order-confirm-modal');
  if (confirmModal) {
    confirmModal.classList.add('open');
    if (typeof syncModalDepthState === 'function') syncModalDepthState();
  }
}
window.openOrderConfirmModal = openOrderConfirmModal;

function closeOrderConfirmModal() {
  triggerHaptic('light');
  const confirmModal = document.getElementById('order-confirm-modal');
  if (confirmModal) confirmModal.classList.remove('open');
  if (typeof syncModalDepthState === 'function') syncModalDepthState();
}
window.closeOrderConfirmModal = closeOrderConfirmModal;

async function submitConfirmedFinalOrder() {
  if (!pendingOrderPayload) return;
  triggerHaptic('medium');
  toast("Отправка заказа в салон...");

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: "create_order",
        user_id: pendingOrderPayload.user_id,
        user_name: pendingOrderPayload.user_name,
        user_phone: pendingOrderPayload.user_phone,
        delivery_type: pendingOrderPayload.delivery_type,
        recipient_info: pendingOrderPayload.recipient_info,
        address: pendingOrderPayload.address,
        delivery_time: pendingOrderPayload.delivery_time,
        items_json: pendingOrderPayload.items_json,
        total_amount: pendingOrderPayload.total_amount,
        shop_comment: pendingOrderPayload.shop_comment,
        delivery_cost: pendingOrderPayload.delivery_cost,
        need_assembly: pendingOrderPayload.need_assembly
      })
    });

    const data = await res.json();

    if (data.success) {
      const orderId = data.order_id;
      const totalAmount = data.total_amount;
      const needAssembly = pendingOrderPayload.need_assembly;

      clearCartStorage();
      updateCartUI();

      closeOrderConfirmModal();
      closeOrderModal();

      if (needAssembly) {
        openAssemblyModal(orderId);
      } else {
        const nowStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('ru-RU');
        openPaymentModal(orderId, totalAmount, nowStr);
      }
      toast("Заказ успешно зарегистрирован!");
    } else {
      toast("Ошибка оформления заказа");
    }
  } catch (err) {
    toast("Ошибка связи с сервером");
  }
}
window.submitConfirmedFinalOrder = submitConfirmedFinalOrder;

function openAssemblyModal(orderId) {
  triggerHaptic('medium');
  const idEl = document.getElementById('asm-modal-order-id');
  if (idEl) idEl.innerText = orderId;
  const m = document.getElementById('assembly-call-modal');
  if (m) {
    m.classList.add('open');
    if (typeof syncModalDepthState === 'function') syncModalDepthState();
  }
}
window.openAssemblyModal = openAssemblyModal;

function closeAssemblyModal() {
  triggerHaptic('light');
  const m = document.getElementById('assembly-call-modal');
  if (m) m.classList.remove('open');
  if (typeof syncModalDepthState === 'function') syncModalDepthState();
  navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
}
window.closeAssemblyModal = closeAssemblyModal;

function openPaymentModal(orderId, amount, createdAtStr) {
  triggerHaptic('medium');
  activePaymentOrderId = orderId;

  const idEl = document.getElementById('pay-modal-order-id');
  if (idEl) idEl.innerText = `Оплата: ${orderId}`;
  const amtEl = document.getElementById('pay-modal-amount');
  if (amtEl) amtEl.innerText = `${amount} ₽`;

  const sbpBtn = document.getElementById('pay-sbp-btn');
  if (sbpBtn && window.SERVER_CONFIG?.sbp_url) {
    sbpBtn.href = window.SERVER_CONFIG.sbp_url;
  }

  const qrImg = document.getElementById('sbp-qr-image-tag');
  if (qrImg && window.SERVER_CONFIG?.sbp_qr) {
    qrImg.src = window.SERVER_CONFIG.sbp_qr;
  }

  startPaymentCountdown(createdAtStr);
  const m = document.getElementById('payment-modal');
  if (m) {
    m.classList.add('open');
    if (typeof syncModalDepthState === 'function') syncModalDepthState();
  }
}
window.openPaymentModal = openPaymentModal;

function closePaymentModal() {
  triggerHaptic('light');
  clearInterval(paymentCountdownTimer);
  const m = document.getElementById('payment-modal');
  if (m) m.classList.remove('open');
  if (typeof syncModalDepthState === 'function') syncModalDepthState();
}
window.closePaymentModal = closePaymentModal;

function copyPaymentAmount() {
  triggerHaptic('selection');
  const amtEl = document.getElementById('pay-modal-amount');
  const amountStr = amtEl ? amtEl.innerText.replace(/\D/g, '') : "";
  if (navigator.clipboard) {
    navigator.clipboard.writeText(amountStr);
    toast(`Сумма ${amountStr} ₽ скопирована!`);
  }
}
window.copyPaymentAmount = copyPaymentAmount;

function startPaymentCountdown(createdAtStr) {
  clearInterval(paymentCountdownTimer);
  const timerValEl = document.getElementById('pay-timer-val');
  if (!timerValEl) return;

  const createdTs = parseOrderDateToTs(createdAtStr) || Date.now();
  const TIMEOUT_SEC = 15 * 60;

  function updateTick() {
    const elapsedSec = Math.floor((Date.now() - createdTs) / 1000);
    const leftSec = TIMEOUT_SEC - elapsedSec;

    if (leftSec <= 0) {
      clearInterval(paymentCountdownTimer);
      timerValEl.innerText = "00:00 (Истекло)";
      toast("Время ожидания оплаты истекло. Заказ отменен.");
      closePaymentModal();
      if (typeof loadUserOrders === 'function') loadUserOrders();
      return;
    }

    const m = Math.floor(leftSec / 60);
    const s = leftSec % 60;
    timerValEl.innerText = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  }

  updateTick();
  paymentCountdownTimer = setInterval(updateTick, 1000);
}

async function confirmPaymentByClient() {
  if (!activePaymentOrderId) return;
  triggerHaptic('medium');
  toast("Уведомление отправлено салону...");

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: "client_paid",
        order_id: activePaymentOrderId
      })
    });
  } catch (e) {}

  closePaymentModal();

  const pendingModal = document.getElementById('payment-pending-modal');
  if (pendingModal) {
    pendingModal.classList.add('open');
    if (typeof syncModalDepthState === 'function') syncModalDepthState();
  }

  if (typeof launchConfettiAnimation === 'function') {
    launchConfettiAnimation();
  }
}
window.confirmPaymentByClient = confirmPaymentByClient;

function goToOrdersFromPendingModal() {
  triggerHaptic('light');
  const pendingModal = document.getElementById('payment-pending-modal');
  if (pendingModal) {
    pendingModal.classList.remove('open');
    if (typeof syncModalDepthState === 'function') syncModalDepthState();
  }
  navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
  if (typeof loadUserOrders === 'function') {
    loadUserOrders();
  }
}
window.goToOrdersFromPendingModal = goToOrdersFromPendingModal;
