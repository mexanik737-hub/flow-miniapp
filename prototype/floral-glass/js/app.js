import { productRecords, initialOrders, clients, faqRecords, broadcastDraft } from "./data.js";
import { escapeHTML, formatPrice, toProductViewModel, selectedPrice, renderProductCard, renderOptionGroups, renderOrderRow, renderSummary } from "./components.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORE_KEY = "floral-glass-prototype-v2";
const THEME_KEY = "floral-glass-theme-v2";
const records = productRecords.map(toProductViewModel);
const byId = new Map(records.map(record => [record.id, record]));
const safeParse = (text, fallback) => { try { return JSON.parse(text) ?? fallback; } catch { return fallback; } };
const readStore = () => safeParse(localStorage.getItem(STORE_KEY), { cart: [] });
const state = {
  cart: Array.isArray(readStore().cart) ? readStore().cart : [],
  orders: initialOrders.map(order => ({ ...order })),
  category: "all",
  filter: "all",
  activeScreen: "catalog",
  activeRoot: "orders",
  activeProduct: null,
  selections: {},
  toasts: new Map(),
  loadingTimer: null
};

function saveLocalState() {
  localStorage.setItem(STORE_KEY, JSON.stringify({ cart: state.cart }));
  renderCart();
  renderCartCount();
}

function toast(message, tone = "success", title = "Готово") {
  const stack = $("#toast-stack");
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const icon = tone === "error" ? "!" : tone === "warning" ? "!" : tone === "info" ? "i" : "✓";
  const item = document.createElement("div");
  item.className = `toast toast--${tone}`;
  item.id = id;
  item.innerHTML = `<span class="toast__icon" aria-hidden="true">${icon}</span><span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(message)}</small></span><button class="toast__close" type="button" aria-label="Закрыть уведомление">×</button>`;
  stack.append(item);
  state.toasts.set(id, window.setTimeout(() => removeToast(id), 4200));
}

function removeToast(id) {
  const node = document.getElementById(id);
  if (node) node.remove();
  const timer = state.toasts.get(id);
  if (timer) clearTimeout(timer);
  state.toasts.delete(id);
}

function setScreen(name) {
  if (!["catalog", "cart", "checkout", "root", "kit"].includes(name)) return;
  state.activeScreen = name;
  const dockTarget = name === "checkout" ? "cart" : name === "kit" ? "catalog" : name;
  $$("[data-screen-panel]").forEach(panel => panel.classList.toggle("is-active", panel.dataset.screenPanel === name));
  $$("[data-screen]").forEach(button => {
    const target = button.dataset.screen;
    const selected = target === name || (button.classList.contains("dock-link") && target === dockTarget);
    button.classList.toggle("is-active", selected);
    if (button.classList.contains("dock-link")) button.setAttribute("aria-current", selected ? "page" : "false");
  });
  $("#glass-dock").dataset.active = dockTarget;
  if (name === "cart") renderCart();
  if (name === "checkout") renderCheckoutSummary();
  window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  const meta = $("meta[name='theme-color']");
  if (meta) meta.content = theme === "dark" ? "#101014" : "#f7f3f0";
}

function defaultSelections(product) {
  const result = {};
  for (const group of product.optionGroups) {
    const dependencyReady = !group.dependsOn || group.dependsOn.values.includes(result[group.dependsOn.key]);
    if (dependencyReady && group.values.length) result[group.key] = group.values[0].id;
  }
  return result;
}

function renderCatalog() {
  let visible = records.filter(product => state.category === "all" || product.category === state.category);
  if (state.filter !== "all") visible = visible.filter(product => product.collection === state.filter);
  $("#catalog-count").textContent = `${visible.length} ${visible.length === 1 ? "композиция" : "композиции"}`;
  const grid = $("#catalog-grid");
  if (!visible.length) {
    grid.innerHTML = `<div class="empty-state product-grid__state"><span class="empty-state__icon">◇</span><strong>Подборка пока пуста</strong><p>Попробуйте другой локальный фильтр.</p></div>`;
    return;
  }
  grid.innerHTML = visible.map(product => renderProductCard(product, { variant: "tile", showDescription: false })).join("");
}

