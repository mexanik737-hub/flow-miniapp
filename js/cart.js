// Состояние корзины
let cart = {}; // Ключ: `${id}:::${variant}`
let isAssemblyMode = false;
let cartAssemblyItems = new Set();
let currentFlowersSubtotal = 0;

function getCartItemQuantity(id) {
  let count = 0;
  Object.keys(cart).forEach(key => {
    if (key.split(':::')[0] === String(id)) {
      count += cart[key].qty;
    }
  });
  return count;
}

function quickAdd(id) {
  const item = catalog.find(i => String(i.id) === String(id));
  if (!item) return;

  const titleKey = item.title.trim();
  const isPartOfGroup = displayCatalog.some(g => g.is_group && g.title.trim() === titleKey);
  const hasSlashVariants = item.variant && item.variant.includes('/');

  if (isPartOfGroup || hasSlashVariants) {
    openProductModal(id);
    return;
  }

  const key = `${item.id}:::${item.variant || ''}`;
  if (!cart[key]) {
    cart[key] = {
      id: item.id,
      title: item.title,
      price: item.price,
      unit: item.unit || '1 шт.',
      variant: item.variant || '',
      photo_url: item.photo_url || '',
      qty: 1
    };
  } else {
    cart[key].qty += 1;
  }

  updateCartUI();
  updateProductCardAction(item.id);
  toast(`Добавлено: ${item.title}`);
}

function addPopToCart() {
  if (!activePopItem) return;

  let targetItem = null;
  let finalVariant = selectedGroupVariant;
  let finalUnit = selectedGroupPack;

  if (activePopItem.is_group) {
    targetItem = activePopItem.variants.find(v => {
      const packMatch = !selectedGroupPack || v.unit.trim() === selectedGroupPack.trim();
      let varMatch = false;
      if (!selectedGroupVariant) varMatch = true;
      else if (v.variant.includes('/')) {
        const parts = v.variant.split('/').map(s => s.trim());
        varMatch = parts.includes(selectedGroupVariant);
      } else {
        varMatch = (v.variant.trim() === selectedGroupVariant.trim());
      }
      return packMatch && varMatch;
    });

    if (!targetItem) {
      toast("Выбранная вариация недоступна");
      return;
    }
  } else {
    targetItem = activePopItem;
    finalUnit = targetItem.unit || '1 шт.';
    if (!finalVariant) finalVariant = targetItem.variant || '';
  }

  const key = `${targetItem.id}:::${finalVariant || ''}`;
  if (!cart[key]) {
    cart[key] = {
      id: targetItem.id,
      title: targetItem.title,
      price: targetItem.price,
      unit: finalUnit,
      variant: finalVariant,
      photo_url: targetItem.photo_url || activePopItem.photo_url || '',
      qty: popQty
    };
  } else {
    cart[key].qty += popQty;
  }

  updateCartUI();
  updateProductCardAction(activePopItem.id);
  closeProductModal();
  toast(`Добавлено: ${targetItem.title} (${popQty} шт.)`);
}

function modifyCartByKey(key, delta) {
  if (!cart[key]) return;
  cart[key].qty += delta;
  if (cart[key].qty <= 0) {
    delete cart[key];
    cartAssemblyItems.delete(key);
  }
  updateCartUI();
  if (typeof renderCatalog === 'function' && filteredCatalog.length) {
    renderCatalog(filteredCatalog);
  }
}

function removeAllOfItemFromCart(id) {
  Object.keys(cart).forEach(key => {
    if (key.split(':::')[0] === String(id)) {
      delete cart[key];
      cartAssemblyItems.delete(key);
    }
  });
  updateCartUI();
  updateProductCardAction(id);
}

function toggleCartAssemblyMode() {
  isAssemblyMode = !isAssemblyMode;
  const ui = document.getElementById('cart-assembly-checkbox-ui');
  if (ui) {
    ui.classList.toggle('checked', isAssemblyMode);
    ui.innerText = isAssemblyMode ? '✓' : '';
  }

  if (isAssemblyMode) {
    Object.keys(cart).forEach(k => cartAssemblyItems.add(k));
  } else {
    cartAssemblyItems.clear();
  }
  renderCartItems();
}

function toggleItemAssemblySelection(key) {
  if (cartAssemblyItems.has(key)) {
    cartAssemblyItems.delete(key);
  } else {
    cartAssemblyItems.add(key);
  }
  renderCartItems();
}

function updateCartUI() {
  const keys = Object.keys(cart);
  let totalQty = 0;
  let subtotal = 0;

  keys.forEach(k => {
    totalQty += cart[k].qty;
    subtotal += cart[k].price * cart[k].qty;
  });

  currentFlowersSubtotal = subtotal;

  const counter = document.getElementById('cart-counter');
  if (counter) counter.innerText = totalQty;

  const checkoutCard = document.getElementById('cart-checkout-card');
  const cartTotalEl = document.getElementById('cart-total');

  if (keys.length > 0) {
    if (checkoutCard) checkoutCard.style.display = 'block';
    if (cartTotalEl) cartTotalEl.innerText = `${subtotal} ₽`;
  } else {
    if (checkoutCard) checkoutCard.style.display = 'none';
    isAssemblyMode = false;
    cartAssemblyItems.clear();
    const ui = document.getElementById('cart-assembly-checkbox-ui');
    if (ui) {
      ui.classList.remove('checked');
      ui.innerText = '';
    }
  }

  renderCartItems();
}

function renderCartItems() {
  const container = document.getElementById('cart-items-container');
  if (!container) return;

  const keys = Object.keys(cart);
  if (!keys.length) {
    container.innerHTML = `
      <div style="text-align:center; color:var(--text-muted); padding:16px 0; font-size:13px;" data-config-key="txt_cart_empty">
        Корзина пуста
      </div>
    `;
    return;
  }

  container.innerHTML = keys.map(k => {
    const item = cart[k];
    const isChecked = cartAssemblyItems.has(k);
    const varText = item.variant ? ` (${item.variant})` : '';

    return `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 0; border-bottom:1px solid var(--border);">
        ${isAssemblyMode ? `
          <div class="custom-checkbox ${isChecked ? 'checked' : ''}" style="width:20px; height:20px; font-size:11px;" onclick="toggleItemAssemblySelection('${k}')">
            ${isChecked ? '✓' : ''}
          </div>
        ` : ''}
        <div style="flex:1;">
          <div style="font-size:13px; font-weight:700; color:var(--text);">${item.title}${varText}</div>
          <div style="font-size:11px; color:var(--cyan); margin-top:2px;">${item.unit} • ${item.price} ₽/уп.</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="qty-btn" onclick="modifyCartByKey('${k}', -1)">–</button>
          <span style="font-size:14px; font-weight:700; min-width:20px; text-align:center;">${item.qty}</span>
          <button class="qty-btn" onclick="modifyCartByKey('${k}', 1)">+</button>
        </div>
        <div style="font-size:14px; font-weight:800; min-width:60px; text-align:right;">
          ${item.price * item.qty} ₽
        </div>
      </div>
    `;
  }).join('');
}
