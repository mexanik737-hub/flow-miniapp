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
                  <button class="btn-select-variant" onclick="event.stopPropagation(); openProductModal('${p.id}')">Выбрать</button>
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

function updateProductCardAction(id) {
  const actionEl = document.getElementById(`product-action-${id}`);
  if (!actionEl) return;
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

function openProductModal(id, targetVariant = null, targetUnit = null) {
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
    } else {
      item = directItem;
    }
  } else {
    item = displayCatalog.find(i => String(i.id) === String(id));
  }

  if (!item) return;

  activePopItem = item;
  popQty = 1;

  const variantBox = document.getElementById('pop-variant-box');
  if (item.is_group) {
    variantBox.style.display = 'block';
    setupGroupVariantChips(item, matchedInGroup ? selectedGroupPack : null, matchedInGroup ? selectedGroupVariant : null);
    updateSelectedGroupVariantUI();
  } else {
    const hasSlashVariants = item.variant && item.variant.includes('/');
    if (hasSlashVariants) {
      variantBox.style.display = 'block';
      setupSingleItemSlashVariants(item);
    } else {
      variantBox.style.display = 'none';
      selectedGroupVariant = item.variant || "";
      setupSingleItemPopUI(item);
    }
  }

  document.getElementById('product-modal').classList.add('open');
}

function setupSingleItemPopUI(item) {
  document.getElementById('pop-title').innerText = item.title;
  document.getElementById('pop-cat').innerText = item.category;
  document.getElementById('pop-unit').innerText = item.unit || '1 шт.';
  document.getElementById('pop-desc').innerText = item.description || 'Свежесрезанные сортовые цветы высшей категории.';
  document.getElementById('pop-price').innerText = item.price + ' ₽';
  document.getElementById('pop-qty').innerText = '1';

  renderPopGallery(item.photo_url);

  const addBtn = document.getElementById('pop-add-cart-btn');
  const qtyBox = document.getElementById('pop-qty-controls');
  if (!item.is_active) {
    addBtn.innerText = "Нет в наличии";
    addBtn.style.background = "var(--card-inner)";
    addBtn.style.color = "var(--text-muted)";
    addBtn.disabled = true;
    qtyBox.style.display = 'none';
  } else {
    addBtn.innerText = "Добавить в заказ";
    addBtn.style.background = "var(--green)";
    addBtn.style.color = "#fff";
    addBtn.disabled = false;
    qtyBox.style.display = 'flex';
  }
}

function setupSingleItemSlashVariants(item) {
  document.getElementById('pop-pack-block').style.display = 'none';
  const varBlock = document.getElementById('pop-variant-block');
  const varWrap = document.getElementById('pop-variant-chips');
  varBlock.style.display = 'block';

  const rawVars = item.variant.split('/').map(s => s.trim()).filter(Boolean);
  const vars = sortAscendingValues(rawVars);

  if (!selectedGroupVariant || !vars.includes(selectedGroupVariant)) {
    selectedGroupVariant = vars[0] || "";
  }

  varWrap.innerHTML = vars.map(v => `
    <div class="variant-chip ${v === selectedGroupVariant ? 'active' : ''}" onclick="selectSingleSlashVariant('${v}')">${v}</div>
  `).join('');

  document.getElementById('pop-title').innerText = `${item.title} (${selectedGroupVariant})`;
  document.getElementById('pop-cat').innerText = item.category;
  document.getElementById('pop-unit').innerText = item.unit || '1 шт.';
  document.getElementById('pop-desc').innerText = item.description || 'Свежесрезанные сортовые цветы высшей категории.';
  document.getElementById('pop-price').innerText = item.price + ' ₽';
  document.getElementById('pop-qty').innerText = '1';
  renderPopGallery(item.photo_url);
}

function selectSingleSlashVariant(v) {
  selectedGroupVariant = v;
  if (activePopItem) setupSingleItemSlashVariants(activePopItem);
}

