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
window.formatFullItemTitle = formatFullItemTitle;

function isGroupInCart(groupIdOrTitle) {
  const group = displayCatalog.find(g => String(g.id) === String(groupIdOrTitle) || (g.title || '').trim() === String(groupIdOrTitle).trim());
  if (!group || !group.variants) return false;
  return group.variants.some(v => getCartItemQuantity(v.id) > 0);
}
window.isGroupInCart = isGroupInCart;

function buildDisplayCatalog() {
  const groupsMap = {};
  const orderTracker = [];

  catalog.forEach(item => {
    const titleKey = (item.title || '').trim();
    if (!titleKey) return;
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
    const minPrice = prices.length ? Math.min(...prices) : 0;
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

function renderDailyBloom() {
  try {
    const container = document.getElementById('daily-bloom-container');
    if (!container) return;

    if (typeof getDailyBloomItem !== 'function') return;
    const bloomItem = getDailyBloomItem(displayCatalog, userId);
    if (!bloomItem) {
      container.innerHTML = '';
      return;
    }

    const photos = (bloomItem.photo_url || "").split(',').map(s => s.trim()).filter(Boolean);
    const thumb = photos[0] || "";
    const isGroup = bloomItem.is_group;

    container.innerHTML = `
      <div class="daily-bloom-card" onclick="triggerHaptic('selection'); openProductModal('${bloomItem.id}')">
        <div class="daily-bloom-header">
          <span class="daily-bloom-tag">✨ Букет дня</span>
          <span class="daily-bloom-time">Обновление в 09:00</span>
        </div>
        <div class="daily-bloom-content">
          <div class="daily-bloom-thumb">
            ${thumb ? `<img src="${thumb}" alt="${bloomItem.title}">` : '<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:28px;">🌸</div>'}
          </div>
          <div class="daily-bloom-info">
            <div class="daily-bloom-title">${bloomItem.title}</div>
            <div class="daily-bloom-unit">${bloomItem.unit || 'Премиальная срезка'}</div>
            <div class="daily-bloom-footer">
              <span class="daily-bloom-price">${isGroup ? 'от ' : ''}${bloomItem.price} ₽</span>
              <button class="daily-bloom-btn" onclick="event.stopPropagation(); triggerHaptic('selection'); openProductModal('${bloomItem.id}')">
                Выбрать
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Daily bloom render error:", err);
  }
}
window.renderDailyBloom = renderDailyBloom;

function setupFilterDropdown() {
  const cats = Array.from(new Set(catalog.map(c => c.category).filter(Boolean)));
  const optionsBox = document.getElementById('filter-cat-options');
  if (!optionsBox) return;

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
  if (rangeEl) { rangeEl.min = minP; rangeEl.max = maxP; rangeEl.value = maxP; }
  if (numEl) numEl.value = maxP;
  const minLbl = document.getElementById('filter-min-label');
  const maxLbl = document.getElementById('filter-max-label');
  if (minLbl) minLbl.innerText = `${minP} ₽`;
  if (maxLbl) maxLbl.innerText = `${maxP} ₽`;
}

function selectFilterCategory(cat) {
  triggerHaptic('selection');
  selectedFilterCategoryValue = cat;
  const disp = document.getElementById('filter-cat-display');
  if (disp) disp.innerText = (cat === 'Все' ? 'Все категории' : cat);
  const box = document.getElementById('filter-cat-box');
  if (box) box.classList.remove('open');
}
window.selectFilterCategory = selectFilterCategory;

function openFilterModal() { 
  triggerHaptic('selection');
  const m = document.getElementById('filter-modal');
  if (m) m.classList.add('open'); 
}
window.openFilterModal = openFilterModal;

function closeFilterModal() { 
  triggerHaptic('light');
  const m = document.getElementById('filter-modal');
  if (m) m.classList.remove('open'); 
}
window.closeFilterModal = closeFilterModal;

function applyFilters() {
  triggerHaptic('medium');
  const cat = selectedFilterCategoryValue;
  const maxPrice = parseFloat(document.getElementById('filter-price-input')?.value) || 10000;

  filteredCatalog = displayCatalog.filter(item => {
    const catMatch = (cat === 'Все' || item.category === cat);
    const priceMatch = (item.price <= maxPrice);
    return catMatch && priceMatch;
  });

  renderCatalog(filteredCatalog);
  const sumEl = document.getElementById('catalog-filter-summary');
  if (sumEl) sumEl.innerHTML = `Показано: <b>${cat} (до ${maxPrice} ₽)</b>`;
  closeFilterModal();
  toast(`Найдено позиций: ${filteredCatalog.length}`);
}
window.applyFilters = applyFilters;

function resetFilters() {
  triggerHaptic('medium');
  selectFilterCategory('Все');
  const prices = catalog.map(c => Number(c.price) || 0).filter(p => p > 0);
  const maxP = prices.length ? Math.max(...prices) : 10000;
  const rangeEl = document.getElementById('filter-price-range');
  const numEl = document.getElementById('filter-price-input');
  if (rangeEl) rangeEl.value = maxP;
  if (numEl) numEl.value = maxP;
  filteredCatalog = [...displayCatalog];
  renderCatalog(filteredCatalog);
  const sumEl = document.getElementById('catalog-filter-summary');
  if (sumEl) sumEl.innerHTML = 'Показано: <b>Все</b>';
  closeFilterModal();
}
window.resetFilters = resetFilters;

async function loadCatalog() {
  try {
    const res = await fetch(`${API_URL}?action=catalog`);
    catalog = await res.json();
    buildDisplayCatalog();
    filteredCatalog = [...displayCatalog];
    setupFilterDropdown();
    renderDailyBloom();
    renderCatalog(filteredCatalog);
    if (typeof updateCartUI === 'function') updateCartUI();
    if (typeof populateCatalogDropdown === 'function') populateCatalogDropdown();
  } catch (e) {
    console.error("loadCatalog error:", e);
    toast("Ошибка загрузки каталога");
  }
}
window.loadCatalog = loadCatalog;

function getCartItemQuantity(id) {
  return Object.entries(cart || {}).reduce((sum, [key, qty]) => {
    const [itemId] = key.split(':::');
    return String(itemId) === String(id) ? sum + qty : sum;
  }, 0);
}
window.getCartItemQuantity = getCartItemQuantity;

function renderCatalog(items) {
  const el = document.getElementById('catalog-wrap');
  if (!el) return;

  el.innerHTML = (items || []).map(p => {
    const photos = (p.photo_url || "").split(',').map(s => s.trim()).filter(Boolean);
    const firstPhoto = photos[0] || "";
    const inCartQty = getCartItemQuantity(p.id);
    const isHit = p.is_popular;
    const isAvailable = p.is_active;
    const isGroup = p.is_group;

    return `
      <div class="product-card ${isHit ? 'popular-hit' : ''} ${!isAvailable ? 'out-of-stock' : ''}" id="product-card-${p.id}" onclick="triggerHaptic('selection'); openProductModal('${p.id}')">
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
                  <button class="btn-select-variant ${isGroupInCart(p.id) ? 'has-items' : ''}" onclick="event.stopPropagation(); triggerHaptic('selection'); openProductModal('${p.id}')">Выбрать</button>
                ` : (inCartQty > 0 ? `
                  <div class="cart-active-stepper" onclick="event.stopPropagation();">
                    ${inCartQty === 1 ? `
                      <button class="btn-trash-mini" onclick="event.stopPropagation(); removeAllOfItemFromCart('${p.id}')">🗑️</button>
                    ` : `
                      <button class="btn-trash-mini" style="font-weight:800; font-size:16px; color:var(--text);" onclick="event.stopPropagation(); quickDecrease('${p.id}')">–</button>
                    `}
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
window.renderCatalog = renderCatalog;

function quickDecrease(id) {
  triggerHaptic('medium');
  const targetKey = Object.keys(cart || {}).find(k => {
    const [itemId] = k.split(':::');
    return String(itemId) === String(id);
  });

  if (targetKey && typeof modifyCartByKey === 'function') {
    modifyCartByKey(targetKey, -1);
  }
}
window.quickDecrease = quickDecrease;

function updateProductCardAction(id) {
  const directItem = catalog.find(i => String(i.id) === String(id));
  if (directItem) {
    const groupParent = displayCatalog.find(g => g.is_group && (g.title || '').trim() === (directItem.title || '').trim());
    if (groupParent) {
      const groupActionEl = document.getElementById(`product-action-${groupParent.id}`);
      if (groupActionEl) {
        const hasItems = isGroupInCart(groupParent.id);
        groupActionEl.innerHTML = `<button class="btn-select-variant ${hasItems ? 'has-items' : ''}" onclick="event.stopPropagation(); triggerHaptic('selection'); openProductModal('${groupParent.id}')">Выбрать</button>`;
      }
    }
  }

  const actionEl = document.getElementById(`product-action-${id}`);
  if (!actionEl) return;

  const groupParent = displayCatalog.find(g => String(g.id) === String(id));
  if (groupParent && groupParent.is_group) {
    const hasItems = isGroupInCart(groupParent.id);
    actionEl.innerHTML = `<button class="btn-select-variant ${hasItems ? 'has-items' : ''}" onclick="event.stopPropagation(); triggerHaptic('selection'); openProductModal('${groupParent.id}')">Выбрать</button>`;
    return;
  }

  const inCartQty = getCartItemQuantity(id);
  if (inCartQty > 0) {
    actionEl.innerHTML = `
      <div class="cart-active-stepper" onclick="event.stopPropagation();">
        ${inCartQty === 1 ? `
          <button class="btn-trash-mini" onclick="event.stopPropagation(); removeAllOfItemFromCart('${id}')">🗑️</button>
        ` : `
          <button class="btn-trash-mini" style="font-weight:800; font-size:16px; color:var(--text);" onclick="event.stopPropagation(); quickDecrease('${id}')">–</button>
        `}
        <span class="cart-active-qty">${inCartQty}</span>
        <button class="btn-trash-mini" style="font-weight:800; font-size:15px; color:var(--green);" onclick="event.stopPropagation(); quickAdd('${id}')">+</button>
      </div>
    `;
  } else {
    actionEl.innerHTML = `<button class="btn-quick-add" onclick="event.stopPropagation(); quickAdd('${id}')">+</button>`;
  }
}
window.updateProductCardAction = updateProductCardAction;

function openProductModal(id, targetVariant = null, targetUnit = null, targetColor = null) {
  let item = null;
  let matchedInGroup = false;

  const directItem = catalog.find(i => String(i.id) === String(id));
  if (directItem) {
    const titleKey = (directItem.title || '').trim();
    const groupParent = displayCatalog.find(g => g.is_group && (g.title || '').trim() === titleKey);
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

  const statRefId = item.is_group && item.variants && item.variants[0] ? item.variants[0].id : item.id;
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: "track_stat", type: "product_view", ref_id: String(statRefId) })
  }).catch(() => {});

  setupUniversalVariantChips(item, matchedInGroup ? selectedGroupPack : null, matchedInGroup ? selectedGroupVariant : null, matchedInGroup ? selectedGroupColor : null);
  updateSelectedGroupVariantUI();

  const m = document.getElementById('product-modal');
  if (m) m.classList.add('open');
}
window.openProductModal = openProductModal;

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
  if (packBlock && packWrap) {
    if (packs.length > 1 || (item.is_group && packs.length >= 1 && packs[0] !== "1 шт.")) {
      packBlock.style.display = 'block';
      packWrap.innerHTML = packs.map(p => `
        <div class="variant-chip ${p === selectedGroupPack ? 'active' : ''}" onclick="selectProductChip('pack', '${p}')">${p}</div>
      `).join('');
    } else {
      packBlock.style.display = 'none';
    }
  }

  const varBlock = document.getElementById('pop-variant-block');
  const varWrap = document.getElementById('pop-variant-chips');
  if (varBlock && varWrap) {
    if (vars.length > 0) {
      varBlock.style.display = 'block';
      varWrap.innerHTML = vars.map(v => `
        <div class="variant-chip ${v === selectedGroupVariant ? 'active' : ''}" onclick="selectProductChip('variant', '${v}')">${v}</div>
      `).join('');
    } else {
      varBlock.style.display = 'none';
    }
  }

  const colorBlock = document.getElementById('pop-color-block');
  const colorWrap = document.getElementById('pop-color-chips');
  if (colorBlock && colorWrap) {
    if (colors.length > 0) {
      colorBlock.style.display = 'block';
      colorWrap.innerHTML = colors.map(c => `
        <div class="variant-chip ${c === selectedGroupColor ? 'active' : ''}" onclick="selectProductChip('color', '${c}')">${c}</div>
      `).join('');
    } else {
      colorBlock.style.display = 'none';
    }
  }

  if (variantBox) {
    const hasAnySelector = (packBlock?.style.display === 'block') || (varBlock?.style.display === 'block') || (colorBlock?.style.display === 'block');
    variantBox.style.display = hasAnySelector ? 'block' : 'none';
  }
}

function selectProductChip(type, value) {
  triggerHaptic('light');
  if (type === 'pack') selectedGroupPack = value;
  if (type === 'variant') selectedGroupVariant = value;
  if (type === 'color') selectedGroupColor = value;

  setupUniversalVariantChips(activePopItem, selectedGroupPack, selectedGroupVariant, selectedGroupColor);
  updateSelectedGroupVariantUI();
}
window.selectProductChip = selectProductChip;

function updateSelectedGroupVariantUI() {
  if (!activePopItem) return;

  let matchedVariant = null;

  if (activePopItem.is_group) {
    matchedVariant = activePopItem.variants.find(v => {
      const packParts = (v.unit || '').split('/').map(s => s.trim());
      const varParts = (v.variant || '').split('/').map(s => s.trim());
      const colorParts = (v.color || '').split('/').map(s => s.trim());

      const packMatch = !selectedGroupPack || packParts.includes(selectedGroupPack) || (v.unit || '').trim() === selectedGroupPack.trim();
      const varMatch = !selectedGroupVariant || varParts.includes(selectedGroupVariant) || (v.variant || '').trim() === selectedGroupVariant.trim();
      const colorMatch = !selectedGroupColor || colorParts.includes(selectedGroupColor) || (v.color || '').trim() === selectedGroupColor.trim();

      return packMatch && varMatch && colorMatch;
    });
  } else {
    matchedVariant = activePopItem;
  }

  const popT = document.getElementById('pop-title');
  const popC = document.getElementById('pop-cat');
  const popU = document.getElementById('pop-unit');
  const popQ = document.getElementById('pop-qty');

  if (popT) popT.innerText = activePopItem.title;
  if (popC) popC.innerText = activePopItem.category;
  if (popU) popU.innerText = selectedGroupPack || matchedVariant?.unit || activePopItem.unit || '1 шт.';
  if (popQ) popQ.innerText = popQty;

  const addBtn = document.getElementById('pop-add-cart-btn');
  const qtyBox = document.getElementById('pop-qty-controls');
  const popP = document.getElementById('pop-price');
  const popD = document.getElementById('pop-desc');

  if (!matchedVariant || !matchedVariant.is_active) {
    if (popP) popP.innerText = matchedVariant ? `${matchedVariant.price} ₽` : "— ₽";
    if (popD) popD.innerText = "Данная вариация сейчас отсутствует в наличии.";
    if (addBtn) {
      addBtn.innerText = "Нет в наличии";
      addBtn.style.background = "var(--card-inner)";
      addBtn.style.color = "var(--text-muted)";
      addBtn.disabled = true;
    }
    if (qtyBox) qtyBox.style.display = 'none';
    renderPopGallery(activePopItem.photo_url);
  } else {
    if (popP) popP.innerText = `${matchedVariant.price} ₽`;
    if (popD) popD.innerText = matchedVariant.description || activePopItem.description || 'Свежесрезанные сортовые цветы высшей категории.';
    if (addBtn) {
      addBtn.innerText = "Добавить в заказ";
      addBtn.style.background = "linear-gradient(135deg, var(--green) 0%, #0a704e 100%)";
      addBtn.style.color = "#fff";
      addBtn.disabled = false;
    }
    if (qtyBox) qtyBox.style.display = 'flex';
    renderPopGallery(matchedVariant.photo_url || activePopItem.photo_url);
  }
}

function renderPopGallery(photosStr) {
  const gallery = document.getElementById('pop-gallery');
  const placeholder = document.getElementById('pop-placeholder');
  const counter = document.getElementById('pop-gallery-counter');
  if (!gallery || !placeholder) return;

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
  triggerHaptic('light');
  const m = document.getElementById('product-modal');
  if (m) m.classList.remove('open');
  const counter = document.getElementById('pop-gallery-counter');
  if (counter) counter.style.display = 'none';
}
window.closeProductModal = closeProductModal;

function adjustPopQty(delta) { 
  triggerHaptic('light');
  popQty = Math.max(1, popQty + delta); 
  const q = document.getElementById('pop-qty');
  if (q) q.innerText = popQty; 
}
window.adjustPopQty = adjustPopQty;