function renderKit() {
  $("#kit-products").innerHTML = [
    renderProductCard(records[0], { variant: "tile", showDescription: true }),
    renderProductCard(records[1], { variant: "tile", showDescription: true }),
    renderProductCard(records[2], { variant: "tile", showDescription: true }),
    renderProductCard(records[3], { variant: "tile", showDescription: true })
  ].join("");
  $("#kit-rows").innerHTML = state.orders.slice(0, 2).map(order => renderOrderRow(order, { compact: true, actions: false })).join("");
}

function openProduct(id) {
  const product = byId.get(id);
  if (!product) return;
  state.activeProduct = product;
  state.selections = defaultSelections(product);
  renderProductDetail();
  $("#product-dialog").showModal();
}

function renderProductDetail() {
  const product = state.activeProduct;
  if (!product) return;
  const image = product.images[0]
    ? `<div class="product-detail__image-wrap"><img class="product-detail__image" src="${escapeHTML(product.images[0])}" alt="Композиция «${escapeHTML(product.title)}»"></div>`
    : `<div class="product-detail__image-wrap">${renderProductCard({ ...product, images: [], badges: [], availability: "available" }, { variant: "compact", showActions: false })}</div>`;
  const price = selectedPrice(product, state.selections);
  const availability = product.availability;
  const soldOut = availability === "unavailable";
  $("#product-dialog-content").innerHTML = `<header class="overlay-head"><div><p class="eyebrow">ДЕТАЛИ · DEMO DATA</p><h2 id="product-dialog-title">${escapeHTML(product.title)}</h2></div><button class="glass-icon" type="button" data-close-overlay aria-label="Закрыть">×</button></header><div class="overlay-body product-detail__content">${image}<div><span class="status-pill status-pill--${availability === "limited" ? "queued" : availability === "unavailable" ? "danger" : "success"}">${escapeHTML(availability === "unavailable" ? "Временно нет" : availability === "limited" ? "Осталось немного" : "В наличии")}</span><h1 class="product-detail__title">${escapeHTML(product.title)}</h1><p class="product-detail__summary">${escapeHTML(product.description || "Демо-описание не задано.")}</p></div><div class="option-groups" id="product-options">${renderOptionGroups(product, state.selections)}</div></div><footer class="overlay-foot product-detail__footer"><strong class="product-detail__price" id="product-detail-price">${formatPrice(price)}</strong><button class="fg-button" type="button" data-active-add ${soldOut ? "disabled aria-disabled=\"true\"" : ""}>Добавить в корзину</button></footer>`;
}

function changeOption(groupKey, valueId) {
  const product = state.activeProduct;
  if (!product) return;
  const group = product.optionGroups.find(item => item.key === groupKey);
  if (!group || !group.values.some(value => value.id === valueId)) return;
  state.selections[groupKey] = valueId;
  for (const dependent of product.optionGroups) {
    if (dependent.dependsOn?.key === groupKey && !dependent.dependsOn.values.includes(valueId)) delete state.selections[dependent.key];
  }
  renderProductDetail();
  const selected = $(`[data-option-group="${CSS.escape(groupKey)}"][data-option-value="${CSS.escape(valueId)}"]`);
  selected?.focus({ preventScroll: true });
}

function lineKey(productId, selections) {
  return `${productId}:${Object.entries(selections).sort(([a],[b]) => a.localeCompare(b)).map(([key,value]) => `${key}=${value}`).join("&")}`;
}

function addToCart(productId, selections = null) {
  const product = byId.get(productId);
  if (!product || product.availability === "unavailable") {
    toast("Эта позиция недоступна в демо-каталоге.", "warning", "Добавить нельзя");
    return;
  }
  const chosen = selections || defaultSelections(product);
  const key = lineKey(productId, chosen);
  const existing = state.cart.find(item => item.key === key);
  if (existing) existing.quantity += 1;
  else state.cart.push({ key, productId, selections: { ...chosen }, quantity: 1 });
  saveLocalState();
  toast("Композиция добавлена в локальную корзину.", "success", "Добавлено");
}

function cartItems() {
  return state.cart.map(item => ({ item, product: byId.get(item.productId) })).filter(entry => entry.product);
}

