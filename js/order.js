function generateDynamicDeliveryTimeSlots() {
  const now = new Date();
  const curHour = now.getHours();
  const curMin = now.getMinutes();
  const optionsBox = document.getElementById('time-select-options');
  const displaySpan = document.getElementById('selected-time-display');


  let slots = [];


  if (curHour < 19) {
    if (curHour >= 9 && curHour < 18 || (curHour === 18 && curMin <= 30)) {
      slots.push({ label: "Как можно скорее (в течение 1–2 часов с учетом сборки)", val: "Как можно скорее (1-2 часа)" });
    }


    if (curHour < 12) {
      slots.push({ label: "Сегодня: 14:00 – 17:00", val: "Сегодня 14:00 - 17:00" });
      slots.push({ label: "Сегодня: 17:00 – 20:00", val: "Сегодня 17:00 - 20:00" });
    } else if (curHour < 15) {
      slots.push({ label: "Сегодня: 15:00 – 18:00", val: "Сегодня 15:00 - 18:00" });
      slots.push({ label: "Сегодня: 18:00 – 20:00", val: "Сегодня 18:00 - 20:00" });
    } else if (curHour < 17) {
      slots.push({ label: "Сегодня: 18:00 – 20:00", val: "Сегодня 18:00 - 20:00" });
    }
  }


  slots.push({ label: "Завтра: 11:00 – 14:00", val: "Завтра 11:00 - 14:00" });
  slots.push({ label: "Завтра: 14:00 – 17:00", val: "Завтра 14:00 - 17:00" });
  slots.push({ label: "Завтра: 17:00 – 20:00", val: "Завтра 17:00 - 20:00" });
  slots.push({ label: "Завтра: в интервале с 10:00 до 20:00", val: "Завтра 10:00 - 20:00" });


  displaySpan.innerText = slots[0].label;
  optionsBox.innerHTML = slots.map(s => `
    <div class="custom-select-option" onclick="selectDeliveryTime('${s.label}')">${s.label}</div>
  `).join('');
}


function selectDeliveryTime(val) {
  document.getElementById('selected-time-display').innerText = val;
  document.getElementById('time-select-box').classList.remove('open');
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
  recalcOrderFinalTotal();
  document.getElementById('order-modal').classList.add('open');
}


function closeOrderModal() { document.getElementById('order-modal').classList.remove('open'); }


function applySavedAddressToOrder(idx, btn) {
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
}


function setDeliveryType(type) {
  orderDelType = type;
  document.getElementById('btn-del').classList.toggle('active', type === 'delivery');
  document.getElementById('btn-pick').classList.toggle('active', type === 'pickup');
  document.getElementById('delivery-extra-fields').style.display = type === 'delivery' ? 'block' : 'none';
  document.getElementById('pickup-extra-fields').style.display = type === 'pickup' ? 'block' : 'none';
  recalcOrderFinalTotal();
}


function setRecipientType(type) {
  orderRecType = type;
  document.getElementById('btn-rec-self').classList.toggle('active', type === 'self');
  document.getElementById('btn-rec-other').classList.toggle('active', type === 'other');
  document.getElementById('other-rec-fields').style.display = type === 'other' ? 'block' : 'none';
}


async function submitFinalOrder() {
  const needAssembly = isAssemblyMode && Object.values(cartAssemblyItems).some(Boolean);


  let orderItems = [];
  Object.entries(cart).forEach(([cartKey, qty]) => {
    const [id, selectedPack, selectedVar, selectedColor] = cartKey.split(':::');
    const item = catalog.find(i => String(i.id) === String(id));
    if (item) {
      orderItems.push({
        id: item.id,
        title: item.title,
        unit: selectedPack || item.unit || "1 шт.",
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
      toast("Выберите точный адрес с номером дома из подсказок DaData");
      return;
    }


    if (!ent || !flr || !apt || !intc) {
      toast("Заполните все поля адреса: подъезд, этаж, квартиру и домофон (если нет — укажите «нет»)");
      return;
    }


    fullAddr = `${street}, под. ${ent}, эт. ${flr}, кв. ${apt} (домофон: ${intc})${comm ? ' [курьеру: '+comm+']' : ''}`;
    dTime = document.getElementById('selected-time-display').innerText;


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
      cart = {};
      cartAssemblyItems = {};
      isAssemblyMode = false;
      localStorage.removeItem('flw_cart');
      localStorage.removeItem('flw_cart_assembly');
      document.getElementById('cart-assembly-checkbox-ui').classList.remove('checked');
      document.getElementById('cart-assembly-checkbox-ui').innerText = '';
      updateCartUI(); // Очищает корзину и тушит красные точки
      renderCatalog(filteredCatalog);
      closeOrderModal();


      if (needAssembly) {
        openAssemblyCallModal(data.order_id);
      } else {
        openPaymentModal(data.order_id, currentFinalOrderAmount, new Date().toISOString());
      }
    }
  } catch (e) {
    toast("Ошибка связи");
  }
}


function openAssemblyCallModal(orderId) {
  document.getElementById('asm-modal-order-id').innerText = orderId;
  document.getElementById('assembly-call-btn').innerText = `📞 Позвонить в салон (${SERVER_CONFIG.shop_phone || ''})`;
  document.getElementById('assembly-call-modal').classList.add('open');
}


function closeAssemblyModal() {
  document.getElementById('assembly-call-modal').classList.remove('open');
  navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
}


function openPaymentModal(orderId, amount, createdAtStr = null) {
  activePaymentOrderId = orderId;
  document.getElementById('pay-modal-order-id').innerText = `Оплата ${orderId}`;
  document.getElementById('pay-modal-amount').innerText = `${amount} ₽`;


  let durationSec = 15 * 60;
  if (createdAtStr) {
    const createdTs = parseOrderDateToTs(createdAtStr);
    if (createdTs) {
      const elapsedSec = Math.floor((Date.now() - createdTs) / 1000);
      durationSec = Math.max(0, (15 * 60) - elapsedSec);
    }
  }


  startPaymentTimer(durationSec, orderId);
  document.getElementById('payment-modal').classList.add('open');
}


function closePaymentModal() {
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
      timerBox.style.background = 'rgba(239,68,68,0.25)';
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
  const el = document.getElementById('pay-modal-amount');
  const txt = el ? el.innerText.replace(/[^\d]/g, '') : '';
  if (txt && navigator.clipboard) {
    navigator.clipboard.writeText(txt);
    toast(`Сумма ${txt} ₽ скопирована`);
  }
}


async function confirmPaymentByClient() {
  if (!activePaymentOrderId) return;
  toast("Отправка подтверждения...");
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: "client_paid", order_id: activePaymentOrderId })
    });
    toast("Оплата отправлена на проверку!");
    closePaymentModal();
    navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
  } catch (e) {
    toast("Сбой отправки");
  }
}
