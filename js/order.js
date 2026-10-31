window.selectedAddressSuggestion = window.selectedAddressSuggestion || null;
window.currentDeliveryType = window.currentDeliveryType || 'delivery';
window.currentRecipientType = window.currentRecipientType || 'self';
window.currentDeliveryCost = window.currentDeliveryCost || 0;
window.currentFlowersSubtotal = window.currentFlowersSubtotal || 0;
window.ordSaveAddrChecked = window.ordSaveAddrChecked || false;
window.selectedDeliveryTime = window.selectedDeliveryTime || '';
window.suggestDebounceTimer = window.suggestDebounceTimer || null;
window.paymentTimerInterval = window.paymentTimerInterval || null;
window.currentPaymentOrderId = window.currentPaymentOrderId || null;
window.currentPaymentAmount = window.currentPaymentAmount || 0;
window.pendingOrderPayload = window.pendingOrderPayload || null;

function setDeliveryType(type) {
  try {
    triggerHaptic('selection');
  } catch (e) {}
  window.currentDeliveryType = type;

  const btnDel = document.getElementById('btn-del');
  const btnPick = document.getElementById('btn-pick');
  if (btnDel) btnDel.classList.toggle('active', type === 'delivery');
  if (btnPick) btnPick.classList.toggle('active', type === 'pickup');

  const delFields = document.getElementById('delivery-extra-fields');
  const pickFields = document.getElementById('pickup-extra-fields');
  if (delFields) delFields.style.display = (type === 'delivery') ? 'block' : 'none';
  if (pickFields) pickFields.style.display = (type === 'pickup') ? 'block' : 'none';

  if (type === 'pickup') {
    window.currentDeliveryCost = 0;
  } else {
    recalcDeliveryCost();
  }
  updateOrderFinalValues();
}
window.setDeliveryType = setDeliveryType;

function setRecipientType(type) {
  try {
    triggerHaptic('selection');
  } catch (e) {}
  window.currentRecipientType = type;

  const btnSelf = document.getElementById('btn-rec-self');
  const btnOther = document.getElementById('btn-rec-other');
  if (btnSelf) btnSelf.classList.toggle('active', type === 'self');
  if (btnOther) btnOther.classList.toggle('active', type === 'other');

  const otherFields = document.getElementById('other-rec-fields');
  if (otherFields) otherFields.style.display = (type === 'other') ? 'block' : 'none';
}
window.setRecipientType = setRecipientType;

function populateTimeSlots() {
  const optionsBox = document.getElementById('time-select-options');
  const displaySpan = document.getElementById('selected-time-display');
  if (!optionsBox || !displaySpan) return;

  const now = new Date();
  const mskUtc = now.getTime() + (now.getTimezoneOffset() * 60000) + (3 * 3600000);
  const curHour = new Date(mskUtc).getHours();

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

  availableSlots.push("Другой день (согласовать)");

  optionsBox.innerHTML = availableSlots.map(t => `
    <div class="custom-select-option" onclick="selectTimeSlot('${t}')">${t}</div>
  `).join('');

  window.selectedDeliveryTime = availableSlots[0];
  displaySpan.innerText = window.selectedDeliveryTime;
}

function selectTimeSlot(t) {
  try {
    triggerHaptic('selection');
  } catch (e) {}
  window.selectedDeliveryTime = t;
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

  const list = window.savedAddresses || [];
  if (!list.length) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  pillsWrap.innerHTML = list.map((a, idx) => `
    <div class="addr-pill" onclick="applySavedAddressToOrder(${idx})">
      📍 ${a.label}
    </div>
  `).join('');
}

function applySavedAddressToOrder(idx) {
  try {
    triggerHaptic('selection');
  } catch (e) {}
  const list = window.savedAddresses || [];
  const a = list[idx];
  if (!a) return;

  window.selectedAddressSuggestion = {
    value: a.address,
    data: {
      house: "1",
      geo_lat: a.lat,
      geo_lon: a.lon
    }
  };

  const inp = document.getElementById('ord-suggest-input');
  if (inp) inp.value = a.address;
  const ent = document.getElementById('ord-entrance');
  if (ent) ent.value = a.entrance || "";
  const flr = document.getElementById('ord-floor');
  if (flr) flr.value = a.floor || "";
  const apt = document.getElementById('ord-apt');
  if (apt) apt.value = a.apt || "";
  const intc = document.getElementById('ord-intercom');
  if (intc) intc.value = a.intercom || "";

  document.querySelectorAll('.addr-pill').forEach((p, i) => p.classList.toggle('active', i === idx));
  recalcDeliveryCost();
  updateOrderFinalValues();
}
window.applySavedAddressToOrder = applySavedAddressToOrder;