function cartTotal() {
  return cartItems().reduce((total, { item, product }) => total + selectedPrice(product, item.selections) * item.quantity, 0);
}

function renderCartCount() {
  const count = state.cart.reduce((total, item) => total + item.quantity, 0);
  const badge = $("#dock-count");
  badge.textContent = count;
  badge.hidden = count === 0;
}

function renderCart() {
  const list = $("#cart-lines");
  if (!list) return;
  const entries = cartItems();
  if (!entries.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-state__icon">◇</span><strong>Здесь пока тихо</strong><p>Добавьте композицию в каталоге — строки, варианты и итог появятся здесь.</p><button class="fg-button fg-button--secondary" type="button" data-screen="catalog">Открыть каталог</button></div>`;
    $("#cart-summary").innerHTML = `<h2>Ваш заказ</h2><div class="summary-row"><span>Позиций</span><strong>0</strong></div><div class="summary-total"><span>Итого</span><strong>${formatPrice(0)}</strong></div><p class="order-summary__note">Корзина хранится только в этом браузере.</p>`;
    renderCheckoutSummary();
    renderCartCount();
    return;
  }
  list.innerHTML = entries.map(({ item, product }) => {
    const options = product.optionGroups.map(group => {
      const value = group.values.find(option => option.id === item.selections[group.key]);
      return value ? `${group.label}: ${value.label}` : "";
    }).filter(Boolean).join(" · ") || "Без дополнительных параметров";
    const itemPrice = selectedPrice(product, item.selections);
    const image = product.images[0] ? `<img class="cart-item__image" src="${escapeHTML(product.images[0])}" alt="">` : `<div class="cart-item__image cart-item__fallback" aria-hidden="true">◇</div>`;
    return `<article class="cart-item" data-cart-key="${escapeHTML(item.key)}">${image}<div><h2 class="cart-item__title">${escapeHTML(product.title)}</h2><p class="cart-item__options">${escapeHTML(options)}</p><div class="cart-item__actions"><div class="stepper" aria-label="Количество"><button type="button" data-quantity="-1" data-key="${escapeHTML(item.key)}" aria-label="Уменьшить количество">−</button><output>${item.quantity}</output><button type="button" data-quantity="1" data-key="${escapeHTML(item.key)}" aria-label="Увеличить количество">+</button></div><button class="text-action" type="button" data-remove="${escapeHTML(item.key)}">Убрать</button></div></div><div class="cart-item__price"><strong>${formatPrice(itemPrice * item.quantity)}</strong><small>${formatPrice(itemPrice)} / шт.</small></div></article>`;
  }).join("");
  const totalQuantity = entries.reduce((sum, { item }) => sum + item.quantity, 0);
  $("#cart-summary").innerHTML = renderSummary("Состав заказа", [
    { label: `Композиции · ${totalQuantity} шт.`, value: formatPrice(cartTotal()) },
    { label: "Получение", value: "выберете далее" }
  ], cartTotal(), "Перейти к оформлению", "checkout");
  renderCheckoutSummary();
  renderCartCount();
}

function renderCheckoutSummary() {
  const target = $("#checkout-summary");
  if (!target) return;
  const entries = cartItems();
  target.innerHTML = renderSummary("Ваш заказ", entries.map(({ item, product }) => ({
    label: `${product.title} · ${item.quantity} шт.`,
    value: formatPrice(selectedPrice(product, item.selections) * item.quantity)
  })), cartTotal(), "Подтвердить демо-заказ", "checkout-submit");
  const action = $(".order-summary__action", target);
  if (action) {
    action.dataset.action = "checkout-submit";
    action.removeAttribute("data-screen");
  }
  if (!entries.length) target.innerHTML = `<h2>Ваш заказ</h2><p class="page-intro">Корзина пуста — итог появится после выбора композиции.</p>`;
}

