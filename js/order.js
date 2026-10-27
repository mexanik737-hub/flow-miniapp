// Состояние формы оформления заказа
let orderDelType = 'delivery';
let orderRecType = 'self';
let currentDeliveryCost = 400;
let currentFinalOrderAmount = 0;
let ordSaveAddrChecked = false;
let activePaymentOrderId = null;
let paymentTimerInterval = null;
let suggestDebounceTimer = null;

function openOrderModal() {
  if (!Object.keys(cart).length) {
    toast("Корзина пуста");
    return;
  }

  setDeliveryType('delivery');
  setRecipientType('self');
  generateDynamicDeliveryTimeSlots();

  const savedContainer = document.getElementById('order-saved-address-container');
  const savedPills = document.getElementById('order-saved-address-pills');
  if (typeof savedAddresses !== 'undefined' && savedAddresses && savedAddresses.length > 0) {
    savedContainer.style.display = 'block';
    savedPills.innerHTML = savedAddresses.map((a, idx) => `
      <div class="addr-pill" onclick="applySavedAddressToOrder(${idx})">
        ${a.label || 'Адрес ' + (idx + 1)}: ${a.address.split(',')[0]}
      </div>
    `).join('');
  } else {
    savedContainer.style.display = 'none';
  }

  recalcOrderFinalTotal();
  document.getElementById('order-modal').classList.add('open');
}

function closeOrderModal() {
  document.getElementById('order-modal').classList.remove('open');
}

function setDeliveryType(type) {
  orderDelType = type;
  document.getElementById('btn-del').classList.toggle('active', type === 'delivery');
  document.getElementById('btn-pick').classList.toggle('active', type === 'pickup');

  document.getElementById('delivery-extra-fields').style.display = (type === 'delivery') ? 'block' : 'none';
  document.getElementById('pickup-extra-fields').style.display = (type === 'pickup') ? 'block' : 'none';

  recalcOrderFinalTotal();
}

function setRecipientType(type) {
  orderRecType = type;
  document.getElementById('btn-rec-self').classList.toggle('active', type === 'self');
  document.getElementById('btn-rec-other').classList.toggle('active', type === 'other');
  document.getElementById('other-rec-fields').style.display = (type === 'other') ? 'block' : 'none';
}

function toggleOrderSaveAddressCheckbox() {
  ordSaveAddrChecked = !ordSaveAddrChecked;
  const ui = document.getElementById('ord-save-addr-checkbox-ui');
  if (ui) {
    ui.classList.toggle('checked', ordSaveAddrChecked);
    ui.innerText = ordSaveAddrChecked ? '✓' : '';
  }
}

function generateDynamicDeliveryTimeSlots() {
  const optionsBox = document.getElementById('time-select-options');
  const display = document.getElementById('selected-time-display');
  if (!optionsBox) return;

  const now = new Date();
  const currentHour = now.getHours();
  const slots = [];

  for (let h = 10; h <= 19; h++) {
    if (h >= currentHour + 1) {
      slots.push(`Сегодня, ${h}:00 – ${h + 1}:00`);
    }
  }

  slots.push("Завтра, 10:00 – 12:00");
  slots.push("Завтра, 12:00 – 15:00");
  slots.push("Завтра, 15:00 – 18:00");
  slots.push("Завтра, 18:00 – 20:00");

  display.innerText = slots[0];

  optionsBox.innerHTML = slots.map(slot => `
    <div class="custom-select-option" onclick="selectDeliveryTime('${slot}')">${slot}</div>
  `).join('');
}

function selectDeliveryTime(slot) {
  document.getElementById('selected-time-display').innerText = slot;
  document.getElementById('time-select-box').classList.remove('open');
}