function setupGroupVariantChips(group, preferredPack = null, preferredVar = null) {
  const rawPacks = Array.from(new Set(group.variants.map(v => v.unit).filter(Boolean)));
  const packs = sortAscendingValues(rawPacks);

  let allRawVars = [];
  group.variants.forEach(v => {
    if (v.variant) {
      if (v.variant.includes('/')) {
        allRawVars.push(...v.variant.split('/').map(s => s.trim()));
      } else {
        allRawVars.push(v.variant.trim());
      }
    }
  });
  const vars = sortAscendingValues(Array.from(new Set(allRawVars.filter(Boolean))));

  if (preferredPack && packs.includes(preferredPack)) {
    selectedGroupPack = preferredPack;
  } else if (!selectedGroupPack || !packs.includes(selectedGroupPack)) {
    selectedGroupPack = packs[0] || "";
  }

  if (preferredVar && vars.includes(preferredVar)) {
    selectedGroupVariant = preferredVar;
  } else if (!selectedGroupVariant || !vars.includes(selectedGroupVariant)) {
    selectedGroupVariant = vars[0] || "";
  }

  const packBlock = document.getElementById('pop-pack-block');
  const packWrap = document.getElementById('pop-pack-chips');
  if (packs.length > 1 || (packs.length === 1 && vars.length > 0)) {
    packBlock.style.display = 'block';
    packWrap.innerHTML = packs.map(p => `
      <div class="variant-chip ${p === selectedGroupPack ? 'active' : ''}" onclick="selectGroupPack('${p}')">${p}</div>
    `).join('');
  } else {
    packBlock.style.display = 'none';
  }

  const varBlock = document.getElementById('pop-variant-block');
  const varWrap = document.getElementById('pop-variant-chips');
  if (vars.length > 0) {
    varBlock.style.display = 'block';
    varWrap.innerHTML = vars.map(v => `
      <div class="variant-chip ${v === selectedGroupVariant ? 'active' : ''}" onclick="selectGroupVariant('${v}')">${v}</div>
    `).join('');
  } else {
    varBlock.style.display = 'none';
  }
}

function selectGroupPack(pack) {
  selectedGroupPack = pack;
  setupGroupVariantChips(activePopItem, pack, selectedGroupVariant);
  updateSelectedGroupVariantUI();
}

function selectGroupVariant(v) {
  selectedGroupVariant = v;
  setupGroupVariantChips(activePopItem, selectedGroupPack, v);
  updateSelectedGroupVariantUI();
}

function updateSelectedGroupVariantUI() {
  if (!activePopItem || !activePopItem.is_group) return;

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

  const varText = selectedGroupVariant ? ` (${selectedGroupVariant})` : '';
  const packText = selectedGroupPack ? ` [${selectedGroupPack}]` : '';
  document.getElementById('pop-title').innerText = `${activePopItem.title}${varText}${packText}`;
  document.getElementById('pop-cat').innerText = activePopItem.category;
  document.getElementById('pop-unit').innerText = selectedGroupPack || activePopItem.unit;

  const addBtn = document.getElementById('pop-add-cart-btn');
  const qtyBox = document.getElementById('pop-qty-controls');

  if (!variant || !variant.is_active) {
    document.getElementById('pop-price').innerText = variant ? `${variant.price} ₽` : "— ₽";
    document.getElementById('pop-desc').innerText = "Данная вариация сейчас отсутствует в наличии.";
    addBtn.innerText = "Нет в наличии";
    addBtn.style.background = "var(--card-inner)";
    addBtn.style.color = "var(--text-muted)";
    addBtn.disabled = true;
    qtyBox.style.display = 'none';
    renderPopGallery(activePopItem.photo_url);
  } else {
    document.getElementById('pop-price').innerText = `${variant.price} ₽`;
    document.getElementById('pop-desc').innerText = variant.description || activePopItem.description;
    addBtn.innerText = "Добавить в заказ";
    addBtn.style.background = "var(--green)";
    addBtn.style.color = "#fff";
    addBtn.disabled = false;
    qtyBox.style.display = 'flex';
    renderPopGallery(variant.photo_url || activePopItem.photo_url);
  }
}

// Правка 9: Счетчик фото галереи с обновлением при скролле
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

function adjustPopQty(delta) { popQty = Math.max(1, popQty + delta); document.getElementById('pop-qty').innerText = popQty; }
