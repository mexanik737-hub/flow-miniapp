// Гарантированное восстановление корзины из памяти при загрузке скрипта
try {
  const savedCart = localStorage.getItem('flw_cart') || localStorage.getItem('cart');
  if (savedCart) {
    const parsed = JSON.parse(savedCart);
    if (parsed && typeof parsed === 'object') {
      if (typeof cart !== 'undefined') {
        Object.assign(cart, parsed);
      }
      window.cart = parsed;
    }
  }
  const savedAsm = localStorage.getItem('flw_cart_assembly');
  if (savedAsm) {
    const parsedAsm = JSON.parse(savedAsm);
    if (parsedAsm && typeof parsedAsm === 'object') {
      if (typeof cartAssemblyItems !== 'undefined') Object.assign(cartAssemblyItems, parsedAsm);
      window.cartAssemblyItems = parsedAsm;
    }
  }
  const savedMode = localStorage.getItem('flw_is_assembly_mode');
  if (savedMode !== null) {
    if (typeof isAssemblyMode !== 'undefined') isAssemblyMode = (savedMode === 'true');
    window.isAssemblyMode = (savedMode === 'true');
  }
} catch (e) {}

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
  const targetCart = (typeof cart !== 'undefined' && cart) ? cart : (window.cart || {});
  const targetAsm = (typeof cartAssemblyItems !== 'undefined' && cartAssemblyItems) ? cartAssemblyItems : (window.cartAssemblyItems || {});
  const targetMode = (typeof isAssemblyMode !== 'undefined') ? isAssemblyMode : (window.isAssemblyMode || false);

  localStorage.setItem('flw_cart', JSON.stringify(targetCart));
  localStorage.setItem('flw_cart_assembly', JSON.stringify(targetAsm));
  localStorage.setItem('flw_is_assembly_mode', String(targetMode));

  window.cart = targetCart;
  window.cartAssemblyItems = targetAsm;
  window.isAssemblyMode = targetMode;
}
window.saveCartToStorage = saveCartToStorage;

function clearCartStorage() {
  if (typeof cart !== 'undefined') {
    Object.keys(cart).forEach(k => delete cart[k]);
  }
  if (typeof cartAssemblyItems !== 'undefined') {
    Object.keys(cartAssemblyItems).forEach(k => delete cartAssemblyItems[k]);
  }
  if (typeof isAssemblyMode !== 'undefined') isAssemblyMode = false;

  window.cart = {};
  window.cartAssemblyItems = {};
  window.isAssemblyMode = false;

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
  
  if (typeof cart === 'undefined') window.cart = window.cart || {};
  const activeCartRef = (typeof cart !== 'undefined') ? cart : window.cart;
  const activeAsmRef = (typeof cartAssemblyItems !== 'undefined') ? cartAssemblyItems : (window.cartAssemblyItems = window.cartAssemblyItems || {});

  activeCartRef[cartKey] = (activeCartRef[cartKey] || 0) + (popQty || 1);
  activeAsmRef[cartKey] = true;
  window.cart = activeCartRef;

  const addBtn = document.getElementById('pop-add-cart-btn');
  if (typeof animateFlyToCart === 'function') {
    animateFlyToCart(addBtn);
  } else {
    triggerCartCounterBounce();
  }

  updateCartUI();
  updateProductCardAction(activePopItem.id);
  closeProductModal();
  toast(`Добавлено: ${formatFullItemTitle(targetItem.title, finalUnit, finalVariant, finalColor)}`);
}
window.addPopToCart = addPopToCart;

function quickAdd(id, event) {
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

  if (typeof cart === 'undefined') window.cart = window.cart || {};
  const activeCartRef = (typeof cart !== 'undefined') ? cart : window.cart;
  const activeAsmRef = (typeof cartAssemblyItems !== 'undefined') ? cartAssemblyItems : (window.cartAssemblyItems = window.cartAssemblyItems || {});

  activeCartRef[cartKey] = (activeCartRef[cartKey] || 0) + 1;
  activeAsmRef[cartKey] = true;
  window.cart = activeCartRef;

  if (typeof animateFlyToCart === 'function') {
    animateFlyToCart(event ? event.target : null);
  } else {
    triggerCartCounterBounce();
  }

  updateCartUI();
  updateProductCardAction(id);
  toast(`Добавлено: ${formatFullItemTitle(item.title, chosenUnit, chosenVar, chosenColor)}`);
}
window.quickAdd = quickAdd;

function modifyCartByKey(cartKey, delta) {
  triggerHaptic('medium');
  const activeCartRef = (typeof cart !== 'undefined') ? cart : (window.cart || {});
  const activeAsmRef = (typeof cartAssemblyItems !== 'undefined') ? cartAssemblyItems : (window.cartAssemblyItems || {});

  activeCartRef[cartKey] = (activeCartRef[cartKey] || 0) + delta;
  const [itemId] = cartKey.split(':::');
  if (activeCartRef[cartKey] <= 0) {
    delete activeCartRef[cartKey];
    delete activeAsmRef[cartKey];
  }
  window.cart = activeCartRef;
  updateCartUI();
  updateProductCardAction(itemId);
}
window.modifyCartByKey = modifyCartByKey;

