let orderDelType = 'delivery';
let orderRecType = 'self';
let ordSaveAddrChecked = false;

let selectedGeoAddress = null;
let currentDeliveryCost = 0;
let currentFinalOrderAmount = 0;
let activePaymentOrderId = null;
let paymentTimerInterval = null;
let suggestDebounceTimer = null;

function toggleOrderSaveAddressCheckbox() {
  ordSaveAddrChecked = !ordSaveAddrChecked;
  const el = document.getElementById('ord-save-addr-checkbox-ui');
  el.classList.toggle('checked', ordSaveAddrChecked);
  el.innerText = ordSaveAddrChecked ? '✓' : '';
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

function onAddressInput(query) {
  clearTimeout(suggestDebounceTimer);
  const box = document.getElementById('ord-suggest-list');
  selectedGeoAddress = null; // Сбрасываем выбранную точку при ручном вводе

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

// Выбор подсказки: строгий расчет геопозиции по тарифу 350 ₽ (до 2 км) + 40 ₽/км
function selectSuggestion(idx) {
  const s = window.lastSuggestions[idx];
  if (!s) return;

  document.getElementById('ord-suggest-input').value = s.value;
  document.getElementById('ord-suggest-list').style.display = 'none';

  const lat = parseFloat(s.data.geo_lat);
  const lon = parseFloat(s.data.geo_lon);
  const house = s.data.house;

  // Строгая проверка: выбран ли точный дом
  if (!house || !lat || !lon) {
    selectedGeoAddress = null;
    document.getElementById('delivery-calc-badge').innerHTML = `⚠️ <b>Выберите точный номер дома из списка подсказок</b>`;
    document.getElementById('delivery-calc-badge').style.borderColor = 'var(--red)';
    document.getElementById('delivery-calc-badge').style.color = 'var(--red)';
    currentDeliveryCost = 0;
    recalcOrderFinalTotal();
    return;
  }

  selectedGeoAddress = {
    value: s.value,
    lat: lat,
    lon: lon
  };

  const storeLat = SERVER_CONFIG.store_lat || 55.966987;
  const storeLon = SERVER_CONFIG.store_lon || 37.151059;
  const straightDist = calcHaversineDistance(storeLat, storeLon, lat, lon);
  const roadDist = straightDist * 1.25;

  // Новый тариф: 350 ₽ базовый (до 2 км) + 40 ₽ за каждый последующий километр
  if (roadDist <= 2.0) {
    currentDeliveryCost = 350;
  } else {
    currentDeliveryCost = Math.round(350 + ((roadDist - 2.0) * 40));
  }

  const badge = document.getElementById('delivery-calc-badge');
  badge.style.borderColor = 'var(--border-accent)';
  badge.style.color = 'var(--cyan)';
  badge.innerHTML = `🚚 <b>Доставка: ~${roadDist.toFixed(1)} км — ${currentDeliveryCost} ₽</b>`;

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

function closeOrderModal() {
  document.getElementById('order-modal').classList.remove('open');
}

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
    selectedGeoAddress = { value: a.address, lat: a.lat, lon: a.lon };
    const storeLat = SERVER_CONFIG.store_lat || 55.966987;
    const storeLon = SERVER_CONFIG.store_lon || 37.151059;
    const straightDist = calcHaversineDistance(storeLat, storeLon, a.lat, a.lon);
    const roadDist = straightDist * 1.25;

    currentDeliveryCost = (roadDist <= 2.0) ? 350 : Math.round(350 + ((roadDist - 2.0) * 40));
    const badge = document.getElementById('delivery-calc-badge');
    badge.style.borderColor = 'var(--border-accent)';
    badge.style.color = 'var(--cyan)';
    badge.innerHTML = `🚚 <b>Доставка: ~${roadDist.toFixed(1)} км — ${currentDeliveryCost} ₽</b>`;
    recalcOrderFinalTotal();
  } else {
    onAddressInput(a.address);
  }
}

// Оформление заказа со строгой геовалидацией
async function submitFinalOrder() {
  const needAssembly = isAssemblyMode && Object.values(cartAssemblyItems).some(Boolean);

  let orderItems = [];
  Object.entries(cart).forEach(([cartKey, qty]) => {
    const [id, unit, variant, color] = cartKey.split(':::');
    const item = catalog.find(i => String(i.id) === String(id));
    if (item) {
      orderItems.push({
        id: item.id,
        title: item.title,
        unit: unit || item.unit || "1 шт.",
        variant: variant || "",
        color: color || "",
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

    if (!street) { toast("Укажите адрес доставки"); return; }
    if (!selectedGeoAddress || !selectedGeoAddress.lat || !selectedGeoAddress.lon) {
      toast("Выберите точный номер дома из выпадающего списка подсказок");
      return;
    }
    if (!ent || !flr || !apt || !intc) {
      toast("Заполните все поля адреса: подъезд, этаж, квартиру и домофон");
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
        lat: selectedGeoAddress.lat,
        lon: selectedGeoAddress.lon
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
        user_name: currentUser ? currentUser.name : "Клиент",
        user_phone: currentUser ? currentUser.phone : "",
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
      document.getElementById('cart-assembly-checkbox-ui').classList.remove('checked');
      document.getElementById('cart-assembly-checkbox-ui').innerText = '';
      updateCartUI();
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

// Окно оплаты СБП: копирование фактической суммы, отображаемой в модалке
function copyPaymentAmount() {
  const amountEl = document.getElementById('pay-modal-amount');
  const txt = amountEl ? amountEl.innerText.replace(/[^\d]/g, '') : "";
  if (txt && navigator.clipboard) {
    navigator.clipboard.writeText(txt);
    toast(`Сумма ${txt} скопирована`);
  }
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

function openAssemblyCallModal(orderId) {
  document.getElementById('asm-modal-order-id').innerText = orderId;
  document.getElementById('assembly-call-modal').classList.add('open');
}

function closeAssemblyModal() {
  document.getElementById('assembly-call-modal').classList.remove('open');
  navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
}

// Прямой вызов приложения Яндекс Go
function openYandexGoDelivery(orderAddress = "") {
  if (orderAddress && navigator.clipboard) {
    navigator.clipboard.writeText(orderAddress);
    toast("Адрес скопирован! Открываем Яндекс Go");
  }
  const lat = SERVER_CONFIG.store_lat || 55.966987;
  const lon = SERVER_CONFIG.store_lon || 37.151059;
  const directAppUrl = `yandexgo://route?start-lat=${lat}&start-lon=${lon}`;
  const webRedirectUrl = `https://3.redirect.appmetrica.yandex.com/route?start-lat=${lat}&start-lon=${lon}&appmetrica_tracking_id=1178268795219780156`;

  // Попытка открыть нативное приложение, затем переход на редирект
  window.location.href = directAppUrl;
  setTimeout(() => {
    if (tg && tg.openLink) tg.openLink(webRedirectUrl);
    else window.open(webRedirectUrl, '_blank');
  }, 400);
}

// Карточка организации в Яндекс Картах
function openYandexOrgCard() {
  const url = SERVER_CONFIG.org_maps_url || "https://yandex.ru/maps/";
  if (tg && tg.openLink) tg.openLink(url);
  else window.open(url, '_blank');
}
