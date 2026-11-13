let selectedDeliveryTimeValue = '';
let checkoutSaveForNext = false;

function generateDynamicDeliveryTimeSlots() {
  const nowParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const curHour = Number(nowParts.find(part => part.type === 'hour')?.value || 0);
  const curMin = Number(nowParts.find(part => part.type === 'minute')?.value || 0);
  const optionsBox = document.getElementById('time-select-options');
  const displaySpan = document.getElementById('selected-time-display');
  if (!optionsBox || !displaySpan) return;

  let slots = [];
  const nowMinute = curHour * 60 + curMin;
  const todayWindows = [[10, 12], [12, 14], [14, 16], [16, 18], [18, 20]];
  if (nowMinute >= 9 * 60 && nowMinute < 18 * 60 + 30) {
    slots.push({ label: 'Как можно скорее (1–2 часа)', val: 'Как можно скорее (1-2 часа)' });
  }
  todayWindows.forEach(([start, end]) => {
    if (nowMinute < end * 60) {
      const interval = `${String(start).padStart(2, '0')}:00 - ${String(end).padStart(2, '0')}:00`;
      slots.push({ label: `Сегодня, ${interval.replace(' - ', '–')}`, val: `Сегодня ${interval}` });
    }
  });
  todayWindows.forEach(([start, end]) => {
    const interval = `${String(start).padStart(2, '0')}:00 - ${String(end).padStart(2, '0')}:00`;
    slots.push({ label: `Завтра, ${interval.replace(' - ', '–')}`, val: `Завтра ${interval}` });
  });
  slots.push({ label: 'Другой день (согласовать)', val: 'Другой день (согласовать)' });

  optionsBox.innerHTML = slots.map(s => `
    <div class="custom-select-option" onclick="selectDeliveryTime('${s.val}', '${s.label}')">${s.label}</div>
  `).join('');
  selectDeliveryTime(slots[0].val, slots[0].label);
}

function selectDeliveryTime(val, label = val) {
  triggerHaptic('selection');
  selectedDeliveryTimeValue = val;
  document.getElementById('selected-time-display').innerText = label;
  document.getElementById('time-select-box').classList.remove('open');
  saveCheckoutDraft();
}

function onAddressInput(query) {
  clearTimeout(suggestDebounceTimer);
  const box = document.getElementById('ord-suggest-list');
  selectedGeoAddress = null;

  if (!query || query.trim().length < 2) { 
    box.style.display = 'none'; 
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
          count: 6
        })
      });
      const data = await res.json();
      const items = data.suggestions || [];
      if (!items.length) { box.style.display = 'none'; return; }
      box.innerHTML = items.map((s, idx) => `
        <div class="suggest-item" onclick="selectSuggestion(${idx})">${s.value}</div>
      `).join('');
      box.style.display = 'block';
      window.lastSuggestions = items;
    } catch (e) {}
  }, 250);
}

function selectSuggestion(idx) {
  triggerHaptic('selection');
  const s = window.lastSuggestions[idx];
  if (!s) return;

  document.getElementById('ord-suggest-input').value = s.value;
  document.getElementById('ord-suggest-list').style.display = 'none';

  const lat = parseFloat(s.data?.geo_lat);
  const lon = parseFloat(s.data?.geo_lon);
  const hasHouse = !!s.data?.house;

  if (!hasHouse || !lat || !lon) {
    selectedGeoAddress = null;
    document.getElementById('delivery-calc-badge').innerHTML = `⚠️ Выберите вариант с точным номером дома из подсказок`;
    currentDeliveryCost = 0;
    recalcOrderFinalTotal();
    toast("Выберите точный адрес с номером дома");
    return;
  }

  selectedGeoAddress = s;

  const straightDist = calcHaversineDistance(STORE_LAT, STORE_LON, lat, lon);
  const roadDist = straightDist * 1.25;
  currentDistanceKm = roadDist;

  if (roadDist <= 2.0) {
    currentDeliveryCost = 350;
  } else {
    currentDeliveryCost = Math.round(350 + ((roadDist - 2.0) * 40));
  }

  document.getElementById('delivery-calc-badge').innerHTML = 
    `🚚 <b>Доставка: ~${roadDist.toFixed(1)} км — ${currentDeliveryCost} ₽</b>`;

  recalcOrderFinalTotal();
}

