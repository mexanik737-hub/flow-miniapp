// Функция форматирования названия товара со свойствами: Товар [штук] [см] [цвет]
function formatFullItemTitle(title, unit, variant, color) {
  const parts = [];
  if (unit && String(unit).trim() && String(unit).trim() !== "1 шт.") {
    parts.push(`[${String(unit).trim()}]`);
  }
  if (variant && String(variant).trim()) {
    parts.push(`[${String(variant).trim()}]`);
  }
  if (color && String(color).trim()) {
    parts.push(`[${String(color).trim()}]`);
  }
  return parts.length ? `${title} ${parts.join(' ')}` : title;
}

// Проверка наличия товаров группы в корзине (для отображения красной точки)
function isGroupInCart(groupIdOrTitle) {
  const group = displayCatalog.find(g => String(g.id) === String(groupIdOrTitle) || g.title.trim() === String(groupIdOrTitle).trim());
  if (!group || !group.variants) return false;
  return group.variants.some(v => getCartItemQuantity(v.id) > 0);
}

function buildDisplayCatalog() {
  const groupsMap = {};
  const orderTracker = [];

  catalog.forEach(item => {
    const titleKey = item.title.trim();
    if (!groupsMap[titleKey]) {
      groupsMap[titleKey] = [];
      orderTracker.push(titleKey);
    }
    groupsMap[titleKey].push(item);
  });

  const rawDisplay = orderTracker.map(titleKey => {
    const items = groupsMap[titleKey];
    if (items.length === 1) {
      return { ...items[0], is_group: false };
    }

    const activeVariants = items.filter(v => v.is_active);
    const prices = (activeVariants.length ? activeVariants : items).map(v => v.price);
    const minPrice = Math.min(...prices);
    const hasPhoto = items.find(v => v.photo_url);

    return {
      is_group: true,
      id: 'group_' + encodeURIComponent(titleKey),
      title: titleKey,
      category: items[0].category,
      price: minPrice,
      photo_url: hasPhoto ? hasPhoto.photo_url : "",
      description: items[0].description,
      is_active: items.some(v => v.is_active),
      is_popular: items.some(v => v.is_popular),
      unit: "Варианты выбора",
      variants: items
    };
  });

  displayCatalog = rawDisplay.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0));
}

function setupFilterDropdown() {
  const cats = Array.from(new Set(catalog.map(c => c.category).filter(Boolean)));
  const optionsBox = document.getElementById('filter-cat-options');
  optionsBox.innerHTML = `
    <div class="custom-select-option" onclick="selectFilterCategory('Все')">Все категории</div>
  ` + cats.map(c => `
    <div class="custom-select-option" onclick="selectFilterCategory('${c}')">${c}</div>
  `).join('');

  const prices = catalog.map(c => Number(c.price) || 0).filter(p => p > 0);
  const minP = prices.length ? Math.min(...prices) : 100;
  const maxP = prices.length ? Math.max(...prices) : 10000;

  const rangeEl = document.getElementById('filter-price-range');
  const numEl = document.getElementById('filter-price-input');
  rangeEl.min = minP;
  rangeEl.max = maxP;
  rangeEl.value = maxP;
  numEl.value = maxP;
  document.getElementById('filter-min-label').innerText = `${minP} ₽`;
  document.getElementById('filter-max-label').innerText = `${maxP} ₽`;
}

function selectFilterCategory(cat) {
  selectedFilterCategoryValue = cat;
  document.getElementById('filter-cat-display').innerText = (cat === 'Все' ? 'Все категории' : cat);
  document.getElementById('filter-cat-box').classList.remove('open');
}

function openFilterModal() { document.getElementById('filter-modal').classList.add('open'); }
function closeFilterModal() { document.getElementById('filter-modal').classList.remove('open'); }

function applyFilters() {
  const cat = selectedFilterCategoryValue;
  const maxPrice = parseFloat(document.getElementById('filter-price-input').value) || 10000;

  filteredCatalog = displayCatalog.filter(item => {
    const catMatch = (cat === 'Все' || item.category === cat);
    const priceMatch = (item.price <= maxPrice);
    return catMatch && priceMatch;
  });

  renderCatalog(filteredCatalog);
  document.getElementById('catalog-filter-summary').innerHTML = `Показано: <b>${cat} (до ${maxPrice} ₽)</b>`;
  closeFilterModal();
  toast(`Найдено позиций: ${filteredCatalog.length}`);
}

function resetFilters() {
  selectFilterCategory('Все');
  const prices = catalog.map(c => Number(c.price) || 0).filter(p => p > 0);
  const maxP = prices.length ? Math.max(...prices) : 10000;
  document.getElementById('filter-price-range').value = maxP;
  document.getElementById('filter-price-input').value = maxP;
  filteredCatalog = [...displayCatalog];
  renderCatalog(filteredCatalog);
  document.getElementById('catalog-filter-summary').innerHTML = 'Показано: <b>Все</b>';
  closeFilterModal();
}

