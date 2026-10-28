function addPopToCart() {
  if (!activePopItem) return;

  let targetId = activePopItem.id;
  let finalVariant = selectedGroupVariant || "";

  if (activePopItem.is_group) {
    const variant = activePopItem.variants.find(v => {
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
    if (!variant || !variant.is_active) {
      toast("Товар отсутствует в наличии");
      return;
    }
    targetId = variant.id;
  } else {
    if (!activePopItem.is_active) {
      toast("Товар отсутствует в наличии");
      return;
    }
  }

  const cartKey = `${targetId}:::${finalVariant}`;
  cart[cartKey] = (cart[cartKey] || 0) + popQty;
  cartAssemblyItems[cartKey] = true;

  updateCartUI();
  updateProductCardAction(activePopItem.id);
  closeProductModal();
  toast("Добавлено в заказ");
}

// Правка 10: Кнопка «+» мгновенно добавляет единицу в корзину без открытия модалки
function quickAdd(id) {
  let item = catalog.find(i => String(i.id) === String(id));
  if (!item) {
    const group = displayCatalog.find(g => String(g.id) === String(id));
    if (group && group.variants && group.variants.length > 0) {
      item = group.variants.find(v => v.is_active) || group.variants[0];
    }
  }

  if (!item || !item.is_active) return;

  let chosenVar = item.variant || "";
  if (chosenVar.includes('/')) {
    chosenVar = chosenVar.split('/')[0].trim();
  }

  const cartKey = `${item.id}:::${chosenVar}`;
  cart[cartKey] = (cart[cartKey] || 0) + 1;
  cartAssemblyItems[cartKey] = true;

  updateCartUI();
  updateProductCardAction(id);
  toast(`Добавлено: ${item.title}`);
}

function modifyCartByKey(cartKey, delta) {
  cart[cartKey] = (cart[cartKey] || 0) + delta;
  const [itemId] = cartKey.split(':::');
  if (cart[cartKey] <= 0) {
    delete cart[cartKey];
    delete cartAssemblyItems[cartKey];
  }
  updateCartUI();
  updateProductCardAction(itemId);
}

function removeAllOfItemFromCart(id) {
  Object.keys(cart).forEach(key => {
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

function toggleItemAssemblySelection(cartKey) {
  cartAssemblyItems[cartKey] = !cartAssemblyItems[cartKey];
  renderCartItems();
}

function updateCartUI() {
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  document.getElementById('cart-counter').innerText = count;

  const checkoutCard = document.getElementById('cart-checkout-card');
  const entries = Object.entries(cart);

  if (!entries.length) {
    document.getElementById('cart-items-container').innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:16px 0; font-size:13px;" data-config-key="txt_cart_empty">Корзина пуста</div>';
    checkoutCard.style.display = 'none';
    currentFlowersSubtotal = 0;
    return;
  }

  checkoutCard.style.display = 'block';
  renderCartItems();
}

function renderCartItems() {
  const container = document.getElementById('cart-items-container');
  let subtotal = 0;
  const entries = Object.entries(cart);

  container.innerHTML = entries.map(([cartKey, qty]) => {
    const [id, selectedVar] = cartKey.split(':::');
    const item = catalog.find(i => String(i.id) === String(id));
    if (!item) return '';

    subtotal += item.price * qty;
    const photos = (item.photo_url || "").split(',').map(s => s.trim()).filter(Boolean);
    const thumb = photos[0] || "";
    const varInfo = selectedVar ? ` (${selectedVar})` : '';
    const isChecked = !!cartAssemblyItems[cartKey];

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:8px; max-width:68%;">
          ${isAssemblyMode ? `
            <div class="custom-checkbox ${isChecked ? 'checked' : ''}" style="width:18px; height:18px;" onclick="toggleItemAssemblySelection('${cartKey}')">${isChecked ? '✓' : ''}</div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="openProductModal(${item.id}, '${selectedVar || ''}', '${item.unit || ''}')">
            <div style="width:44px; height:44px; border-radius:8px; overflow:hidden; background:var(--card-inner); flex-shrink:0; border:1px solid var(--border-accent);">
              ${thumb ? `<img src="${thumb}" style="width:100%; height:100%; object-fit:cover;">` : '<div style="display:flex; align-items:center; justify-content:center; height:100%;">🌸</div>'}
            </div>
            <div>
              <div style="font-size:13px; font-weight:700; line-height:1.2; text-decoration:underline; text-decoration-color:rgba(56,189,248,0.4);">${item.title}${varInfo}</div>
              <div style="font-size:11px; color:var(--cyan); margin-top:2px;">${item.unit || ''} · ${item.price} ₽ × ${qty}</div>
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="qty-btn" onclick="modifyCartByKey('${cartKey}', -1)">–</button>
          <span style="font-size:14px; font-weight:700; min-width:18px; text-align:center;">${qty}</span>
          <button class="qty-btn" onclick="modifyCartByKey('${cartKey}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  currentFlowersSubtotal = subtotal;
  document.getElementById('cart-total').innerText = subtotal + ' ₽';
}