function recalcOrderFinalTotal() {
  const delivery = orderDelType === 'delivery' ? currentDeliveryCost : 0;
  currentFinalOrderAmount = currentFlowersSubtotal + delivery;

  document.getElementById('order-subtotal-val').innerText = `${currentFlowersSubtotal} ₽`;
  document.getElementById('order-delivery-val').innerText = `${delivery} ₽`;
  document.getElementById('order-final-val').innerText = `${currentFinalOrderAmount} ₽`;
}

function openOrderModal() {
  triggerHaptic('selection');
  generateDynamicDeliveryTimeSlots();
  const savedBox = document.getElementById('order-saved-address-container');
  const pillsBox = document.getElementById('order-saved-address-pills');
  if (savedAddresses && savedAddresses.length > 0) {
    pillsBox.innerHTML = savedAddresses.map((a, idx) => `
      <div class="addr-pill" onclick="applySavedAddressToOrder(${idx}, this)">🏠 ${a.label}</div>
    `).join('');
    savedBox.style.display = 'block';
  } else {
    savedBox.style.display = 'none';
  }
  restoreCheckoutDraft();
  recalcOrderFinalTotal();
  document.getElementById('order-modal').classList.add('open');
}

function closeOrderModal() { 
  triggerHaptic('light');
  document.getElementById('order-modal').classList.remove('open'); 
}

function applySavedAddressToOrder(idx, btn) {
  triggerHaptic('selection');
  document.querySelectorAll('.addr-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');

  const a = savedAddresses[idx];
  document.getElementById('ord-suggest-input').value = a.address;
  document.getElementById('ord-entrance').value = a.entrance || '';
  document.getElementById('ord-floor').value = a.floor || '';
  document.getElementById('ord-apt').value = a.apt || '';
  document.getElementById('ord-intercom').value = a.intercom || '';

  if (a.lat && a.lon) {
    selectedGeoAddress = {
      value: a.address,
      data: { house: "1", geo_lat: a.lat, geo_lon: a.lon }
    };

    const straightDist = calcHaversineDistance(STORE_LAT, STORE_LON, parseFloat(a.lat), parseFloat(a.lon));
    const roadDist = straightDist * 1.25;
    currentDistanceKm = roadDist;

    if (roadDist <= 2.0) {
      currentDeliveryCost = 350;
    } else {
      currentDeliveryCost = Math.round(350 + ((roadDist - 2.0) * 40));
    }

    document.getElementById('delivery-calc-badge').innerHTML = 
      `🚚 <b>Доставка: ~${roadDist.toFixed(1)} км — ${currentDeliveryCost} ₽</b>`;
    recalcOrderFinalTotal();
  } else {
    onAddressInput(a.address);
  }
  saveCheckoutDraft();
}

function setDeliveryType(type) {
  triggerHaptic('selection');
  orderDelType = type;
  document.getElementById('btn-del').classList.toggle('active', type === 'delivery');
  document.getElementById('btn-pick').classList.toggle('active', type === 'pickup');
  document.getElementById('delivery-extra-fields').style.display = type === 'delivery' ? 'block' : 'none';
  document.getElementById('pickup-extra-fields').style.display = type === 'pickup' ? 'block' : 'none';
  recalcOrderFinalTotal();
  saveCheckoutDraft();
}

function setRecipientType(type) {
  triggerHaptic('selection');
  orderRecType = type;
  document.getElementById('btn-rec-self').classList.toggle('active', type === 'self');
  document.getElementById('btn-rec-other').classList.toggle('active', type === 'other');
  document.getElementById('other-rec-fields').style.display = type === 'other' ? 'block' : 'none';
  saveCheckoutDraft();
}

function checkoutStorageKey(kind) {
  return `flw_checkout_${kind}_${String(userId || 'guest')}`;
}

function readCheckoutFormState() {
  const value = id => document.getElementById(id)?.value || '';
  return {
    deliveryType: orderDelType,
    recipientType: orderRecType,
    recipientName: value('ord-rec-name'),
    recipientPhone: value('ord-rec-phone'),
    address: value('ord-suggest-input'),
    entrance: value('ord-entrance'),
    floor: value('ord-floor'),
    apartment: value('ord-apt'),
    intercom: value('ord-intercom'),
    courierComment: value('ord-comment'),
    shopComment: value('ord-shop-comment'),
    deliveryTime: selectedDeliveryTimeValue,
    deliveryLabel: document.getElementById('selected-time-display')?.innerText || '',
    selectedGeoAddress,
    deliveryCost: currentDeliveryCost,
    distanceKm: currentDistanceKm,
    saveAddress: ordSaveAddrChecked,
    saveForNext: checkoutSaveForNext
  };
}