function removeAllOfItemFromCart(id) {
  triggerHaptic('medium');
  const activeCartRef = (typeof cart !== 'undefined') ? cart : (window.cart || {});
  const activeAsmRef = (typeof cartAssemblyItems !== 'undefined') ? cartAssemblyItems : (window.cartAssemblyItems || {});

  Object.keys(activeCartRef).forEach(key => {
    const [itemId] = key.split(':::');
    if (String(itemId) === String(id)) {
      delete activeCartRef[key];
      delete activeAsmRef[key];
    }
  });
  window.cart = activeCartRef;
  updateCartUI();
  updateProductCardAction(id);
  toast("Удалено из корзины");
}
window.removeAllOfItemFromCart = removeAllOfItemFromCart;

function toggleItemAssemblySelection(cartKey) {
  triggerHaptic('light');
  const activeAsmRef = (typeof cartAssemblyItems !== 'undefined') ? cartAssemblyItems : (window.cartAssemblyItems = window.cartAssemblyItems || {});
  activeAsmRef[cartKey] = !activeAsmRef[cartKey];
  renderCartItems();
  saveCartToStorage();
}
window.toggleItemAssemblySelection = toggleItemAssemblySelection;

function updateCartUI() {
  saveCartToStorage();

  const activeCartRef = (typeof cart !== 'undefined') ? cart : (window.cart || {});
  const count = Object.values(activeCartRef).reduce((a, b) => a + (parseInt(b, 10) || 0), 0);
  const counterEl = document.getElementById('cart-counter');
  if (counterEl) counterEl.innerText = count;

  const checkoutCard = document.getElementById('cart-checkout-card');
  const entries = Object.entries(activeCartRef);

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

  if (typeof displayCatalog !== 'undefined' && Array.isArray(displayCatalog)) {
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
}
window.updateCartUI = updateCartUI;

function renderCartItems() {
  const container = document.getElementById('cart-items-container');
  if (!container) return;

  let subtotal = 0;
  const activeCartRef = (typeof cart !== 'undefined') ? cart : (window.cart || {});
  const activeAsmRef = (typeof cartAssemblyItems !== 'undefined') ? cartAssemblyItems : (window.cartAssemblyItems || {});
  const activeMode = (typeof isAssemblyMode !== 'undefined') ? isAssemblyMode : (window.isAssemblyMode || false);

  const entries = Object.entries(activeCartRef);

  container.innerHTML = entries.map(([cartKey, qty]) => {
    const [id, selectedUnit, selectedVar, selectedColor] = cartKey.split(':::');
    const item = catalog.find(i => String(i.id) === String(id));
    if (!item) return '';

    const numQty = parseInt(qty, 10) || 1;
    subtotal += item.price * numQty;
    const photos = (item.photo_url || "").split(',').map(s => s.trim()).filter(Boolean);
    const thumb = photos[0] || "";
    const isChecked = !!activeAsmRef[cartKey];
    const fullTitle = formatFullItemTitle(item.title, selectedUnit || item.unit, selectedVar, selectedColor);

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:8px; max-width:68%;">
          ${activeMode ? `
            <div class="custom-checkbox ${isChecked ? 'checked' : ''}" style="width:18px; height:18px;" onclick="toggleItemAssemblySelection('${cartKey}')">${isChecked ? '✓' : ''}</div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="triggerHaptic('selection'); openProductModal(${item.id}, '${selectedVar || ''}', '${selectedUnit || ''}', '${selectedColor || ''}')">
            <div style="width:44px; height:44px; border-radius:10px; overflow:hidden; background:var(--card-inner); flex-shrink:0; border:1px solid var(--border-accent); box-shadow:0 4px 12px rgba(0,0,0,0.25);">
              ${thumb ? `<img src="${thumb}" style="width:100%; height:100%; object-fit:cover;">` : '<div style="display:flex; align-items:center; justify-content:center; height:100%;">🌸</div>'}
            </div>
            <div>
              <div style="font-size:12px; font-weight:700; line-height:1.25; color:var(--text);">${fullTitle}</div>
              <div style="font-size:11px; color:var(--gold); margin-top:2px;">${item.price} ₽ × ${numQty} шт. = ${item.price * numQty} ₽</div>
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="qty-btn" onclick="modifyCartByKey('${cartKey}', -1)">–</button>
          <span style="font-size:14px; font-weight:800; min-width:18px; text-align:center; color:var(--text);">${numQty}</span>
          <button class="qty-btn" onclick="modifyCartByKey('${cartKey}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  currentFlowersSubtotal = subtotal;
  const totalEl = document.getElementById('cart-total');
  if (totalEl) totalEl.innerText = subtotal + ' ₽';
}
window.renderCartItems = renderCartItems;