function onAddressInput(query) {
  clearTimeout(window.suggestDebounceTimer);
  const box = document.getElementById('ord-suggest-list');
  window.selectedAddressSuggestion = null;

  if (!query || query.trim().length < 2) {
    if (box) box.style.display = 'none';
    window.currentDeliveryCost = 0;
    updateOrderFinalValues();
    return;
  }

  window.suggestDebounceTimer = setTimeout(async () => {
    try {
      const cfg = window.SERVER_CONFIG || {};
      const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": "Token " + (cfg.dadata_token || "")
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
  try {
    triggerHaptic('selection');
  } catch (e) {}
  const s = window.lastAddressSuggestions?.[idx];
  if (!s) return;
  const inp = document.getElementById('ord-suggest-input');
  if (inp) inp.value = s.value;
  const box = document.getElementById('ord-suggest-list');
  if (box) box.style.display = 'none';
  window.selectedAddressSuggestion = s;
  recalcDeliveryCost();
  updateOrderFinalValues();
}
window.selectAddressItem = selectAddressItem;

function recalcDeliveryCost() {
  const badge = document.getElementById('delivery-calc-badge');
  if (window.currentDeliveryType === 'pickup') {
    window.currentDeliveryCost = 0;
    if (badge) badge.innerHTML = "📍 Самовывоз: Зеленоград, Георгиевский пр-т, 37к2 (бесплатно)";
    return;
  }

  const sel = window.selectedAddressSuggestion;
  if (!sel || !sel.data?.geo_lat || !sel.data?.geo_lon) {
    window.currentDeliveryCost = 350;
    if (badge) badge.innerHTML = "📍 Введите адрес, чтобы рассчитать точную стоимость доставки (от 350 ₽)";
    return;
  }

  const userLat = parseFloat(sel.data.geo_lat);
  const userLon = parseFloat(sel.data.geo_lon);
  const cfg = window.SERVER_CONFIG || {};
  const storeLat = parseFloat(cfg.store_lat || 55.966987);
  const storeLon = parseFloat(cfg.store_lon || 37.151059);

  const distKm = (typeof calcHaversineDistance === 'function') 
    ? calcHaversineDistance(storeLat, storeLon, userLat, userLon) 
    : 2.0;

  let cost = 350;
  if (distKm > 2) {
    cost += Math.round((distKm - 2) * 40);
  }
  window.currentDeliveryCost = cost;

  if (badge) {
    badge.innerHTML = `🚚 Доставка: ~<b>${distKm.toFixed(1)} км</b> от салона — <b>${cost} ₽</b>`;
  }
}

function updateOrderFinalValues() {
  const subtotal = Number(window.currentFlowersSubtotal) || 0;
  const delCost = (window.currentDeliveryType === 'pickup') ? 0 : (Number(window.currentDeliveryCost) || 0);

  const subtotalEl = document.getElementById('order-subtotal-val');
  const deliveryEl = document.getElementById('order-delivery-val');
  const finalEl = document.getElementById('order-final-val');

  if (subtotalEl) subtotalEl.innerText = `${subtotal} ₽`;
  if (deliveryEl) deliveryEl.innerText = `${delCost} ₽`;
  if (finalEl) finalEl.innerText = `${subtotal + delCost} ₽`;
}

function openOrderModal() {
  try {
    try {
      triggerHaptic('medium');
    } catch (e) {}

    if (!window.currentUser) {
      toast("Завершите регистрацию для оформления заказа");
      const regModal = document.getElementById('reg-modal');
      if (regModal) {
        regModal.classList.add('open');
        if (typeof syncModalDepthState === 'function') syncModalDepthState();
      }
      return;
    }

    const entries = Object.entries(window.cart || {});
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
    if (m) {
      m.classList.add('open');
      if (typeof syncModalDepthState === 'function') syncModalDepthState();
    }
  } catch (err) {
    console.error("openOrderModal error:", err);
  }
}
window.openOrderModal = openOrderModal;

function closeOrderModal() {
  try {
    triggerHaptic('light');
  } catch (e) {}
  const m = document.getElementById('order-modal');
  if (m) {
    m.classList.remove('open');
    if (typeof syncModalDepthState === 'function') syncModalDepthState();
  }
}
window.closeOrderModal = closeOrderModal;

function proceedToOrderSummary() {
  try {
    triggerHaptic('medium');
  } catch (e) {}

  let recInfo = "Заказчик лично";
  if (window.currentRecipientType === 'other') {
    const oName = (document.getElementById('ord-rec-name')?.value || '').trim();
    const oPhone = (document.getElementById('ord-rec-phone')?.value || '').trim();
    if (!oName || oPhone.length < 17) {
      toast("Укажите имя и телефон получателя полностью: 8 (***) ***-**-**");
      return;
    }
    recInfo = `${oName} (${oPhone})`;
  }

  let finalAddressStr = "Самовывоз: Георгиевский пр-т, 37к2";
  if (window.currentDeliveryType === 'delivery') {
    const rawAddr = (document.getElementById('ord-suggest-input')?.value || '').trim();
    const ent = (document.getElementById('ord-entrance')?.value || '').trim();
    const flr = (document.getElementById('ord-floor')?.value || '').trim();
    const apt = (document.getElementById('ord-apt')?.value || '').trim();
    const intc = (document.getElementById('ord-intercom')?.value || '').trim();
    const comm = (document.getElementById('ord-comment')?.value || '').trim();

    if (!rawAddr) {
      toast("Укажите улицу и номер дома");
      return;
    }
    const sel = window.selectedAddressSuggestion;
    if (!sel || !sel.data?.house) {
      toast("Выберите точный адрес с номером дома из подсказок DaData");
      return;
    }
    if (!ent || !flr || !apt || !intc) {
      toast("Заполните все поля: подъезд, этаж, квартиру и домофон");
      return;
    }

    finalAddressStr = `${rawAddr}, под. ${ent}, эт. ${flr}, кв. ${apt}, дом. ${intc}${comm ? ` [курьеру: ${comm}]` : ''}`;

    const list = window.savedAddresses || [];
    if (window.ordSaveAddrChecked && !list.some(a => a.address === rawAddr)) {
      if (list.length < 3) {
        list.push({
          label: "Адрес " + (list.length + 1),
          address: rawAddr,
          entrance: ent,
          floor: flr,
          apt: apt,
          intercom: intc,
          lat: sel.data.geo_lat,
          lon: sel.data.geo_lon
        });
        window.savedAddresses = list;
        if (typeof syncSavedAddresses === 'function') syncSavedAddresses();
      }
    }
  }

  const itemsList = [];
  const fullCatalog = window.catalog || [];
  Object.entries(window.cart || {}).forEach(([cartKey, qty]) => {
    const [id, selectedUnit, selectedVar, selectedColor] = cartKey.split(':::');
    const item = fullCatalog.find(i => String(i.id) === String(id));
    if (item) {
      itemsList.push({
        id: item.id,
        title: item.title,
        unit: selectedUnit || item.unit,
        variant: selectedVar || item.variant,
        color: selectedColor || item.color,
        price: item.price,
        qty: qty,
        in_bouquet: !!window.isAssemblyMode && !!(window.cartAssemblyItems && window.cartAssemblyItems[cartKey])
      });
    }
  });

  const subtotal = Number(window.currentFlowersSubtotal) || 0;
  const delCost = (window.currentDeliveryType === 'pickup') ? 0 : (Number(window.currentDeliveryCost) || 0);
  const totalAmount = subtotal + delCost;
  const shopComment = (document.getElementById('ord-shop-comment')?.value || '').trim();
  const u = window.currentUser || {};

  window.pendingOrderPayload = {
    action: "create_order",
    user_id: window.userId || "",
    user_name: u.name || "Клиент",
    user_phone: u.phone || "",
    delivery_type: window.currentDeliveryType,
    recipient_info: recInfo,
    address: finalAddressStr,
    delivery_time: window.selectedDeliveryTime || "Как можно скорее",
    shop_comment: shopComment,
    delivery_cost: delCost,
    total_amount: totalAmount,
    items_json: JSON.stringify(itemsList),
    need_assembly: !!window.isAssemblyMode
  };

  const delTypeEl = document.getElementById('summary-del-type');
  if (delTypeEl) delTypeEl.innerText = (window.currentDeliveryType === 'delivery') ? '🚚 Доставка курьером' : '📍 Самовывоз из салона';
  const addrEl = document.getElementById('summary-address-val');
  if (addrEl) addrEl.innerText = finalAddressStr;
  const timeEl = document.getElementById('summary-time-val');
  if (timeEl) timeEl.innerText = window.selectedDeliveryTime || 'Как можно скорее';
  const recEl = document.getElementById('summary-recipient-val');
  if (recEl) recEl.innerText = recInfo;

  const itemsBox = document.getElementById('summary-items-list');
  if (itemsBox) {
    itemsBox.innerHTML = itemsList.map(it => {
      const fullT = (typeof formatFullItemTitle === 'function')
        ? formatFullItemTitle(it.title, it.unit, it.variant, it.color)
        : it.title;
      const bqTag = it.in_bouquet ? ' <span style="color:var(--gold); font-weight:800;">[в букет]</span>' : '';
      return `<div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px;">
        <span style="color:var(--text);">${fullT}${bqTag} × ${it.qty}</span>
        <b style="color:var(--text);">${it.price * it.qty} ₽</b>
      </div>`;
    }).join('');
  }

  const sSub = document.getElementById('summary-subtotal-val');
  if (sSub) sSub.innerText = `${subtotal} ₽`;
  const sDel = document.getElementById('summary-delivery-cost-val');
  if (sDel) sDel.innerText = `${delCost} ₽`;
  const sTot = document.getElementById('summary-total-amount-val');
  if (sTot) sTot.innerText = `${totalAmount} ₽`;

  closeOrderModal();
  const summaryModal = document.getElementById('order-summary-modal');
  if (summaryModal) {
    summaryModal.classList.add('open');
    if (typeof syncModalDepthState === 'function') syncModalDepthState();
  }
}
window.proceedToOrderSummary = proceedToOrderSummary;

function closeOrderSummaryModal() {
  try {
    triggerHaptic('light');
  } catch (e) {}
  const m = document.getElementById('order-summary-modal');
  if (m) {
    m.classList.remove('open');
    if (typeof syncModalDepthState === 'function') syncModalDepthState();
  }
}
window.closeOrderSummaryModal = closeOrderSummaryModal;

async function confirmAndSubmitFinalOrder() {
  if (!window.pendingOrderPayload) return;
  try {
    triggerHaptic('medium');
  } catch (e) {}
  toast("Создание заказа...");

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(window.pendingOrderPayload)
    });
    const data = await res.json();

    if (data.success) {
      window.currentPaymentOrderId = data.order_id;
      window.currentPaymentAmount = data.total_amount;
      closeOrderSummaryModal();
      if (typeof clearCartStorage === 'function') clearCartStorage();
      if (typeof updateCartUI === 'function') updateCartUI();

      if (window.pendingOrderPayload.need_assembly) {
        const asmId = document.getElementById('asm-modal-order-id');
        if (asmId) asmId.innerText = data.order_id;
        const asmM = document.getElementById('assembly-call-modal');
        if (asmM) {
          asmM.classList.add('open');
          if (typeof syncModalDepthState === 'function') syncModalDepthState();
        }
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
  try {
    triggerHaptic('light');
  } catch (e) {}
  const m = document.getElementById('assembly-call-modal');
  if (m) {
    m.classList.remove('open');
    if (typeof syncModalDepthState === 'function') syncModalDepthState();
  }
  navigateTab('profile', null);
}
window.closeAssemblyModal = closeAssemblyModal;

function openPaymentModal(orderId, amount, orderCreatedAt = null) {
  try {
    triggerHaptic('medium');
  } catch (e) {}
  window.currentPaymentOrderId = orderId;
  window.currentPaymentAmount = amount;

  const tEl = document.getElementById('pay-modal-order-id');
  if (tEl) tEl.innerText = `Оплата ${orderId}`;
  const aEl = document.getElementById('pay-modal-amount');
  if (aEl) aEl.innerText = `${amount} ₽`;

  const cfg = window.SERVER_CONFIG || {};
  const sbpBtn = document.getElementById('pay-sbp-btn');
  if (sbpBtn && cfg.sbp_url) {
    sbpBtn.href = cfg.sbp_url;
  }

  const qrImg = document.getElementById('sbp-qr-image-tag');
  if (qrImg && cfg.sbp_qr) {
    qrImg.src = cfg.sbp_qr;
  }

  startPaymentTimer(orderCreatedAt);
  const m = document.getElementById('payment-modal');
  if (m) {
    m.classList.add('open');
    if (typeof syncModalDepthState === 'function') syncModalDepthState();
  }
}
window.openPaymentModal = openPaymentModal;

function closePaymentModal() {
  try {
    triggerHaptic('light');
  } catch (e) {}
  clearInterval(window.paymentTimerInterval);
  const m = document.getElementById('payment-modal');
  if (m) {
    m.classList.remove('open');
    if (typeof syncModalDepthState === 'function') syncModalDepthState();
  }
}
window.closePaymentModal = closePaymentModal;

function startPaymentTimer(createdDateTimeStr) {
  clearInterval(window.paymentTimerInterval);
  const timerVal = document.getElementById('pay-timer-val');
  if (!timerVal) return;

  const nowTs = Date.now();
  const createdTs = createdDateTimeStr ? parseOrderDateToTs(createdDateTimeStr) : nowTs;
  const elapsedSec = Math.floor((nowTs - createdTs) / 1000);
  let leftSec = (15.5 * 60) - elapsedSec;

  if (leftSec <= 0) {
    timerVal.innerText = "00:00";
    closePaymentModal();
    toast("Время оплаты заказа истекло");
    return;
  }

  function update() {
    if (leftSec <= 0) {
      clearInterval(window.paymentTimerInterval);
      timerVal.innerText = "00:00";
      closePaymentModal();
      toast("Время оплаты заказа истекло");
      return;
    }
    const m = Math.floor(leftSec / 60);
    const s = Math.floor(leftSec % 60);
    timerVal.innerText = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    leftSec--;
  }

  update();
  window.paymentTimerInterval = setInterval(update, 1000);
}

function copyPaymentAmount() {
  try {
    triggerHaptic('selection');
  } catch (e) {}
  if (!window.currentPaymentAmount) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(String(window.currentPaymentAmount));
    toast("Сумма скопирована в буфер!");
  }
}
window.copyPaymentAmount = copyPaymentAmount;

async function confirmPaymentByClient() {
  if (!window.currentPaymentOrderId) return;
  try {
    triggerHaptic('medium');
  } catch (e) {}
  toast("Отправка подтверждения...");

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: "client_paid", order_id: window.currentPaymentOrderId })
    });
    const d = await res.json();
    if (d.success) {
      closePaymentModal();

      const succId = document.getElementById('success-modal-order-id');
      if (succId) succId.innerText = `Заказ: ${window.currentPaymentOrderId}`;
      const succM = document.getElementById('payment-success-modal');
      if (succM) {
        succM.classList.add('open');
        if (typeof syncModalDepthState === 'function') syncModalDepthState();
      }

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
  try {
    triggerHaptic('light');
  } catch (e) {}
  const m = document.getElementById('payment-success-modal');
  if (m) {
    m.classList.remove('open');
    if (typeof syncModalDepthState === 'function') syncModalDepthState();
  }
}
window.closePaymentSuccessModal = closePaymentSuccessModal;

function closePaymentSuccessModalAndGoOrders() {
  closePaymentSuccessModal();
  navigateTab('profile', null);
}
window.closePaymentSuccessModalAndGoOrders = closePaymentSuccessModalAndGoOrders;