function saveCheckoutDraft() {
  const modal = document.getElementById('order-modal');
  if (!modal || !modal.classList.contains('open')) return;
  try { localStorage.setItem(checkoutStorageKey('draft'), JSON.stringify(readCheckoutFormState())); } catch (e) {}
}

function applyCheckoutDraft(draft) {
  if (!draft) return;
  const set = (id, field) => { const el = document.getElementById(id); if (el) el.value = draft[field] || ''; };
  set('ord-rec-name', 'recipientName');
  set('ord-rec-phone', 'recipientPhone');
  set('ord-suggest-input', 'address');
  set('ord-entrance', 'entrance');
  set('ord-floor', 'floor');
  set('ord-apt', 'apartment');
  set('ord-intercom', 'intercom');
  set('ord-comment', 'courierComment');
  set('ord-shop-comment', 'shopComment');
  setDeliveryType(draft.deliveryType === 'pickup' ? 'pickup' : 'delivery');
  setRecipientType(draft.recipientType === 'other' ? 'other' : 'self');
  selectedGeoAddress = draft.selectedGeoAddress || null;
  currentDeliveryCost = Number(draft.deliveryCost) || 0;
  currentDistanceKm = Number(draft.distanceKm) || 0;
  selectedDeliveryTimeValue = draft.deliveryTime || '';
  const timeLabel = document.getElementById('selected-time-display');
  if (timeLabel && draft.deliveryLabel) timeLabel.innerText = draft.deliveryLabel;
  ordSaveAddrChecked = !!draft.saveAddress;
  const saveAddressUi = document.getElementById('ord-save-addr-checkbox-ui');
  if (saveAddressUi) {
    saveAddressUi.classList.toggle('checked', ordSaveAddrChecked);
    saveAddressUi.innerText = ordSaveAddrChecked ? '✓' : '';
  }
  checkoutSaveForNext = !!draft.saveForNext;
  const saveNextUi = document.getElementById('checkout-save-next');
  if (saveNextUi) {
    saveNextUi.classList.toggle('checked', checkoutSaveForNext);
    saveNextUi.innerText = checkoutSaveForNext ? '✓' : '';
  }
  recalcOrderFinalTotal();
}

function restoreCheckoutDraft() {
  let draft = null;
  try {
    const draftRaw = localStorage.getItem(checkoutStorageKey('draft'));
    if (draftRaw) draft = JSON.parse(draftRaw);
    else {
      const nextRaw = localStorage.getItem(checkoutStorageKey('next'));
      if (nextRaw) {
        draft = JSON.parse(nextRaw);
        localStorage.removeItem(checkoutStorageKey('next'));
      }
    }
  } catch (e) {}
  if (draft) applyCheckoutDraft(draft);
  else {
    checkoutSaveForNext = false;
    selectedDeliveryTimeValue = '';
    const saveNextUi = document.getElementById('checkout-save-next');
    if (saveNextUi) { saveNextUi.classList.remove('checked'); saveNextUi.innerText = ''; }
  }
}

function toggleCheckoutSaveNext() {
  checkoutSaveForNext = !checkoutSaveForNext;
  const checkbox = document.getElementById('checkout-save-next');
  if (checkbox) {
    checkbox.classList.toggle('checked', checkoutSaveForNext);
    checkbox.innerText = checkoutSaveForNext ? '✓' : '';
  }
  saveCheckoutDraft();
}
window.toggleCheckoutSaveNext = toggleCheckoutSaveNext;

