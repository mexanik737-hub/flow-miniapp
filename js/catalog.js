// --- Состояние каталога ---
let catalog = [];
let displayCatalog = [];
let filteredCatalog = [];

let activePopItem = null;
let popQty = 1;
let selectedGroupPack = "";
let selectedGroupVariant = "";
let selectedGroupColor = "";

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

function renderCatalog(items) {
  const el = document.getElementById('catalog-wrap');
  if (!el) return;

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
                    <button class="btn-trash-mini" onclick="removeAllOfItemFromCart('${p.id}')">🗑️</button>
                    <span class="cart-active-qty">${inCartQty}</span>
                    <button class="btn-trash-mini" style="font-weight:800; font-size:15px; color:var(--green);" onclick="quickAdd('${p.id}', event)">+</button>
                  </div>
                ` : `
                  <button class="btn-quick-add" onclick="quickAdd('${p.id}', event)">+</button>
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

// Открытие карточки букета с тремя независимыми характеристиками
function openProductModal(id, targetUnit = null, targetVariant = null, targetColor = null) {
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

  // Логирование просмотра товара/группы для статистики
  if (typeof trackStatEvent === 'function') {
    trackStatEvent(item.is_group ? 'view_group' : 'view_product', item.id, { title: item.title });
  }

  const variantBox = document.getElementById('pop-variant-box');
  if (item.is_group) {
    variantBox.style.display = 'block';
    setupGroupPills(item, matchedInGroup ? selectedGroupPack : null, matchedInGroup ? selectedGroupVariant : null, matchedInGroup ? selectedGroupColor : null);
    updateSelectedGroupUI();
  } else {
    setupSingleItemPills(item);
  }

  document.getElementById('product-modal').classList.add('open');
}

function parseSlashValues(rawVal) {
  if (!rawVal) return [];
  return sortAscendingValues(rawVal.split('/').map(s => s.trim()).filter(Boolean));
}

function setupSingleItemPills(item) {
  const packs = parseSlashValues(item.unit);
  const vars = parseSlashValues(item.variant);
  const colors = parseSlashValues(item.color);

  selectedGroupPack = packs[0] || item.unit || "1 шт.";
  selectedGroupVariant = vars[0] || item.variant || "";
  selectedGroupColor = colors[0] || item.color || "";

  renderSelectorBlock('pop-pack-block', 'pop-pack-chips', packs, selectedGroupPack, (v) => { selectedGroupPack = v; setupSingleItemPills(item); });
  renderSelectorBlock('pop-variant-block', 'pop-variant-chips', vars, selectedGroupVariant, (v) => { selectedGroupVariant = v; setupSingleItemPills(item); });
  renderSelectorBlock('pop-color-block', 'pop-color-chips', colors, selectedGroupColor, (v) => { selectedGroupColor = v; setupSingleItemPills(item); });

  const hasAnySelector = (packs.length > 1 || vars.length > 0 || colors.length > 0);
  document.getElementById('pop-variant-box').style.display = hasAnySelector ? 'block' : 'none';

  document.getElementById('pop-title').innerText = item.title;
  document.getElementById('pop-cat').innerText = item.category;
  document.getElementById('pop-unit').innerText = selectedGroupPack;
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

function setupGroupPills(group, prefPack = null, prefVar = null, prefColor = null) {
  let allPacks = [], allVars = [], allColors = [];

  group.variants.forEach(v => {
    if (v.unit) allPacks.push(...v.unit.split('/').map(s => s.trim()));
    if (v.variant) allVars.push(...v.variant.split('/').map(s => s.trim()));
    if (v.color) allColors.push(...v.color.split('/').map(s => s.trim()));
  });

  const packs = sortAscendingValues(Array.from(new Set(allPacks.filter(Boolean))));
  const vars = sortAscendingValues(Array.from(new Set(allVars.filter(Boolean))));
  const colors = sortAscendingValues(Array.from(new Set(allColors.filter(Boolean))));

  selectedGroupPack = (prefPack && packs.includes(prefPack)) ? prefPack : (packs[0] || "");
  selectedGroupVariant = (prefVar && vars.includes(prefVar)) ? prefVar : (vars[0] || "");
  selectedGroupColor = (prefColor && colors.includes(prefColor)) ? prefColor : (colors[0] || "");

  renderSelectorBlock('pop-pack-block', 'pop-pack-chips', packs, selectedGroupPack, (v) => { selectedGroupPack = v; updateSelectedGroupUI(); });
  renderSelectorBlock('pop-variant-block', 'pop-variant-chips', vars, selectedGroupVariant, (v) => { selectedGroupVariant = v; updateSelectedGroupUI(); });
  renderSelectorBlock('pop-color-block', 'pop-color-chips', colors, selectedGroupColor, (v) => { selectedGroupColor = v; updateSelectedGroupUI(); });
}

function renderSelectorBlock(blockId, chipsWrapId, items, currentVal, onClickFn) {
  const block = document.getElementById(blockId);
  const wrap = document.getElementById(chipsWrapId);
  if (!block || !wrap) return;

  if (items.length > 0) {
    block.style.display = 'block';
    wrap.innerHTML = items.map(val => `
      <div class="variant-chip ${val === currentVal ? 'active' : ''}" onclick="window['chip_cb_${chipsWrapId}']('${val}')">${val}</div>
    `).join('');
    window[`chip_cb_${chipsWrapId}`] = (v) => {
      onClickFn(v);
      wrap.querySelectorAll('.variant-chip').forEach(c => c.classList.toggle('active', c.innerText.trim() === v));
    };
  } else {
    block.style.display = 'none';
  }
}

function updateSelectedGroupUI() {
  if (!activePopItem || !activePopItem.is_group) return;

  const matched = activePopItem.variants.find(v => {
    const packMatch = !selectedGroupPack || v.unit.split('/').map(s => s.trim()).includes(selectedGroupPack);
    const varMatch = !selectedGroupVariant || !v.variant || v.variant.split('/').map(s => s.trim()).includes(selectedGroupVariant);
    const colMatch = !selectedGroupColor || !v.color || v.color.split('/').map(s => s.trim()).includes(selectedGroupColor);
    return packMatch && varMatch && colMatch;
  });

  const addBtn = document.getElementById('pop-add-cart-btn');
  const qtyBox = document.getElementById('pop-qty-controls');

  document.getElementById('pop-title').innerText = activePopItem.title;
  document.getElementById('pop-cat').innerText = activePopItem.category;
  document.getElementById('pop-unit').innerText = selectedGroupPack || activePopItem.unit;

  if (!matched || !matched.is_active) {
    document.getElementById('pop-price').innerText = matched ? `${matched.price} ₽` : "— ₽";
    document.getElementById('pop-desc').innerText = "Данная вариация сейчас отсутствует в наличии.";
    addBtn.innerText = "Нет в наличии";
    addBtn.style.background = "var(--card-inner)";
    addBtn.style.color = "var(--text-muted)";
    addBtn.disabled = true;
    qtyBox.style.display = 'none';
    renderPopGallery(activePopItem.photo_url);
  } else {
    document.getElementById('pop-price').innerText = `${matched.price} ₽`;
    document.getElementById('pop-desc').innerText = matched.description || activePopItem.description;
    addBtn.innerText = "Добавить в заказ";
    addBtn.style.background = "var(--green)";
    addBtn.style.color = "#fff";
    addBtn.disabled = false;
    qtyBox.style.display = 'flex';
    renderPopGallery(matched.photo_url || activePopItem.photo_url);
  }
}

// Рендер галереи с индикатором слайдов (например, 2 / 3)
function renderPopGallery(photosStr) {
  const gallery = document.getElementById('pop-gallery');
  const placeholder = document.getElementById('pop-placeholder');
  const counter = document.getElementById('pop-gallery-counter');
  const photos = (photosStr || "").split(',').map(s => s.trim()).filter(Boolean);

  if (photos.length) {
    gallery.innerHTML = photos.map(url => `<img src="${url}" class="gallery-slide-img">`).join('');
    gallery.style.display = 'flex';
    placeholder.style.display = 'none';

    if (photos.length > 1 && counter) {
      counter.style.display = 'block';
      counter.innerText = `1 / ${photos.length}`;
      gallery.onscroll = () => {
        const idx = Math.min(photos.length, Math.max(1, Math.round(gallery.scrollLeft / gallery.clientWidth) + 1));
        counter.innerText = `${idx} / ${photos.length}`;
      };
    } else if (counter) {
      counter.style.display = 'none';
    }
  } else {
    gallery.innerHTML = '';
    gallery.style.display = 'none';
    placeholder.style.display = 'flex';
    if (counter) counter.style.display = 'none';
  }
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('open');
}

function adjustPopQty(delta) {
  popQty = Math.max(1, popQty + delta);
  document.getElementById('pop-qty').innerText = popQty;
}

// Фильтры
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
  if (rangeEl && numEl) {
    rangeEl.min = minP; rangeEl.max = maxP; rangeEl.value = maxP;
    numEl.value = maxP;
    document.getElementById('filter-min-label').innerText = `${minP} ₽`;
    document.getElementById('filter-max-label').innerText = `${maxP} ₽`;
  }
}

let selectedFilterCategoryValue = 'Все';
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