async function loadCatalog() {
  try {
    const res = await fetch(`${API_URL}?action=catalog`);
    catalog = await res.json();
    buildDisplayCatalog();
    filteredCatalog = [...displayCatalog];
    setupFilterDropdown();
    renderCatalog(filteredCatalog);
    if (typeof populateCatalogDropdown === 'function') populateCatalogDropdown();
  } catch (e) {
    toast("Ошибка загрузки каталога");
  }
}

function getCartItemQuantity(id) {
  return Object.entries(cart).reduce((sum, [key, qty]) => {
    const [itemId] = key.split(':::');
    return String(itemId) === String(id) ? sum + qty : sum;
  }, 0);
}

// Отрисовка каталога с красной точкой на кнопке «Выбрать» для групп
function renderCatalog(items) {
  const el = document.getElementById('catalog-wrap');
  el.innerHTML = items.map(p => {
    const photos = (p.photo_url || "").split(',').map(s => s.trim()).filter(Boolean);
    const firstPhoto = photos[0] || "";
    const inCartQty = getCartItemQuantity(p.id);
    const isHit = p.is_popular;
    const isAvailable = p.is_active;
    const isGroup = p.is_group;

    return `
      <div class="product-card ${isHit ? 'popular-hit' : ''} ${!isAvailable ? 'out-of-stock' : ''}" id="product-card-${p.id}" onclick="openProductModal('${p.id}')">
        <div class="product-thumb">
          ${isHit ? `<div class="hit-badge">🔥 Хит</div>` : ''}
          ${firstPhoto ? `<img src="${firstPhoto}" alt="${p.title}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
          <div class="thumb-placeholder-box" style="${firstPhoto ? 'display:none;' : ''}">
            <span class="thumb-placeholder-icon">🌸</span>
            <span class="thumb-placeholder-text">Фото пока не добавили</span>
          </div>
        </div>
        <div class="product-body">
          <div>
            <div class="product-title">${p.title}</div>
            <div class="product-unit">${p.unit || '1 шт.'}</div>
          </div>
          <div class="product-footer">
            ${isAvailable ? `
              <span class="product-price">${isGroup ? 'от ' : ''}${p.price} ₽</span>
              <div id="product-action-${p.id}">
                ${isGroup ? `
                  <button class="btn-select-variant ${isGroupInCart(p.id) ? 'has-items' : ''}" onclick="event.stopPropagation(); openProductModal('${p.id}')">Выбрать</button>
                ` : (inCartQty > 0 ? `
                  <div class="cart-active-stepper" onclick="event.stopPropagation();">
                    <button class="btn-trash-mini" onclick="event.stopPropagation(); removeAllOfItemFromCart('${p.id}')">🗑️</button>
                    <span class="cart-active-qty">${inCartQty}</span>
                    <button class="btn-trash-mini" style="font-weight:800; font-size:15px; color:var(--green);" onclick="event.stopPropagation(); quickAdd('${p.id}')">+</button>
                  </div>
                ` : `
                  <button class="btn-quick-add" onclick="event.stopPropagation(); quickAdd('${p.id}')">+</button>
                `)}
              </div>
            ` : `
              <div class="out-of-stock-badge">Нет в наличии</div>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Обновление состояния кнопки карточки товара (сохраняет «Выбрать» у групп и управляет красной точкой)
function updateProductCardAction(id) {
  const directItem = catalog.find(i => String(i.id) === String(id));
  if (directItem) {
    const groupParent = displayCatalog.find(g => g.is_group && g.title.trim() === directItem.title.trim());
    if (groupParent) {
      const groupActionEl = document.getElementById(`product-action-${groupParent.id}`);
      if (groupActionEl) {
        const hasItems = isGroupInCart(groupParent.id);
        groupActionEl.innerHTML = `<button class="btn-select-variant ${hasItems ? 'has-items' : ''}" onclick="event.stopPropagation(); openProductModal('${groupParent.id}')">Выбрать</button>`;
      }
    }
  }

  const actionEl = document.getElementById(`product-action-${id}`);
  if (!actionEl) return;

  const groupParent = displayCatalog.find(g => String(g.id) === String(id));
  if (groupParent && groupParent.is_group) {
    const hasItems = isGroupInCart(groupParent.id);
    actionEl.innerHTML = `<button class="btn-select-variant ${hasItems ? 'has-items' : ''}" onclick="event.stopPropagation(); openProductModal('${groupParent.id}')">Выбрать</button>`;
    return;
  }

  const inCartQty = getCartItemQuantity(id);
  if (inCartQty > 0) {
    actionEl.innerHTML = `
      <div class="cart-active-stepper" onclick="event.stopPropagation();">
        <button class="btn-trash-mini" onclick="event.stopPropagation(); removeAllOfItemFromCart('${id}')">🗑️</button>
        <span class="cart-active-qty">${inCartQty}</span>
        <button class="btn-trash-mini" style="font-weight:800; font-size:15px; color:var(--green);" onclick="event.stopPropagation(); quickAdd('${id}')">+</button>
      </div>
    `;
  } else {
    actionEl.innerHTML = `<button class="btn-quick-add" onclick="event.stopPropagation(); quickAdd('${id}')">+</button>`;
  }
}

// Открытие модалки карточки с 3 независимыми характеристиками (фасовка, высота, цвет)
function openProductModal(id, targetVariant = null, targetUnit = null, targetColor = null) {
  let item = null;
  let matchedInGroup = false;

  const directItem = catalog.find(i => String(i.id) === String(id));
  if (directItem) {
    const titleKey = directItem.title.trim();
    const groupParent = displayCatalog.find(g => g.is_group && g.title.trim() === titleKey);
    if (groupParent) {
      item = groupParent;
      matchedInGroup = true;
      selectedGroupPack = targetUnit || directItem.unit;
      selectedGroupVariant = targetVariant || directItem.variant;
      selectedGroupColor = targetColor || directItem.color;
    } else {
      item = directItem;
    }
  } else {
    item = displayCatalog.find(i => String(i.id) === String(id));
  }

  if (!item) return;

  activePopItem = item;
  popQty = 1;

  setupUniversalVariantChips(item, matchedInGroup ? selectedGroupPack : null, matchedInGroup ? selectedGroupVariant : null, matchedInGroup ? selectedGroupColor : null);
  updateSelectedGroupVariantUI();

  document.getElementById('product-modal').classList.add('open');
}

// Универсальный сбор и рендеринг чипсов фасовки, высоты и цвета (для групп и одиночных товаров со слэшами /)
function setupUniversalVariantChips(item, prefPack = null, prefVar = null, prefColor = null) {
  const variantBox = document.getElementById('pop-variant-box');
  const sourceItems = item.is_group ? item.variants : [item];

  let rawPacks = [];
  let rawVars = [];
  let rawColors = [];

  sourceItems.forEach(v => {
    if (v.unit) {
      v.unit.split('/').forEach(s => { if (s.trim()) rawPacks.push(s.trim()); });
    }
    if (v.variant) {
      v.variant.split('/').forEach(s => { if (s.trim()) rawVars.push(s.trim()); });
    }
    if (v.color) {
      v.color.split('/').forEach(s => { if (s.trim()) rawColors.push(s.trim()); });
    }
  });

  const packs = sortAscendingValues(Array.from(new Set(rawPacks)));
  const vars = sortAscendingValues(Array.from(new Set(rawVars)));
  const colors = sortAscendingValues(Array.from(new Set(rawColors)));

  if (prefPack && packs.includes(prefPack)) selectedGroupPack = prefPack;
  else selectedGroupPack = packs[0] || "";

  if (prefVar && vars.includes(prefVar)) selectedGroupVariant = prefVar;
  else selectedGroupVariant = vars[0] || "";

  if (prefColor && colors.includes(prefColor)) selectedGroupColor = prefColor;
  else selectedGroupColor = colors[0] || "";

  const packBlock = document.getElementById('pop-pack-block');
  const packWrap = document.getElementById('pop-pack-chips');
  if (packs.length > 1 || (item.is_group && packs.length >= 1 && packs[0] !== "1 шт.")) {
    packBlock.style.display = 'block';
    packWrap.innerHTML = packs.map(p => `
      <div class="variant-chip ${p === selectedGroupPack ? 'active' : ''}" onclick="selectProductChip('pack', '${p}')">${p}</div>
    `).join('');
  } else {
    packBlock.style.display = 'none';
  }

  const varBlock = document.getElementById('pop-variant-block');
  const varWrap = document.getElementById('pop-variant-chips');
  if (vars.length > 0) {
    varBlock.style.display = 'block';
    varWrap.innerHTML = vars.map(v => `
      <div class="variant-chip ${v === selectedGroupVariant ? 'active' : ''}" onclick="selectProductChip('variant', '${v}')">${v}</div>
    `).join('');
  } else {
    varBlock.style.display = 'none';
  }

  const colorBlock = document.getElementById('pop-color-block');
  const colorWrap = document.getElementById('pop-color-chips');
  if (colors.length > 0) {
    colorBlock.style.display = 'block';
    colorWrap.innerHTML = colors.map(c => `
      <div class="variant-chip ${c === selectedGroupColor ? 'active' : ''}" onclick="selectProductChip('color', '${c}')">${c}</div>
    `).join('');
  } else {
    colorBlock.style.display = 'none';
  }

  const hasAnySelector = (packBlock.style.display === 'block') || (varBlock.style.display === 'block') || (colorBlock.style.display === 'block');
  variantBox.style.display = hasAnySelector ? 'block' : 'none';
}

function selectProductChip(type, value) {
  if (type === 'pack') selectedGroupPack = value;
  if (type === 'variant') selectedGroupVariant = value;
  if (type === 'color') selectedGroupColor = value;

  setupUniversalVariantChips(activePopItem, selectedGroupPack, selectedGroupVariant, selectedGroupColor);
  updateSelectedGroupVariantUI();
}

// Обновление цены, наличия и описания в модалке товара
function updateSelectedGroupVariantUI() {
  if (!activePopItem) return;

  let matchedVariant = null;

  if (activePopItem.is_group) {
    matchedVariant = activePopItem.variants.find(v => {
      const packParts = (v.unit || '').split('/').map(s => s.trim());
      const varParts = (v.variant || '').split('/').map(s => s.trim());
      const colorParts = (v.color || '').split('/').map(s => s.trim());

      const packMatch = !selectedGroupPack || packParts.includes(selectedGroupPack) || v.unit.trim() === selectedGroupPack.trim();
      const varMatch = !selectedGroupVariant || varParts.includes(selectedGroupVariant) || v.variant.trim() === selectedGroupVariant.trim();
      const colorMatch = !selectedGroupColor || colorParts.includes(selectedGroupColor) || v.color.trim() === selectedGroupColor.trim();

      return packMatch && varMatch && colorMatch;
    });
  } else {
    matchedVariant = activePopItem;
  }

  document.getElementById('pop-title').innerText = activePopItem.title;
  document.getElementById('pop-cat').innerText = activePopItem.category;
  document.getElementById('pop-unit').innerText = selectedGroupPack || matchedVariant?.unit || activePopItem.unit || '1 шт.';
  document.getElementById('pop-qty').innerText = popQty;

  const addBtn = document.getElementById('pop-add-cart-btn');
  const qtyBox = document.getElementById('pop-qty-controls');

  if (!matchedVariant || !matchedVariant.is_active) {
    document.getElementById('pop-price').innerText = matchedVariant ? `${matchedVariant.price} ₽` : "— ₽";
    document.getElementById('pop-desc').innerText = "Данная вариация сейчас отсутствует в наличии.";
    addBtn.innerText = "Нет в наличии";
    addBtn.style.background = "var(--card-inner)";
    addBtn.style.color = "var(--text-muted)";
    addBtn.disabled = true;
    qtyBox.style.display = 'none';
    renderPopGallery(activePopItem.photo_url);
  } else {
    document.getElementById('pop-price').innerText = `${matchedVariant.price} ₽`;
    document.getElementById('pop-desc').innerText = matchedVariant.description || activePopItem.description || 'Свежесрезанные сортовые цветы высшей категории.';
    addBtn.innerText = "Добавить в заказ";
    addBtn.style.background = "var(--green)";
    addBtn.style.color = "#fff";
    addBtn.disabled = false;
    qtyBox.style.display = 'flex';
    renderPopGallery(matchedVariant.photo_url || activePopItem.photo_url);
  }
}

// Счетчик фото галереи с обновлением при скролле
function renderPopGallery(photosStr) {
  const gallery = document.getElementById('pop-gallery');
  const placeholder = document.getElementById('pop-placeholder');
  const counter = document.getElementById('pop-gallery-counter');
  const photos = (photosStr || "").split(',').map(s => s.trim()).filter(Boolean);

  if (photos.length) {
    gallery.innerHTML = photos.map(url => `<img src="${url}" class="gallery-slide-img">`).join('');
    gallery.style.display = 'flex';
    gallery.scrollLeft = 0;
    placeholder.style.display = 'none';

    if (photos.length > 1) {
      if (counter) {
        counter.innerText = `1 / ${photos.length}`;
        counter.style.display = 'block';
      }
      gallery.onscroll = () => {
        const itemWidth = gallery.clientWidth || 1;
        const currentIdx = Math.round(gallery.scrollLeft / itemWidth);
        if (counter) {
          counter.innerText = `${Math.min(photos.length, Math.max(1, currentIdx + 1))} / ${photos.length}`;
        }
      };
    } else {
      if (counter) counter.style.display = 'none';
      gallery.onscroll = null;
    }
  } else {
    gallery.innerHTML = '';
    gallery.style.display = 'none';
    placeholder.style.display = 'flex';
    if (counter) counter.style.display = 'none';
    gallery.onscroll = null;
  }
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('open');
  const counter = document.getElementById('pop-gallery-counter');
  if (counter) counter.style.display = 'none';
}

function adjustPopQty(delta) { 
  popQty = Math.max(1, popQty + delta); 
  document.getElementById('pop-qty').innerText = popQty; 
}
