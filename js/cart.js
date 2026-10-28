// Сохранение корзины в локальное хранилище браузера
function saveCartToLocalStorage() {
  localStorage.setItem('flw_cart', JSON.stringify(cart));
  localStorage.setItem('flw_cart_assembly', JSON.stringify(cartAssemblyItems));
}


function addPopToCart() {
  if (!activePopItem) return;


  let targetItem = activePopItem;
  let finalPack = selectedGroupPack || "";
  let finalVariant = selectedGroupVariant || "";
  let finalColor = selectedGroupColor || "";


  if (activePopItem.is_group) {
    const variant = activePopItem.variants.find(v => {
      const packMatch = !selectedGroupPack || v.unit.split('/').map(s => s.trim()).includes(selectedGroupPack);
      const varMatch = !selectedGroupVariant || v.variant.split('/').map(s => s.trim()).includes(selectedGroupVariant);
      const colMatch = !selectedGroupColor || (v.color && v.color.split('/').map(s => s.trim()).includes(selectedGroupColor));
      return packMatch && varMatch && colMatch;
    }) || activePopItem.variants[0];


    if (!variant || !variant.is_active) {
      toast("Товар отсутствует в наличии");
      return;
    }
    targetItem = variant;
  } else {
    if (!activePopItem.is_active) {
      toast("Товар отсутствует в наличии");
      return;
    }
  }


  // Составной уникальный ключ: id:::unit:::variant:::color
  const cartKey = `${targetItem.id}:::${finalPack}:::${finalVariant}:::${finalColor}`;
  cart[cartKey] = (cart[cartKey] || 0) + popQty;
  cartAssemblyItems[cartKey] = true;


  saveCartToLocalStorage();
  updateCartUI();
  updateProductCardAction(activePopItem.id);
  closeProductModal();
  toast("Добавлено в заказ");
}


function quickAdd(id) {
  let item = catalog.find(i => String(i.id) === String(id));
  if (!item) {
    const group = displayCatalog.find(g => String(g.id) === String(id));
    if (group && group.variants && group.variants.length > 0) {
      item = group.variants.find(v => v.is_active) || group.variants[0];
    }
  }


  if (!item || !item.is_active) return;


  const chosenPack = item.unit ? item.unit.split('/')[0].trim() : "";
  const chosenVar = item.variant ? item.variant.split('/')[0].trim() : "";
  const chosenColor = item.color ? item.color.split('/')[0].trim() : "";


  const cartKey = `${item.id}:::${chosenPack}:::${chosenVar}:::${chosenColor}`;
  cart[cartKey] = (cart[cartKey] || 0) + 1;
  cartAssemblyItems[cartKey] = true;


  saveCartToLocalStorage();
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
  saveCartToLocalStorage();
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
  saveCartToLocalStorage();
  updateCartUI();
  updateProductCardAction(id);
  toast("Удалено из корзины");
}


function toggleItemAssemblySelection(cartKey) {
  cartAssemblyItems[cartKey] = !cartAssemblyItems[cartKey];
  saveCartToLocalStorage();
  renderCartItems();
}


function updateCartUI() {
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const counterEl = document.getElementById('cart-counter');
  if (counterEl) counterEl.innerText = count;


  const checkoutCard = document.getElementById('cart-checkout-card');
  const entries = Object.entries(cart);


  // Синхронизация красных точек для всех групп товаров
  displayCatalog.forEach(g => {
    if (g.is_group) {
      const dotEl = document.getElementById(`group-dot-${g.id}`);
      if (dotEl) {
        dotEl.style.display = isGroupInCart(g) ? 'block' : 'none';
      }
    }
  });


  if (!entries.length) {
    document.getElementById('cart-items-container').innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:16px 0; font-size:13px;" data-config-key="txt_cart_empty">Корзина пуста</div>';
    if (checkoutCard) checkoutCard.style.display = 'none';
    currentFlowersSubtotal = 0;
    return;
  }


  if (checkoutCard) checkoutCard.style.display = 'block';
  renderCartItems();
}


function renderCartItems() {
  const container = document.getElementById('cart-items-container');
  let subtotal = 0;
  const entries = Object.entries(cart);


  container.innerHTML = entries.map(([cartKey, qty]) => {
    const [id, selectedPack, selectedVar, selectedColor] = cartKey.split(':::');
    const item = catalog.find(i => String(i.id) === String(id));
    if (!item) return '';


    subtotal += item.price * qty;
    const photos = (item.photo_url || "").split(',').map(s => s.trim()).filter(Boolean);
    const thumb = photos[0] || "";
    const isChecked = !!cartAssemblyItems[cartKey];
    
    // Форматирование по стандарту: Товар [штук] [см] [цвет]
    const fullTitle = formatItemFullName(item.title, selectedPack, selectedVar, selectedColor);


    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:8px; max-width:68%;">
          ${isAssemblyMode ? `
            <div class="custom-checkbox ${isChecked ? 'checked' : ''}" style="width:18px; height:18px;" onclick="toggleItemAssemblySelection('${cartKey}')">${isChecked ? '✓' : ''}</div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="openProductModal(${item.id}, '${selectedPack || ''}', '${selectedVar || ''}', '${selectedColor || ''}')">
            <div style="width:44px; height:44px; border-radius:8px; overflow:hidden; background:var(--card-inner); flex-shrink:0; border:1px solid var(--border-accent);">
              ${thumb ? `<img src="${thumb}" style="width:100%; height:100%; object-fit:cover;">` : '<div style="display:flex; align-items:center; justify-content:center; height:100%;">🌸</div>'}
            </div>
            <div>
              <div style="font-size:13px; font-weight:700; line-height:1.2; text-decoration:underline; text-decoration-color:rgba(56,189,248,0.4);">${fullTitle}</div>
              <div style="font-size:11px; color:var(--cyan); margin-top:2px;">${item.price} ₽ × ${qty} шт. = ${item.price * qty} ₽</div>
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