function openOrderConfirmation() {
  saveCheckoutDraft();
  const lines = [];
  const recipient = orderRecType === 'other'
    ? `${document.getElementById('ord-rec-name')?.value || ''} (${document.getElementById('ord-rec-phone')?.value || ''})`
    : `${currentUser?.name || 'Клиент'} (${currentUser?.phone || ''})`;
  lines.push(`Получатель: ${recipient}`);
  lines.push(`Способ получения: ${orderDelType === 'delivery' ? 'Доставка' : 'Самовывоз'}`);
  if (orderDelType === 'delivery') {
    lines.push(`Адрес: ${document.getElementById('ord-suggest-input')?.value || 'не указан'}`);
    lines.push(`Время: ${document.getElementById('selected-time-display')?.innerText || ''}`);
    const courier = document.getElementById('ord-comment')?.value.trim();
    if (courier) lines.push(`Комментарий курьеру: ${courier}`);
  }
  const shopComment = document.getElementById('ord-shop-comment')?.value.trim();
  if (shopComment) lines.push(`Комментарий салону: ${shopComment}`);
  const items = Object.entries(cart).map(([key, qty]) => {
    const [id, unit, variant, color] = key.split(':::');
    const item = catalog.find(entry => String(entry.id) === String(id));
    if (!item) return null;
    return `• ${formatFullItemTitle(item.title, unit || item.unit, variant, color)} × ${qty}`;
  }).filter(Boolean);
  lines.push('', 'Состав:', ...items, '', `Итого: ${currentFinalOrderAmount} ₽`);
  const summary = document.getElementById('order-confirm-summary');
  if (summary) summary.textContent = lines.join('\n');
  document.getElementById('order-confirm-modal')?.classList.add('open');
}
window.openOrderConfirmation = openOrderConfirmation;

function closeOrderConfirmation() {
  document.getElementById('order-confirm-modal')?.classList.remove('open');
}
window.closeOrderConfirmation = closeOrderConfirmation;

function resetCheckoutForm() {
  ['ord-rec-name','ord-rec-phone','ord-suggest-input','ord-entrance','ord-floor','ord-apt','ord-intercom','ord-comment','ord-shop-comment']
    .forEach(id => { const input = document.getElementById(id); if (input) input.value = ''; });
  orderDelType = 'delivery';
  orderRecType = 'self';
  selectedGeoAddress = null;
  currentDeliveryCost = 0;
  currentDistanceKm = 0;
  selectedDeliveryTimeValue = '';
  ordSaveAddrChecked = false;
  checkoutSaveForNext = false;
  document.getElementById('ord-save-addr-checkbox-ui')?.classList.remove('checked');
  const saveNextUi = document.getElementById('checkout-save-next');
  if (saveNextUi) { saveNextUi.classList.remove('checked'); saveNextUi.innerText = ''; }
  setDeliveryType('delivery');
  setRecipientType('self');
  generateDynamicDeliveryTimeSlots();
}

