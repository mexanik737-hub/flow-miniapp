// Render the established catalog view models. Category shortcuts reuse the filter controls.
function shopEscape(value) {
  const entities = {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'};
  return String(value ?? '').replace(/[&<>"']/g, char => entities[char]);
}
function shopPhoto(item) {
  const url = String(item?.photo_url || '').split(',')[0].trim();
  return url ? `<img class="feature-photo" alt="" src="${shopEscape(url)}" onerror="this.hidden=true">` : '';
}
function renderStorefrontHero(container, item) {
  if (!item) { container.replaceChildren(); return; }
  container.innerHTML = `<article class="editorial-hero">
    ${shopPhoto(item)}<div class="editorial-hero__grain"></div><span class="hero-orb" aria-hidden="true"></span>
    <div class="editorial-hero__copy"><p class="eyebrow eyebrow--light">ТОВАР ДНЯ · 09:00 МСК</p>
    <h1>${shopEscape(item.title)}</h1><p class="hero-lede">${shopEscape(item.category)} · ${item.is_group ? 'от ' : ''}${shopEscape(item.price)} ₽</p>
    <button class="fg-button fg-button--light" type="button">Выбрать <span aria-hidden="true">→</span></button></div></article>`;
  container.firstElementChild.onclick = () => { triggerHaptic('selection'); openProductModal(item.id); };
}
function selectShopCategory(category) {
  selectFilterCategory(category);
  applyFilters();
}
function syncCategoryTiles() {
  document.querySelectorAll('#catalog-categories button').forEach(button => {
    const selected = button.dataset.category === selectedFilterCategoryValue;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
function renderStorefrontCollections(items) {
  const categories = Array.from(new Set([...items.map(item => item.category), ...getCategoryConfigList('custom_categories'), ...getCategoryConfigList('available_categories')].filter(Boolean)));
  const rail = document.getElementById('catalog-categories');
  rail.replaceChildren(...['Все', ...categories.filter(name => name !== 'Все')].map(category => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'category-tile';
    tile.dataset.category = category;
    tile.innerHTML = `<span class="category-tile__icon" aria-hidden="true">✳</span><span>${shopEscape(category)}</span>`;
    tile.onclick = () => selectShopCategory(category);
    return tile;
  }));
  syncCategoryTiles();
  const selections = items.filter(item => item.is_active);
  const featured = selections.find(item => item.is_popular) || selections[0];
  const bento = document.getElementById('catalog-features');
  if (!featured) { bento.replaceChildren(); return; }
  const category = categories.find(name => name !== featured.category) || featured.category;
  bento.innerHTML = `<article class="bento-card bento-card--featured">${shopPhoto(featured)}
    <div class="bento-card__content"><span class="micro-label">${featured.is_popular ? 'ХИТ' : shopEscape(featured.category)}</span>
    <h2>${shopEscape(featured.title)}</h2><button class="text-action">Посмотреть товар →</button></div></article>
    ${category ? `<article class="bento-card bento-card--season"><div class="season-orbit"><i></i><i></i></div>
    <span class="micro-label">КАТЕГОРИЯ</span><h2>${shopEscape(category)}</h2><button class="round-arrow" aria-label="Открыть категорию">→</button></article>` : ''}
    <article class="bento-card bento-card--note"><span class="note-spark">✳</span><p>В наличии</p><strong>${selections.length}</strong><span class="micro-label">ПОЗИЦИЙ В КАТАЛОГЕ</span></article>`;
  bento.querySelector('.text-action').onclick = () => openProductModal(featured.id);
  const arrow = bento.querySelector('.round-arrow');
  if (arrow) arrow.onclick = () => { selectShopCategory(category); document.getElementById('catalog-wrap').scrollIntoView(); };
}