function renderRoot() {
  $("#root-orders").innerHTML = state.orders.map(order => renderOrderRow(order)).join("");
  $("#root-products").innerHTML = records.slice(0, 3).map(product => `<div class="data-row"><div class="data-row__main"><strong>${escapeHTML(product.title)}</strong><small>Категория · ${escapeHTML(product.category)}</small></div><span class="data-row__secondary">${product.optionGroups.length} группы вариантов</span><span class="status-pill status-pill--${product.availability === "unavailable" ? "danger" : product.availability === "limited" ? "queued" : "success"}">${product.availability === "unavailable" ? "Нет в наличии" : product.availability === "limited" ? "Осталось немного" : "В наличии"}</span><strong class="data-row__price">${formatPrice(product.basePrice)}</strong><div class="data-row__actions"><button type="button" data-open-overlay="product-editor">Изменить</button></div></div>`).join("");
  $("#root-clients").innerHTML = clients.map(client => `<div class="data-row"><div class="data-row__main"><strong>${escapeHTML(client.name)}</strong><small>${client.orders} заказа · ${formatPrice(client.total)} всего</small></div><span class="data-row__secondary">${escapeHTML(client.last)}</span><span class="status-pill status-pill--${escapeHTML(client.tone)}">${escapeHTML(client.status)}</span><strong class="data-row__price">${client.orders}</strong></div>`).join("");
  $("#root-top-products").innerHTML = records.slice(0, 3).map((product, index) => `<div class="data-row"><div class="data-row__main"><strong>${escapeHTML(product.title)}</strong><small>Демо-рейтинг</small></div><span class="data-row__secondary">${18 - index * 4} заказов</span><span class="status-pill status-pill--success">+${12 - index * 3}%</span><strong class="data-row__price">${index + 1} место</strong></div>`).join("");
  $("#root-faq").innerHTML = faqRecords.map((item, index) => `<details class="faq-item" ${index === 0 ? "open" : ""}><summary class="faq-question"><span>${escapeHTML(item.question)}</span><span aria-hidden="true">+</span></summary><div class="faq-answer">${escapeHTML(item.answer)}</div></details>`).join("");
}

function setRoot(section) {
  state.activeRoot = section;
  $$("[data-root]").forEach(button => button.classList.toggle("is-selected", button.dataset.root === section));
  $$("[data-root-panel]").forEach(panel => panel.classList.toggle("is-active", panel.dataset.rootPanel === section));
}

function setFulfilment(mode) {
  const pickup = mode === "pickup";
  $$("[data-fulfilment]").forEach(button => button.classList.toggle("is-selected", button.dataset.fulfilment === mode));
  const control = $(".segmented-control:not(.segmented-control--small)");
  if (control) control.dataset.active = mode;
  $("#address-field").hidden = pickup;
}

function openSheet(kind) {
  const dialog = $("#sheet-dialog");
  const title = $("#sheet-title");
  const body = $("#sheet-body");
  const templates = {
    category: { title: "Категория и группа", eyebrow: "КАТЕГОРИЙНАЯ ФОРМА · DEMO", body: `<div class="field-grid"><label class="field"><span>Название категории</span><input placeholder="Например, сезонные"></label><label class="field"><span>Группа товаров</span><select><option>Не выбрана</option><option>Авторские композиции</option><option>Сезонные</option></select></label><label class="field field--wide"><span>Описание</span><textarea rows="3" placeholder="Короткое описание"></textarea></label></div><div class="editor-row-list" id="editor-rows"><div class="editor-row"><label class="field"><span>Подкатегория</span><input value="Нежные"></label><button class="glass-icon" type="button" data-remove-editor-row aria-label="Удалить строку">×</button></div></div><button class="fg-button fg-button--secondary fg-button--small" type="button" data-add-editor-row>+ Добавить строку</button>` },
    broadcast: { title: "Черновик рассылки", eyebrow: "BROADCAST · LOCAL", body: `<div class="field-grid"><label class="field field--wide"><span>Тема</span><input value="${escapeHTML(broadcastDraft.title)}"></label><label class="field field--wide"><span>Текст</span><textarea rows="5">${escapeHTML(broadcastDraft.message)}</textarea></label><label class="check-control"><input type="checkbox" checked><span></span>Клиенты с заказом</label><label class="check-control"><input type="checkbox"><span></span>Все клиенты</label></div><div class="notice notice--warning"><strong>Только черновик</strong><span>Кнопка сохранения показывает локальное уведомление. Отправка невозможна.</span></div>` },
    "faq-editor": { title: "Редактор FAQ", eyebrow: "FAQ EDITOR · DEMO", body: `<div class="field-grid"><label class="field field--wide"><span>Вопрос</span><input placeholder="Введите вопрос"></label><label class="field field--wide"><span>Ответ</span><textarea rows="5" placeholder="Введите ответ"></textarea></label><label class="check-control"><input type="checkbox" checked><span></span>Показывать клиентам</label></div><div class="notice notice--info"><strong>Поддержка длинного текста</strong><span>Поля адаптируются по высоте и прокручиваются внутри sheet.</span></div>` },
    "product-editor": { title: "Редактор товара", eyebrow: "PRODUCT EDITOR · DEMO", body: `<div class="field-grid"><label class="field field--wide"><span>Название</span><input placeholder="Название композиции"></label><label class="field"><span>Цена</span><input inputmode="numeric" placeholder="0 ₽"></label><label class="field"><span>Категория</span><select><option>Выберите категорию</option><option>Нежные</option><option>Яркие</option></select></label><label class="field field--wide"><span>Описание</span><textarea rows="4" placeholder="Состав и настроение"></textarea></label><label class="check-control"><input type="checkbox" checked><span></span>Доступно в каталоге</label></div><div class="notice notice--info"><strong>Динамические поля</strong><span>В реальном приложении поля строятся по модели данных и не меняют бизнес-валидацию.</span></div>` }
  };
  const template = templates[kind] || templates.category;
  title.textContent = template.title;
  $(".overlay-head .eyebrow", dialog).textContent = template.eyebrow;
  body.innerHTML = template.body;
  dialog.showModal();
}