async function submitFinalOrder() {
  triggerHaptic('medium');
  const needAssembly = isAssemblyMode && Object.values(cartAssemblyItems).some(Boolean);

  let orderItems = [];
  Object.entries(cart).forEach(([cartKey, qty]) => {
    const [id, selectedUnit, selectedVar, selectedColor] = cartKey.split(':::');
    const item = catalog.find(i => String(i.id) === String(id));
    if (item) {
      orderItems.push({
        id: item.id,
        title: item.title,
        unit: selectedUnit || item.unit || "1 шт.",
        variant: selectedVar || "",
        color: selectedColor || "",
        price: item.price,
        qty: qty,
        in_bouquet: needAssembly && !!cartAssemblyItems[cartKey]
      });
    }
  });

  let recInfo = "";
  if (orderRecType === 'other') {
    const rName = document.getElementById('ord-rec-name').value.trim();
    const rPhone = document.getElementById('ord-rec-phone').value.trim();
    if (!rName || rPhone.length < 17) {
      toast("Укажите имя и телефон получателя полностью");
      return;
    }
    recInfo = `${rName} (${rPhone})`;
  }

  let fullAddr = "";
  let dTime = "";
  if (orderDelType === 'delivery') {
    const street = document.getElementById('ord-suggest-input').value.trim();
    const ent = document.getElementById('ord-entrance').value.trim();
    const flr = document.getElementById('ord-floor').value.trim();
    const apt = document.getElementById('ord-apt').value.trim();
    const intc = document.getElementById('ord-intercom').value.trim();
    const comm = document.getElementById('ord-comment').value.trim();

    if (!street) { toast("Укажите улицу и номер дома"); return; }

    if (!selectedGeoAddress || !selectedGeoAddress.data?.house || !selectedGeoAddress.data?.geo_lat || !selectedGeoAddress.data?.geo_lon) {
      toast("Выберите точный адрес с номером дома из подсказок");
      return;
    }

    if (!ent || !flr || !apt || !intc) {
      toast("Заполните все поля адреса: подъезд, этаж, квартиру и домофон");
      return;
    }

    fullAddr = `${street}, под. ${ent}, эт. ${flr}, кв. ${apt} (домофон: ${intc})${comm ? ' [курьеру: '+comm+']' : ''}`;
    dTime = selectedDeliveryTimeValue || document.getElementById('selected-time-display').innerText;

    if (ordSaveAddrChecked && savedAddresses.length < 3) {
      savedAddresses.push({
        label: "Адрес " + (savedAddresses.length + 1),
        address: street,
        entrance: ent,
        floor: flr,
        apt: apt,
        intercom: intc,
        lat: selectedGeoAddress.data.geo_lat,
        lon: selectedGeoAddress.data.geo_lon
      });
      syncSavedAddresses();
    }
  } else {
    fullAddr = "Самовывоз: Георгиевский пр-т, 37к2";
    dTime = "Самовывоз (по готовности)";
  }

  const shopComm = document.getElementById('ord-shop-comment').value.trim();

  toast("Создание заказа...");
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: "create_order",
        user_id: userId,
        user_name: currentUser.name,
        user_phone: currentUser.phone,
        delivery_type: orderDelType,
        recipient_info: recInfo,
        address: fullAddr,
        delivery_time: dTime,
        shop_comment: shopComm,
        delivery_cost: orderDelType === 'delivery' ? currentDeliveryCost : 0,
        items_json: JSON.stringify(orderItems),
        total_amount: currentFinalOrderAmount,
        need_assembly: needAssembly
      })
    });
    const data = await res.json();
    if (data.success) {
      triggerHaptic('success');
      clearCartStorage();
      const asmCheck = document.getElementById('cart-assembly-checkbox-ui');
      if (asmCheck) {
        asmCheck.classList.remove('checked');
        asmCheck.innerText = '';
      }
      updateCartUI();
      renderCatalog(filteredCatalog);
      closeOrderConfirmation();
      const nextCheckout = readCheckoutFormState();
      if (checkoutSaveForNext) localStorage.setItem(checkoutStorageKey('next'), JSON.stringify(nextCheckout));
      else localStorage.removeItem(checkoutStorageKey('next'));
      localStorage.removeItem(checkoutStorageKey('draft'));
      closeOrderModal();

      if (needAssembly) {
        openAssemblyCallModal(data.order_id);
      } else {
        openPaymentModal(data.order_id, currentFinalOrderAmount, new Date().toISOString());
      }
      resetCheckoutForm();
    } else {
      toast(data.error || 'Не удалось оформить заказ');
    }
  } catch (e) {
    toast("Ошибка связи");
  }
}

function openAssemblyCallModal(orderId) {
  document.getElementById('asm-modal-order-id').innerText = orderId;
  document.getElementById('assembly-call-modal').classList.add('open');
}

function closeAssemblyModal() {
  triggerHaptic('light');
  document.getElementById('assembly-call-modal').classList.remove('open');
  navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
}

function openPaymentModal(orderId, amount, createdAtStr = null) {
  activePaymentOrderId = orderId;
  document.getElementById('pay-modal-order-id').innerText = `Оплата ${orderId}`;
  document.getElementById('pay-modal-amount').innerText = `${amount} ₽`;

  let durationSec = 15 * 60 + 10;
  if (createdAtStr) {
    const createdTs = parseOrderDateToTs(createdAtStr);
    if (createdTs) {
      const elapsedSec = Math.floor((Date.now() - createdTs) / 1000);
      durationSec = Math.max(0, (15 * 60 + 10) - elapsedSec);
    }
  }

  startPaymentTimer(durationSec, orderId);
  document.getElementById('payment-modal').classList.add('open');
}

function closePaymentModal() {
  triggerHaptic('light');
  clearInterval(paymentTimerInterval);
  document.getElementById('payment-modal').classList.remove('open');
}