function onAddressInput(val) {
  clearTimeout(suggestDebounceTimer);
  const listEl = document.getElementById('ord-suggest-list');

  if (!val || val.trim().length < 2) {
    listEl.style.display = 'none';
    return;
  }

  suggestDebounceTimer = setTimeout(async () => {
    try {
      const token = SERVER_CONFIG.dadata_token;
      if (!token) return;

      const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": "Token " + token
        },
        body: JSON.stringify({
          query: val,
          locations: [
            { kladr_id: "77000000000" },
            { region: "Московская" }
          ],
          count: 5
        })
      });

      const data = await res.json();
      if (!data.suggestions || !data.suggestions.length) {
        listEl.style.display = 'none';
        return;
      }

      listEl.innerHTML = data.suggestions.map((s, idx) => `
        <div class="suggest-item" onclick="selectSuggestion(${idx})">${s.value}</div>
      `).join('');
      listEl.style.display = 'block';
      window._curOrderSuggestions = data.suggestions;
    } catch (e) {
      listEl.style.display = 'none';
    }
  }, 250);
}

function selectSuggestion(idx) {
  const item = window._curOrderSuggestions?.[idx];
  if (!item) return;

  const listEl = document.getElementById('ord-suggest-list');
  const inputEl = document.getElementById('ord-suggest-input');
  inputEl.value = item.value;
  listEl.style.display = 'none';

  const lat = item.data?.geo_lat ? parseFloat(item.data.geo_lat) : null;
  const lon = item.data?.geo_lon ? parseFloat(item.data.geo_lon) : null;

  if (lat && lon) {
    const storeLat = SERVER_CONFIG.store_lat || 55.966987;
    const storeLon = SERVER_CONFIG.store_lon || 37.151059;
    const straightDist = calcHaversineDistance(storeLat, storeLon, lat, lon);
    const roadDist = straightDist * 1.25;

    let cost = 400;
    if (roadDist > 2) {
      cost = 400 + Math.ceil(roadDist - 2) * 45;
    }
    cost = Math.min(cost, 1800);

    currentDeliveryCost = cost;
    const badge = document.getElementById('delivery-calc-badge');
    if (badge) {
      badge.innerHTML = `📍 Расстояние: <b>~${roadDist.toFixed(1)} км</b> | Доставка: <b>${cost} ₽</b>`;
    }
  }

  recalcOrderFinalTotal();
}

function recalcOrderFinalTotal() {
  const delCost = (orderDelType === 'delivery') ? currentDeliveryCost : 0;
  currentFinalOrderAmount = currentFlowersSubtotal + delCost;

  const subTotalEl = document.getElementById('order-subtotal-val');
  const delValEl = document.getElementById('order-delivery-val');
  const finalValEl = document.getElementById('order-final-val');

  if (subTotalEl) subTotalEl.innerText = `${currentFlowersSubtotal} ₽`;
  if (delValEl) delValEl.innerText = (orderDelType === 'delivery') ? `${delCost} ₽` : '0 ₽ (самовывоз)';
  if (finalValEl) finalValEl.innerText = `${currentFinalOrderAmount} ₽`;
}

