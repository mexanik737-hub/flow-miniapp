let cart = {}; // cartKey: "${id}:::${unit}:::${variant}:::${color}" -> qty
let cartAssemblyItems = {};
let isAssemblyMode = false;
let currentFlowersSubtotal = 0;

function toggleCartAssemblyMode() {
  isAssemblyMode = !isAssemblyMode;
  const el = document.getElementById('cart-assembly-checkbox-ui');
  el.classList.toggle('checked', isAssemblyMode);
  el.innerText = isAssemblyMode ? '✓' : '';
  renderCartItems();
}

function getCartItemQuantity(id) {
  return Object.entries(cart).reduce((sum, [key, qty]) => {
    const [itemId] = key.split(':::');
    return String(itemId) === String(id) ? sum + qty : sum;
  }, 0);
}

// Починенная кнопка «+»: быстрое добавление единицы товара без открытия карточки
function quickAdd(id, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const item = catalog.find(i => String(i.id) === String(id));
  if (!item || !item.is_active) return;

  const unit = (item.unit || "1 шт.").split('/')[0].trim();
  const variant = (item.variant || "").split('/')[0].trim();
  const color = (item.color || "").split('/')[0].trim();

  const cartKey = `${id}:::${unit}:::${variant}:::${color}`;
  cart[cartKey] = (cart[cartKey] || 0) + 1;
  cartAssemblyItems[cartKey] = true;

  updateCartUI();
  updateProductCardAction(id);
  toast("Добавлено в заказ");
}

function addPopToCart() {
  if (!activePopItem) return;

  let targetId = activePopItem.id;
  let finalUnit = selectedGroupPack || "1 шт.";
  let finalVariant = selectedGroupVariant || "";
  let finalColor = selectedGroupColor || "";

  if (activePopItem.is_group) {
    const matched = activePopItem.variants.find(v => {
      const packMatch = !selectedGroupPack || v.unit.split('/').map(s => s.trim()).includes(selectedGroupPack);
      const varMatch = !selectedGroupVariant || !v.variant || v.variant.split('/').map(s => s.trim()).includes(selectedGroupVariant);
      const colMatch = !selectedGroupColor || !v.color || v.color.split('/').map(s => s.trim()).includes(selectedGroupColor);
      return packMatch && varMatch && colMatch;
    });

    if (!matched || !matched.is_active) {
      toast("Товар отсутствует в наличии");
      return;
    }
    targetId = matched.id;
  } else {
    if (!activePopItem.is_active) {
      toast("Товар отсутствует в наличии");
      return;
    }
  }

  const cartKey = `${targetId}:::${finalUnit}:::${finalVariant}:::${finalColor}`;
  cart[cartKey] = (cart[cartKey] || 0) + popQty;
  cartAssemblyItems[cartKey] = true;

  updateCartUI();
  updateProductCardAction(targetId);
  closeProductModal();
  toast("Добавлено в заказ");
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
    document.getElementById('cart-items-container').innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:16px 0; font-size:13px;">Корзина пуста</div>';
    checkoutCard.style.display = 'none';
    currentFlowersSubtotal = 0;
    return;
  }

  checkoutCard.style.display = 'block';
  renderCartItems();
}

function updateProductCardAction(id) {
  const actionEl = document.getElementById(`product-action-${id}`);
  if (!actionEl) return;
  const inCartQty = getCartItemQuantity(id);

  if (inCartQty > 0) {
    actionEl.innerHTML = `
      <div class="cart-active-stepper" onclick="event.stopPropagation();">
        <button class="btn-trash-mini" onclick="removeAllOfItemFromCart('${id}')">🗑️</button>
        <span class="cart-active-qty">${inCartQty}</span>
        <button class="btn-trash-mini" style="font-weight:800; font-size:15px; color:var(--green);" onclick="quickAdd('${id}', event)">+</button>
      </div>
    `;
  } else {
    actionEl.innerHTML = `<button class="btn-quick-add" onclick="quickAdd('${id}', event)">+</button>`;
  }
}

// Формирование полного читаемого описания позиции
function formatItemFullTitle(title, unit, variant, color) {
  const details = [];
  if (variant) details.push(variant);
  if (color) details.push(color);
  const detailStr = details.length ? ` (${details.join(', ')})` : '';
  const packStr = unit ? ` [${unit}]` : '';
  return `${title}${detailStr}${packStr}`;
}

function renderCartItems() {
  const container = document.getElementById('cart-items-container');
  let subtotal = 0;
  const entries = Object.entries(cart);

  container.innerHTML = entries.map(([cartKey, qty]) => {
    const [id, unit, variant, color] = cartKey.split(':::');
    const item = catalog.find(i => String(i.id) === String(id));
    if (!item) return '';

    subtotal += item.price * qty;
    const photos = (item.photo_url || "").split(',').map(s => s.trim()).filter(Boolean);
    const thumb = photos[0] || "";
    const isChecked = !!cartAssemblyItems[cartKey];
    const displayTitle = formatItemFullTitle(item.title, unit, variant, color);

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:8px; max-width:68%;">
          ${isAssemblyMode ? `
            <div class="custom-checkbox ${isChecked ? 'checked' : ''}" style="width:18px; height:18px;" onclick="toggleItemAssemblySelection('${cartKey}')">${isChecked ? '✓' : ''}</div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="openProductModal(${item.id}, '${unit}', '${variant}', '${color}')">
            <div style="width:44px; height:44px; border-radius:8px; overflow:hidden; background:var(--card-inner); flex-shrink:0; border:1px solid var(--border-accent);">
              ${thumb ? `<img src="${thumb}" style="width:100%; height:100%; object-fit:cover;">` : '<div style="display:flex; align-items:center; justify-content:center; height:100%;">🌸</div>'}
            </div>
            <div>
              <div style="font-size:12px; font-weight:700; line-height:1.25; text-decoration:underline; text-decoration-color:rgba(56,189,248,0.4);">${displayTitle}</div>
              <div style="font-size:11px; color:var(--cyan); margin-top:2px;">${item.price} ₽ × ${qty}</div>
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