function openFullscreen(kind = "variant-editor") {
  const dialog = $("#fullscreen-dialog");
  const title = $("#fullscreen-title");
  const body = $("#fullscreen-body");
  if (kind === "variant-editor") {
    title.textContent = "Редактор вариантов";
    body.innerHTML = `<p class="kit-intro">Длинный редактор сохраняет структуру на узком экране. Все изменения остаются в DOM текущей сессии.</p><div class="variant-table"><div class="variant-table__head"><span>Название</span><span>Цена</span><span>Доступность</span><span></span></div>${["Компактный", "Классический", "Большой", "Авторский размер", "Особый вариант"].map((name, index) => `<div class="variant-table__row"><label class="field"><span class="sr-only">Название варианта</span><input value="${name}"></label><label class="field"><span class="sr-only">Цена</span><input inputmode="numeric" value="${3900 + index * 750}"></label><button class="switch-control" type="button" role="switch" aria-checked="${index !== 4}" data-action="switch"><span class="switch-control__track"><i></i></span><span class="sr-only">Доступность</span></button><button class="row-delete" type="button" data-remove-editor-row aria-label="Удалить вариант">×</button></div>`).join("")}</div><button class="fg-button fg-button--secondary fg-button--small" type="button" data-add-variant>+ Добавить вариант</button>`;
  } else {
    title.textContent = "Большая форма · демо";
    body.innerHTML = `<div class="field-grid">${Array.from({ length: 8 }, (_, index) => `<label class="field"><span>Поле ${index + 1}</span><input placeholder="Значение ${index + 1}"></label>`).join("")}<label class="field field--wide"><span>Подробное описание</span><textarea rows="6"></textarea></label></div>`;
  }
  dialog.showModal();
}

function openOverlay(name) {
  if (name === "product") return openProduct(state.activeProduct?.id || "p1");
  if (name === "category" || name === "broadcast" || name === "faq-editor" || name === "product-editor") return openSheet(name);
  if (name === "variant-editor" || name === "large-editor") return openFullscreen(name);
  const idMap = { "demo-dialog": "demo-dialog", confirm: "confirm-dialog", "demo-sheet": "sheet-dialog", "demo-fullscreen": "fullscreen-dialog", courier: "courier-dialog", access: "access-dialog" };
  const id = idMap[name];
  if (id) $("#" + id).showModal();
}

function closeTopDialog(dialog) {
  if (dialog?.open) dialog.close();
}

