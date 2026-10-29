function triggerCartCounterBounce() {
  try {
    const counter = document.getElementById('cart-counter');
    if (!counter) return;

    counter.classList.remove('cart-bounce-gold');
    void counter.offsetWidth;
    counter.classList.add('cart-bounce-gold');

    setTimeout(() => {
      counter.classList.remove('cart-bounce-gold');
    }, 600);
  } catch (e) {}
}
window.triggerCartCounterBounce = triggerCartCounterBounce;

function saveCartToStorage() {
  localStorage.setItem('flw_cart', JSON.stringify(cart));
  localStorage.setItem('flw_cart_assembly', JSON.stringify(cartAssemblyItems));
  localStorage.setItem('flw_is_assembly_mode', String(isAssemblyMode));
}
window.saveCartToStorage = saveCartToStorage;

function clearCartStorage() {
  cart = {};
  cartAssemblyItems = {};
  isAssemblyMode = false;
  localStorage.removeItem('flw_cart');
  localStorage.removeItem('flw_cart_assembly');
  localStorage.removeItem('flw_is_assembly_mode');
  if (typeof stopCartPetals === 'function') stopCartPetals();
}
window.clearCartStorage = clearCartStorage;

function addPopToCart() {
  if (!activePopItem) return;

  let targetItem = null;
  let finalUnit = selectedGroupPack || "";
  let finalVariant = selectedGroupVariant || "";
  let finalColor = selectedGroupColor || "";

  if (activePopItem.is_group) {
    targetItem = activePopItem.variants.find(v => {
      const packParts = (v.unit || '').split('/').map(s => s.trim());
      const varParts = (v.variant || '').split('/').map(s => s.trim());
      const colorParts = (v.color || '').split('/').map(s => s.trim());

      const packMatch = !selectedGroupPack || packParts.includes(selectedGroupPack) || (v.unit || '').trim() === selectedGroupPack.trim();
      const varMatch = !selectedGroupVariant || varParts.includes(selectedGroupVariant) || (v.variant || '').trim() === selectedGroupVariant.trim();
      const colorMatch = !selectedGroupColor || colorParts.includes(selectedGroupColor) || (v.color || '').trim() === selectedGroupColor.trim();

      return packMatch && varMatch && colorMatch;
    });

    if (!targetItem || !targetItem.is_active) {
      toast("Выбранный товар отсутствует в наличии");
      return;
    }
  } else {
    if (!activePopItem.is_active) {
      toast("Товар отсутствует в наличии");
      return;
    }
    targetItem = activePopItem;
    if (!finalUnit) finalUnit = targetItem.unit || "";
    if (!finalVariant) finalVariant = targetItem.variant || "";
    if (!finalColor) finalColor = targetItem.color || "";
  }

  const cartKey = `${targetItem.id}:::${finalUnit}:::${finalVariant}:::${finalColor}`;
  cart[cartKey] = (cart[cartKey] || 0) + popQty;
  cartAssemblyItems[cartKey] = true;

  triggerHaptic('medium');
  triggerCartCounterBounce();
  updateCartUI();
  updateProductCardAction(activePopItem.id);
  closeProductModal();
  toast(`Добавлено: ${formatFullItemTitle(targetItem.title, finalUnit, finalVariant, finalColor)}`);
}
window.addPopToCart = addPopToCart;

function quickAdd(id) {
  let item = catalog.find(i => String(i.id) === String(id));
  if (!item) {
    const group = displayCatalog.find(g => String(g.id) === String(id));
    if (group && group.variants && group.variants.length > 0) {
      item = group.variants.find(v => v.is_active) || group.variants[0];
    }
  }

  if (!item || !item.is_active) return;

  let chosenUnit = item.unit || "";
  if (chosenUnit.includes('/')) chosenUnit = chosenUnit.split('/')[0].trim();

  let chosenVar = item.variant || "";
  if (chosenVar.includes('/')) chosenVar = chosenVar.split('/')[0].trim();

  let chosenColor = item.color || "";
  if (chosenColor.includes('/')) chosenColor = chosenColor.split('/')[0].trim();

  const cartKey = `${item.id}:::${chosenUnit}:::${chosenVar}:::${chosenColor}`;
  cart[cartKey] = (cart[cartKey] || 0) + 1;
  cartAssemblyItems[cartKey] = true;

  triggerHaptic('medium');
  triggerCartCounterBounce();
  updateCartUI();
  updateProductCardAction(id);
  toast(`Добавлено: ${formatFullItemTitle(item.title, chosenUnit, chosenVar, chosenColor)}`);
}
window.quickAdd = quickAdd;

function modifyCartByKey(cartKey, delta) {
  triggerHaptic('medium');
  cart[cartKey] = (cart[cartKey] || 0) + delta;
  const [itemId] = cartKey.split(':::');
  if (cart[cartKey] <= 0) {
    delete cart[cartKey];
    delete cartAssemblyItems[cartKey];
  }
  updateCartUI();
  updateProductCardAction(itemId);
}
window.modifyCartByKey = modifyCartByKey;

function removeAllOfItemFromCart(id) {
  triggerHaptic('medium');
  Object.keys(cart || {}).forEach(key => {
    const [itemId] = key.split(':::');
    if (String(itemId) === String(id)) {
      delete cart[key];
      delete cartAssemblyItems[key];
    }
  });
  updateCartUI();
  updateProductCardAction(id);
  toast("Удалено из корзины");
}
window.removeAllOfItemFromCart = removeAllOfItemFromCart;