function setPaymentActiveState(isActive) {
  const sbpBtn = document.getElementById('pay-sbp-btn');
  const confirmBtn = document.querySelector('#payment-modal button.btn-metro[onclick*="confirmPaymentByClient"]');
  const timerBox = document.getElementById('pay-timer-box');

  if (!isActive) {
    if (sbpBtn) {
      sbpBtn.style.pointerEvents = 'none';
      sbpBtn.style.opacity = '0.4';
      sbpBtn.innerText = 'Срок оплаты истёк';
    }
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.4';
      confirmBtn.style.cursor = 'not-allowed';
    }
    if (timerBox) {
      timerBox.style.background = 'rgba(185,28,28,0.25)';
      timerBox.innerHTML = '❌ <b>Заказ отменён (время вышло)</b>';
    }
  } else {
    if (sbpBtn) {
      sbpBtn.style.pointerEvents = 'auto';
      sbpBtn.style.opacity = '1';
      sbpBtn.innerText = '💳 Оплатить через СБП';
    }
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.style.cursor = 'pointer';
    }
  }
}

function startPaymentTimer(durationSec, orderId) {
  clearInterval(paymentTimerInterval);
  let timer = durationSec;
  const display = document.getElementById('pay-timer-val');

  if (timer <= 0) {
    if (display) display.textContent = "00:00";
    setPaymentActiveState(false);
    toast("Время оплаты истекло. Заказ отменен");
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: "cancel_order_timeout", order_id: orderId })
    }).catch(() => {});
    return;
  }

  setPaymentActiveState(true);

  const updateDisplay = () => {
    let m = parseInt(timer / 60, 10);
    let s = parseInt(timer % 60, 10);
    m = m < 10 ? "0" + m : m;
    s = s < 10 ? "0" + s : s;
    if (display) display.textContent = m + ":" + s;
  };

  updateDisplay();

  paymentTimerInterval = setInterval(() => {
    if (--timer <= 0) {
      clearInterval(paymentTimerInterval);
      if (display) display.textContent = "00:00";
      setPaymentActiveState(false);
      toast("Время оплаты истекло. Заказ отменен");
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: "cancel_order_timeout", order_id: orderId })
      }).catch(() => {});
      loadUserOrders();
    } else {
      updateDisplay();
    }
  }, 1000);
}

function copyPaymentAmount() {
  triggerHaptic('light');
  const el = document.getElementById('pay-modal-amount');
  const txt = el ? el.innerText.replace(/[^\d]/g, '') : '';
  if (txt && navigator.clipboard) {
    navigator.clipboard.writeText(txt);
    toast(`Сумма ${txt} ₽ скопирована`);
  }
}

async function confirmPaymentByClient() {
  if (!activePaymentOrderId) return;
  triggerHaptic('medium');
  toast("Отправка подтверждения...");
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: "client_paid", order_id: activePaymentOrderId })
    });
    const result = await res.json();
    if (!result.success) { toast(result.error || 'Не удалось отправить подтверждение'); return; }
    triggerHaptic('success');
    closePaymentModal();
    showPaymentWaitModal();
  } catch (e) {
    toast("Сбой отправки");
  }
}

function showPaymentWaitModal() {
  const modal = document.getElementById('payment-wait-modal');
  const box = modal?.querySelector('.payment-wait-confetti');
  if (!modal || !box) return;
  box.replaceChildren();
  const colors = ['#e5c158', '#0d9f67', '#f472b6', '#60a5fa', '#fb923c'];
  for (let i = 0; i < 54; i++) {
    const piece = document.createElement('span');
    piece.style.left = `${(i * 37) % 100}%`;
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDelay = `${(i % 15) * 35}ms`;
    piece.style.transform = `rotate(${(i * 61) % 360}deg)`;
    box.appendChild(piece);
  }
  modal.classList.add('open');
}

function openOrdersFromPaymentWait() {
  document.getElementById('payment-wait-modal')?.classList.remove('open');
  navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
}
window.openOrdersFromPaymentWait = openOrdersFromPaymentWait;

function initCheckoutDraftAutosave() {
  ['ord-rec-name','ord-rec-phone','ord-suggest-input','ord-entrance','ord-floor','ord-apt','ord-intercom','ord-comment','ord-shop-comment']
    .forEach(id => document.getElementById(id)?.addEventListener('input', saveCheckoutDraft));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCheckoutDraftAutosave);
else initCheckoutDraftAutosave();