function updateCategoryFilter(button) {
  state.category = button.dataset.category;
  $$("[data-category]").forEach(item => item.classList.toggle("is-selected", item === button));
  renderCatalog();
}

function updateCollectionFilter(button) {
  state.filter = button.dataset.filter;
  $$("[data-filter]").forEach(item => item.classList.toggle("is-selected", item === button));
  renderCatalog();
}

function addOrderDemo() {
  const number = 2049 + state.orders.length - 3;
  state.orders.unshift({ id: `FG-${number}`, client: "Новый демо-клиент", address: "Демо-адрес", status: "Новый", statusTone: "queued", amount: 4650, time: "Сейчас" });
  renderRoot();
  toast("Добавлена локальная строка заказа.", "info", "Демо-обновление");
}

function updateQuantity(key, delta) {
  const entry = state.cart.find(item => item.key === key);
  if (!entry) return;
  entry.quantity = Math.max(0, entry.quantity + delta);
  if (!entry.quantity) state.cart = state.cart.filter(item => item.key !== key);
  saveLocalState();
}

function submitDemoOrder() {
  if (!state.cart.length) {
    toast("Сначала добавьте композицию из каталога.", "warning", "Корзина пуста");
    return;
  }
  toast("Демо-сценарий завершён. Данные не отправлялись.", "success", "Заказ готов");
  state.cart = [];
  saveLocalState();
  setScreen("catalog");
}

function showLoadingState(button) {
  button.classList.add("is-loading");
  button.setAttribute("aria-busy", "true");
  const original = button.dataset.originalLabel || button.textContent.trim();
  button.dataset.originalLabel = original;
  button.innerHTML = `<span class="spinner" aria-hidden="true"></span>Загрузка`;
  clearTimeout(state.loadingTimer);
  state.loadingTimer = window.setTimeout(() => {
    button.classList.remove("is-loading");
    button.removeAttribute("aria-busy");
    button.textContent = original;
    toast("Локальное состояние загрузки завершено.", "info", "Готово");
  }, 1200);
}

function runAction(action, element) {
  switch (action) {
    case "theme": setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); break;
    case "toast-success": toast("Изменение сохранено только в этом прототипе.", "success", "Сохранено"); break;
    case "toast-error": toast("Проверьте демонстрационные поля формы.", "error", "Есть ошибка"); break;
    case "toast-warning": toast("Демо-предупреждение. Никаких данных не изменено.", "warning", "Внимание"); break;
    case "toast-info": toast("Только локальный просмотр состояния.", "info", "Информация"); break;
    case "loading": showLoadingState(element); break;
    case "switch": element.setAttribute("aria-checked", element.getAttribute("aria-checked") !== "true"); break;
    case "add-order": addOrderDemo(); break;
    case "broadcast-preview": {
      const text = $("#broadcast-copy")?.value.trim();
      $("#broadcast-preview").textContent = text || "Текст появится здесь после ввода.";
      toast("Обновлён только локальный предпросмотр.", "info", "Предпросмотр");
      break;
    }
    case "checkout-submit": submitDemoOrder(); break;
    case "copy-demo": toast("Копирование показано как локальный сценарий.", "success", "Скопировано"); break;
    default: break;
  }
}