function toggleItemAssemblySelection(cartKey) {
  triggerHaptic('light');
  cartAssemblyItems[cartKey] = !cartAssemblyItems[cartKey];
  renderCartItems();
  saveCartToStorage();
}
window.toggleItemAssemblySelection = toggleItemAssemblySelection;

function updateCartUI() {
  saveCartToStorage();

  const count = Object.values(cart || {}).reduce((a, b) => a + b, 0);
  const counterEl = document.getElementById('cart-counter');
  if (counterEl) counterEl.innerText = count;

  const checkoutCard = document.getElementById('cart-checkout-card');
  const entries = Object.entries(cart || {});

  if (!entries.length) {
    const container = document.getElementById('cart-items-container');
    if (container) {
      container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:16px 0; font-size:13px;" data-config-key="txt_cart_empty">Корзина пуста</div>';
    }
    if (checkoutCard) checkoutCard.style.display = 'none';
    currentFlowersSubtotal = 0;
    if (typeof stopCartPetals === 'function') stopCartPetals();
  } else {
    if (!catalog || !catalog.length) return;

    if (checkoutCard) checkoutCard.style.display = 'block';
    renderCartItems();

    const activeScreen = document.querySelector('.screen.active')?.id;
    if (activeScreen === 'screen-cart') {
      if (typeof startCartPetals === 'function') startCartPetals();
    }
  }

  displayCatalog.forEach(g => {
    if (g.is_group) {
      const el = document.getElementById(`product-action-${g.id}`);
      if (el) {
        const hasItems = isGroupInCart(g.id);
        el.innerHTML = `<button class="btn-select-variant ${hasItems ? 'has-items' : ''}" onclick="event.stopPropagation(); triggerHaptic('selection'); openProductModal('${g.id}')">Выбрать</button>`;
      }
    }
  });
}
window.updateCartUI = updateCartUI;

// Синхронизация цен и статуса наличия в корзине с текущим каталогом
function renderCartItems() {
  const container = document.getElementById('cart-items-container');
  if (!container) return;

  let subtotal = 0;
  const entries = Object.entries(cart || {});
  let hasUnavailableItems = false;

  const rowsHtml = entries.map(([cartKey, qty]) => {
    const [id, selectedUnit, selectedVar, selectedColor] = cartKey.split(':::');
    const item = catalog.find(i => String(i.id) === String(id));
    
    // Если товар удален из базы или выключен с витрины
    if (!item || !item.is_active) {
      hasUnavailableItems = true;
      const fallbackTitle = item ? formatFullItemTitle(item.title, selectedUnit || item.unit, selectedVar, selectedColor) : `Товар #${id}`;
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); opacity:0.65;">
          <div style="max-width:70%;">
            <div style="font-size:12px; font-weight:700; color:var(--red); line-height:1.25;">${fallbackTitle}</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Позиция закончилась или недоступна</div>
          </div>
          <button class="btn-trash-mini" style="color:var(--red); font-size:16px;" onclick="modifyCartByKey('${cartKey}', -${qty})">🗑️ Убрать</button>
        </div>
      `;
    }

    subtotal += item.price * qty;
    const photos = (item.photo_url || "").split(',').map(s => s.trim()).filter(Boolean);
    const thumb = photos[0] || "";
    const isChecked = !!cartAssemblyItems[cartKey];
    const fullTitle = formatFullItemTitle(item.title, selectedUnit || item.unit, selectedVar, selectedColor);

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:8px; max-width:68%;">
          ${isAssemblyMode ? `
            <div class="custom-checkbox ${isChecked ? 'checked' : ''}" style="width:18px; height:18px;" onclick="toggleItemAssemblySelection('${cartKey}')">${isChecked ? '✓' : ''}</div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="triggerHaptic('selection'); openProductModal(${item.id}, '${selectedVar || ''}', '${selectedUnit || ''}', '${selectedColor || ''}')">
            <div style="width:44px; height:44px; border-radius:10px; overflow:hidden; background:var(--card-inner); flex-shrink:0; border:1px solid var(--border-accent); box-shadow:0 4px 12px rgba(0,0,0,0.25);">
              ${thumb ? `<img src="${thumb}" style="width:100%; height:100%; object-fit:cover;">` : '<div style="display:flex; align-items:center; justify-content:center; height:100%;">🌸</div>'}
            </div>
            <div>
              <div style="font-size:12px; font-weight:700; line-height:1.25; color:var(--text);">${fullTitle}</div>
              <div style="font-size:11px; color:var(--gold); margin-top:2px;">${item.price} ₽ × ${qty} шт. = ${item.price * qty} ₽</div>
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="qty-btn" onclick="modifyCartByKey('${cartKey}', -1)">–</button>
          <span style="font-size:14px; font-weight:800; min-width:18px; text-align:center; color:var(--text);">${qty}</span>
          <button class="qty-btn" onclick="modifyCartByKey('${cartKey}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = (hasUnavailableItems ? `
    <div style="background:rgba(185,28,28,0.14); border:1px solid rgba(185,28,28,0.35); border-radius:8px; padding:6px 10px; margin-bottom:8px; font-size:11px; color:#ef4444; font-weight:700; text-align:center;">
      Некоторые цветы закончились. Уберите их, чтобы оформить заказ.
    </div>
  ` : '') + rowsHtml;

  currentFlowersSubtotal = subtotal;
  const totalEl = document.getElementById('cart-total');
  if (totalEl) totalEl.innerText = subtotal + ' ₽';
}
window.renderCartItems = renderCartItems;