async function submitFinalOrder() {
  const subtotal = currentFlowersSubtotal;
  if (subtotal <= 0) {
    toast("Корзина пуста");
    return;
  }

  let fullAddress = "";
  if (orderDelType === 'delivery') {
    const street = document.getElementById('ord-suggest-input').value.trim();
    const entrance = document.getElementById('ord-entrance').value.trim();
    const floor = document.getElementById('ord-floor').value.trim();
    const apt = document.getElementById('ord-apt').value.trim();
    const intercom = document.getElementById('ord-intercom').value.trim();

    if (!street || !entrance || !apt) {
      toast("Заполните адрес: улицу, подъезд и квартиру");
      return;
    }

    fullAddress = `${street}, под. ${entrance}, эт. ${floor || '-'}, кв. ${apt}, дом. ${intercom || '-'}`;

    if (ordSaveAddrChecked && typeof syncSavedAddresses === 'function') {
      syncSavedAddresses({
        label: "Адрес доставки",
        address: street,
        entrance, floor, apt, intercom
      });
    }
  } else {
    fullAddress = "Самовывоз: Георгиевский пр-т, 37к2";
  }

  let recipientInfo = "Заказчик лично";
  if (orderRecType === 'other') {
    const rName = document.getElementById('ord-rec-name').value.trim();
    const rPhone = document.getElementById('ord-rec-phone').value.trim();
    if (!rName || !rPhone) {
      toast("Укажите имя и телефон получателя");
      return;
    }
    recipientInfo = `${rName} (${rPhone})`;
  }

  const items = Object.keys(cart).map(k => ({
    id: cart[k].id,
    title: cart[k].title,
    variant: cart[k].variant,
    unit: cart[k].unit,
    price: cart[k].price,
    qty: cart[k].qty,
    in_bouquet: cartAssemblyItems.has(k)
  }));

  const payload = {
    action: "create_order",
    user_id: userId,
    user_name: currentUser?.name || tgFirstName || "Клиент",
    user_phone: currentUser?.phone || "",
    delivery_type: orderDelType,
    recipient_info: recipientInfo,
    address: fullAddress,
    delivery_time: document.getElementById('selected-time-display')?.innerText || "Как можно скорее",
    shop_comment: document.getElementById('ord-shop-comment')?.value.trim() || "",
    delivery_cost: (orderDelType === 'delivery') ? currentDeliveryCost : 0,
    items_json: JSON.stringify(items),
    total_amount: currentFinalOrderAmount,
    need_assembly: isAssemblyMode
  };

  try {
    toast("Оформление заказа...");
    const res = await apiPost(payload);

    if (res && res.success) {
      cart = {};
      cartAssemblyItems.clear();
      isAssemblyMode = false;
      updateCartUI();
      closeOrderModal();

      if (isAssemblyMode || res.status === "Ожидает согласования упаковки") {
        openAssemblyCallModal(res.order_id);
      } else {
        openPaymentModal(res.order_id, res.total_amount);
      }
    } else {
      toast("Сбой оформления заказа. Попробуйте снова");
    }
  } catch (e) {
    toast("Ошибка сети при отправке заказа");
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

function openPaymentModal(orderId, amount) {
  activePaymentOrderId = orderId;
  document.getElementById('pay-modal-order-id').innerText = `Оплата заказа: ${orderId}`;
  document.getElementById('pay-modal-amount').innerText = `${amount} ₽`;
  setPaymentActiveState(true);
  startPaymentTimer(15 * 60, orderId);
  document.getElementById('payment-modal').classList.add('open');
}

function closePaymentModal() {
  clearInterval(paymentTimerInterval);
  document.getElementById('payment-modal').classList.remove('open');
  navigateTab('profile', document.querySelectorAll('.dock-tab')[2]);
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
    apiPost({ action: "cancel_order_timeout", order_id: orderId }).catch(() => {});
    return;
  }

  setPaymentActiveState(true);

  const updateDisplay = () => {
    let m = parseInt(timer / 60, 10);
    let s = parseInt(timer % 60, 10);
    m = m < 10 ? "0" + m : m;
    s = s < 10 ? "0" + s : s;
    if (display) display.textContent = `${m}:${s}`;
  };

  updateDisplay();

  paymentTimerInterval = setInterval(() => {
    if (--timer <= 0) {
      clearInterval(paymentTimerInterval);
      if (display) display.textContent = "00:00";
      setPaymentActiveState(false);
      toast("Время оплаты истекло. Заказ отменен");
      apiPost({ action: "cancel_order_timeout", order_id: orderId }).catch(() => {});
      if (typeof loadUserOrders === 'function') loadUserOrders();
    } else {
      updateDisplay();
    }
  }, 1000);
}

function copyPaymentAmount() {
  const txt = document.getElementById('pay-modal-amount').innerText.replace(/[^\d]/g, '');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt);
    toast(`Сумма ${txt} ₽ скопирована!`);
  }
}

async function confirmPaymentByClient() {
  if (!activePaymentOrderId) return;
  try {
    toast("Отправка подтверждения...");
    const res = await apiPost({ action: "client_paid", order_id: activePaymentOrderId });
    if (res && res.success) {
      toast("Уведомление отправлено флористу!");
      closePaymentModal();
      if (typeof loadUserOrders === 'function') loadUserOrders();
    }
  } catch (e) {
    toast("Ошибка подтверждения оплаты");
  }
}

function openYandexRoute() {
  const lat = SERVER_CONFIG.store_lat || 55.966987;
  const lon = SERVER_CONFIG.store_lon || 37.151059;
  const url = `https://yandex.ru/maps/?rtext=~${lat},${lon}&rtt=auto`;
  if (tg && tg.openLink) tg.openLink(url);
  else window.open(url, '_blank');
}
