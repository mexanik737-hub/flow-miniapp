const availabilityLabels = {
  available: "В наличии",
  limited: "Осталось немного",
  unavailable: "Временно нет",
  loading: "Загружается",
  error: "Не удалось загрузить"
};

export function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

export function formatPrice(value) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value) + " ₽";
}

export function toProductViewModel(record) {
  return {
    id: String(record.id),
    title: record.title || "Без названия",
    description: record.description || "",
    basePrice: Number(record.basePrice) || 0,
    images: Array.isArray(record.images) ? record.images.filter(Boolean) : [],
    badges: Array.isArray(record.badges) ? record.badges : [],
    availability: record.availability || "unknown",
    category: record.category || "uncategorized",
    collection: record.collection || "all",
    optionGroups: Array.isArray(record.optionGroups) ? record.optionGroups : []
  };
}

export function selectedPrice(product, selections = {}) {
  let total = product.basePrice;
  for (const group of product.optionGroups) {
    const selected = group.values.find(value => value.id === selections[group.key]);
    if (selected) total += selected.priceDelta || 0;
  }
  return total;
}

function imageBlock(product, variant) {
  const image = product.images[0];
  const fallback = `<div class="product-card__fallback" role="img" aria-label="Фотография не добавлена"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 33c-7-4-11-10-11-17 6 0 10 3 11 9 0-8 4-13 11-13 0 8-3 16-11 21Z"/><path d="M20 33V17"/></svg></div>`;
  return `<div class="product-card__media">${image ? `<img class="product-card__image" src="${escapeHTML(image)}" alt="Композиция «${escapeHTML(product.title)}»" loading="lazy">` : fallback}${product.badges.length ? `<div class="product-card__badges">${product.badges.map(badge => `<span class="badge ${badge.tone === "new" ? "badge--new" : badge.tone === "limited" ? "badge--limited" : ""}">${escapeHTML(badge.label)}</span>`).join("")}</div>` : ""}</div>`;
}

function availability(product) {
  return `<span class="product-card__availability" data-state="${escapeHTML(product.availability)}">${escapeHTML(availabilityLabels[product.availability] || "Статус уточняется")}</span>`;
}

export function renderProductCard(rawRecord, { variant = "tile", selections = {}, showDescription = false, showActions = true, price = null } = {}) {
  const product = toProductViewModel(rawRecord);
  const finalPrice = price ?? selectedPrice(product, selections);
  const unavailable = product.availability === "unavailable";
  const cardClass = ["product-card", `product-card--${variant}`, unavailable ? "product-card--unavailable" : ""].filter(Boolean).join(" ");
  const action = showActions ? `<div class="product-card__actions"><button class="fg-button fg-button--small fg-button--secondary" type="button" data-product-open="${escapeHTML(product.id)}" aria-label="Подробнее: ${escapeHTML(product.title)}">Подробнее</button><button class="fg-button fg-button--small" type="button" data-cart-add="${escapeHTML(product.id)}" ${unavailable ? "disabled aria-disabled=\"true\"" : ""} aria-label="Добавить «${escapeHTML(product.title)}»">+</button></div>` : "";
  return `<article class="${cardClass}" data-product-card="${escapeHTML(product.id)}">${imageBlock(product, variant)}<div class="product-card__body"><h3 class="product-card__title">${escapeHTML(product.title)}</h3>${showDescription && product.description ? `<p class="product-card__description">${escapeHTML(product.description)}</p>` : ""}<div class="product-card__meta">${availability(product)}${product.optionGroups.length ? `<span>${product.optionGroups.length} ${product.optionGroups.length === 1 ? "параметр" : "параметра"}</span>` : ""}</div><div class="product-card__footer"><div class="product-card__price">${formatPrice(finalPrice)}${product.optionGroups.length ? "<small>варианты влияют на цену</small>" : ""}</div>${action}</div></div></article>`;
}

export function renderOptionGroups(product, selections) {
  if (!product.optionGroups.length) return `<p class="option-hint">У этой композиции нет дополнительных вариантов.</p>`;
  return `<div class="option-groups">${product.optionGroups.map(group => {
    const dependencyReady = !group.dependsOn || group.dependsOn.values.includes(selections[group.dependsOn.key]);
    const current = selections[group.key] || "";
    return `<fieldset class="option-group" ${dependencyReady ? "" : "disabled"}><legend class="option-group__head"><span>${escapeHTML(group.label)}${group.required ? " · обязательно" : ""}</span><span class="option-group__help">${dependencyReady ? "Выберите вариант" : "Сначала выберите большой размер"}</span></legend><div class="option-list">${group.values.map(value => `<button class="option-chip ${current === value.id ? "is-selected" : ""}" type="button" data-option-group="${escapeHTML(group.key)}" data-option-value="${escapeHTML(value.id)}" ${dependencyReady ? "" : "disabled"} aria-pressed="${current === value.id}">${escapeHTML(value.label)}${value.priceDelta ? ` <span>+${formatPrice(value.priceDelta)}</span>` : ""}</button>`).join("")}</div></fieldset>`;
  }).join("")}</div>`;
}

export function renderOrderRow(order, { compact = false, actions = true } = {}) {
  return `<div class="data-row ${compact ? "data-row--compact" : ""}" data-order-row="${escapeHTML(order.id)}"><div class="data-row__main"><strong>#${escapeHTML(order.id)}</strong><small>${escapeHTML(order.client)} · ${escapeHTML(order.time || "Сегодня")}</small></div><span class="data-row__secondary">${escapeHTML(order.address || order.status)}</span><span class="status-pill status-pill--${escapeHTML(order.statusTone || "info")}">${escapeHTML(order.status)}</span><strong class="data-row__price">${formatPrice(order.amount)}</strong>${actions ? `<div class="data-row__actions"><button type="button" data-order-action="details" data-order-id="${escapeHTML(order.id)}">Детали</button><button type="button" data-order-action="status" data-order-id="${escapeHTML(order.id)}" aria-label="Изменить статус ${escapeHTML(order.id)}">···</button></div>` : ""}</div>`;
}

export function renderKeyValueRow(label, value, badge = "") {
  return `<div class="data-row"><div class="data-row__main"><strong>${escapeHTML(label)}</strong><small>${escapeHTML(value.detail || "Локальные демо-данные")}</small></div><span class="data-row__secondary">${escapeHTML(value.secondary || "")}</span>${badge ? `<span class="status-pill status-pill--${escapeHTML(value.tone || "info")}">${escapeHTML(badge)}</span>` : ""}<strong class="data-row__price">${escapeHTML(value.price || "")}</strong></div>`;
}

export function renderSummary(title, lines, total, actionLabel, action = "checkout") {
  const rows = lines.map(line => `<div class="summary-row"><span>${escapeHTML(line.label)}</span><strong>${escapeHTML(line.value)}</strong></div>`).join("");
  return `<h2>${escapeHTML(title)}</h2>${rows}<div class="summary-total"><span>Итого · демо</span><strong>${formatPrice(total)}</strong></div>${actionLabel ? `<button class="fg-button order-summary__action" type="button" data-screen="${escapeHTML(action)}">${escapeHTML(actionLabel)} <span aria-hidden="true">→</span></button>` : ""}<p class="order-summary__note">Это автономный макет. Заказ и данные никуда не отправляются.</p>`;
}