function handleClick(event) {
  const target = event.target instanceof Element ? event.target : event.target.parentElement;
  const screen = target.closest("[data-screen]");
  if (screen) { event.preventDefault(); setScreen(screen.dataset.screen); return; }
  const close = target.closest("[data-close-overlay]");
  if (close) { closeTopDialog(close.closest("dialog")); return; }
  const category = target.closest("[data-category]");
  if (category) { updateCategoryFilter(category); return; }
  const filter = target.closest("[data-filter]");
  if (filter) { updateCollectionFilter(filter); return; }
  const productOpen = target.closest("[data-product-open]");
  if (productOpen) { openProduct(productOpen.dataset.productOpen); return; }
  const add = target.closest("[data-cart-add]");
  if (add) { addToCart(add.dataset.cartAdd); return; }
  const activeAdd = target.closest("[data-active-add]");
  if (activeAdd && state.activeProduct) {
    addToCart(state.activeProduct.id, state.selections);
    closeTopDialog($("#product-dialog"));
    return;
  }
  const option = target.closest("[data-option-group]");
  if (option) { changeOption(option.dataset.optionGroup, option.dataset.optionValue); return; }
  const quantity = target.closest("[data-quantity]");
  if (quantity) { updateQuantity(quantity.dataset.key, Number(quantity.dataset.quantity)); return; }
  const remove = target.closest("[data-remove]");
  if (remove) { state.cart = state.cart.filter(item => item.key !== remove.dataset.remove); saveLocalState(); toast("Строка убрана из локальной корзины.", "info", "Обновлено"); return; }
  const rootTab = target.closest("[data-root]");
  if (rootTab) { setRoot(rootTab.dataset.root); return; }
  const overlay = target.closest("[data-open-overlay]");
  if (overlay) { openOverlay(overlay.dataset.openOverlay); return; }
  const action = target.closest("[data-action]");
  if (action) { runAction(action.dataset.action, action); return; }
  const fulfilment = target.closest("[data-fulfilment]");
  if (fulfilment) { setFulfilment(fulfilment.dataset.fulfilment); return; }
  const scroll = target.closest("[data-scroll]");
  if (scroll) { $("#" + CSS.escape(scroll.dataset.scroll))?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  const addRow = target.closest("[data-add-editor-row]");
  if (addRow) { addEditorRow(); return; }
  const addVariant = target.closest("[data-add-variant]");
  if (addVariant) { addVariantRow(); return; }
  const removeRow = target.closest("[data-remove-editor-row]");
  if (removeRow) { removeRow.closest(".editor-row, .variant-table__row")?.remove(); return; }
  const toastClose = target.closest(".toast__close");
  if (toastClose) { removeToast(toastClose.closest(".toast").id); return; }
  const orderAction = target.closest("[data-order-action]");
  if (orderAction) {
    const order = state.orders.find(item => item.id === orderAction.dataset.orderId);
    if (orderAction.dataset.orderAction === "details") openOverlay("courier");
    else if (order) {
      const statuses = [["Подтверждён", "success"], ["Собирается", "queued"], ["Готов", "info"]];
      const index = statuses.findIndex(([label]) => label === order.status);
      [order.status, order.statusTone] = statuses[(index + 1) % statuses.length];
      renderRoot();
      toast(`Статус #${order.id} изменён локально.`, "info", "Статус заказа");
    }
    return;
  }
  if (target.closest("[data-open-overlay='access']")) openOverlay("access");
}

function addEditorRow() {
  const list = $("#editor-rows");
  if (!list) return;
  const row = document.createElement("div");
  row.className = "editor-row";
  row.innerHTML = `<label class="field"><span>Подкатегория</span><input placeholder="Название"></label><button class="glass-icon" type="button" data-remove-editor-row aria-label="Удалить строку">×</button>`;
  list.append(row);
}

function addVariantRow() {
  const row = document.createElement("div");
  row.className = "variant-table__row";
  row.innerHTML = `<label class="field"><span class="sr-only">Название варианта</span><input placeholder="Новый вариант"></label><label class="field"><span class="sr-only">Цена</span><input inputmode="numeric" placeholder="0"></label><button class="switch-control" type="button" role="switch" aria-checked="true" data-action="switch"><span class="switch-control__track"><i></i></span><span class="sr-only">Доступность</span></button><button class="row-delete" type="button" data-remove-editor-row aria-label="Удалить вариант">×</button>`;
  $(".variant-table").append(row);
  row.querySelector("input")?.focus();
}

document.addEventListener("click", handleClick);
document.addEventListener("click", event => {
  const dialog = event.target;
  if (dialog instanceof HTMLDialogElement && dialog.open && dialog === event.target) dialog.close();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    const openDialogs = $$('dialog[open]');
    openDialogs.at(-1)?.close();
  }
});

$$("dialog").forEach(dialog => dialog.addEventListener("click", event => {
  if (event.target === dialog && dialog.open) dialog.close();
}));

const savedTheme = localStorage.getItem(THEME_KEY);
setTheme(savedTheme === "dark" ? "dark" : "light");
renderCatalog();
renderKit();
renderRoot();
renderCart();
renderCartCount();
renderCheckoutSummary();
