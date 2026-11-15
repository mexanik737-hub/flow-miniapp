const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const javascriptFiles = fs.readdirSync(path.join(root, 'js'))
  .filter(file => file.endsWith('.js'))
  .map(file => path.join(root, 'js', file));

function createElement(id) {
  const classes = new Set();
  return {
    id, innerHTML: '', innerText: '', textContent: '', value: '', style: {}, disabled: false,
    addEventListener() {},
    classList: {
      add(value) { classes.add(value); },
      remove(value) { classes.delete(value); },
      toggle(value, force) {
        const shouldAdd = force === undefined ? !classes.has(value) : Boolean(force);
        if (shouldAdd) classes.add(value); else classes.delete(value);
        return shouldAdd;
      },
      contains(value) { return classes.has(value); }
    }
  };
}

function createAppContext() {
  const elements = new Map();
  const sandbox = {
    window: {},
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, createElement(id));
        return elements.get(id);
      },
      querySelectorAll() { return []; },
      querySelector() { return null; },
      addEventListener() {}
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    console,
    fetch() { throw new Error('Unexpected network request in regression test'); },
    toast() {},
    ADMIN_TELEGRAM_ID: 'admin-1',
    API_URL: 'https://example.invalid/api',
    catalog: [],
    displayCatalog: [],
    cart: {},
    allRootOrders: [],
    allRootCatalog: [],
    allRootClients: [],
    allRootNotifs: [],
    allRootFaq: [],
    currentRootSubTab: 'active',
    currentStatsPeriod: 'today',
    cachedStatsData: null,
    getCartItemQuantity() { return 0; },
    isGroupInCart() { return false; },
    getTabDisplayTitle(tab) { return String(tab || ''); },
    formatFullItemTitle(title, unit, variant, color) {
      return [title, unit, variant, color].filter(Boolean).join(' ');
    },
    triggerHaptic() {},
    openProductModal() {},
    deleteUserRoot() {},
    openCourierModal() {},
    openYandexGoDelivery() {},
    openStatusModal() {},
    openEditItemsModal() {},
    triggerOrderPhotoUpload() {},
    openTopConfirm() {},
    openEditFaqModal() {},
    toggleFaqActiveRoot() {},
    deleteFaqRoot() {},
    moveFaqOrder() {},
    toggleNotificationActiveRoot() {},
    repeatNotificationRoot() {},
    deleteNotificationRoot() {}
  };
  const context = vm.createContext(sandbox);
  for (const script of ['storefront.js', 'catalog.js', 'cart.js', 'order.js', 'profile.js', 'admin.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', script), 'utf8'), context, { filename: script });
  }
  vm.runInContext(`globalThis.__render = {
    renderShopCard, renderRootOrders, renderRootClients, renderRootCatalogUI,
    renderRootNotifications, renderRootFaqUI, renderRootStats, renderDriveMediaGrid, setupFilterDropdown,
    submitFinalOrder, quickAdd, modifyCartByKey, saveProductEditor, saveFaqEditor, submitRegistration, deleteProductRoot
  };`, context);
  return { context, elements };
}

function decodeHtmlAttribute(value) {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function runInlineHandler(context, html, includes, index = 0) {
  const attrs = [...html.matchAll(/\bonclick="([^"]*)"/g)].map(match => decodeHtmlAttribute(match[1]));
  const handler = attrs.filter(value => value.includes(includes))[index];
  assert.ok(handler, `Missing inline handler containing ${includes}`);
  context.event = { stopPropagation() {} };
  return vm.runInContext(`(() => { ${handler}; })()`, context);
}

function createUtilsContext(initialNodes = []) {
  class FakeElement {
    constructor(tagName = 'div', classNames = [], hasOnclick = true) {
      this.nodeType = 1;
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.parentElement = null;
      this.attributes = new Map();
      this.dataset = {};
      this.onclick = hasOnclick ? () => {} : null;
      this.textContent = '';
      const classes = new Set(classNames);
      this.classList = {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle: (name, force) => {
          const enabled = force === undefined ? !classes.has(name) : Boolean(force);
          if (enabled) classes.add(name); else classes.delete(name);
          return enabled;
        }
      };
    }
    matches(selectorList) {
      return selectorList.split(',').some(raw => {
        const selector = raw.trim();
        if (selector.startsWith('.')) return selector.slice(1).split('.').every(name => this.classList.contains(name));
        if (selector === '[onclick]') return typeof this.onclick === 'function';
        if (selector === '[data-keyboard-click-target]') return this.dataset.keyboardClickTarget === 'true';
        if (selector === '[role="button"]') return this.attributes.get('role') === 'button';
        if (selector === '[role="checkbox"]') return this.attributes.get('role') === 'checkbox';
        return this.tagName.toLowerCase() === selector;
      });
    }
    querySelectorAll(selector) {
      const found = [];
      for (const child of this.children) {
        if (child.matches(selector)) found.push(child);
        found.push(...child.querySelectorAll(selector));
      }
      return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) {
      let node = this;
      while (node) {
        if (node.matches(selector)) return node;
        node = node.parentElement;
      }
      return null;
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    appendChild(child) {
      child.parentElement = this;
      const setOwnerDocument = node => {
        node.ownerDocument = this.ownerDocument;
        node.children.forEach(setOwnerDocument);
      };
      setOwnerDocument(child);
      this.children.push(child);
      this.ownerDocument?.notifyMutation(this, child);
      return child;
    }
    click() {
      this.onclick?.({ target: this, stopPropagation() {} });
      this.ownerDocument?.dispatch('click', { target: this });
    }
  }

  class FakeMutationObserver {
    static all = [];
    constructor(callback) { this.callback = callback; FakeMutationObserver.all.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
  }
  const listeners = new Map();
  const body = new FakeElement('body', [], false);
  const document = {
    nodeType: 9,
    body,
    documentElement: { clientWidth: 390, clientHeight: 844 },
    querySelectorAll: selector => body.querySelectorAll(selector),
    querySelector: () => null,
    getElementById: () => null,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    dispatch(type, event = {}) { (listeners.get(type) || []).forEach(listener => listener(event)); },
    notifyMutation(target, node) {
      FakeMutationObserver.all.filter(observer => observer.options?.childList && observer.target === body)
        .forEach(observer => observer.callback([{ type: 'childList', target, addedNodes: [node] }]));
    }
  };
  body.ownerDocument = document;
  const sandbox = {
    window: { innerWidth: 390, innerHeight: 844, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) },
    document,
    MutationObserver: FakeMutationObserver,
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    setTimeout() { return 1; },
    clearTimeout() {},
    console
  };
  const context = vm.createContext(sandbox);
  initialNodes.forEach(node => { node.ownerDocument = document; body.appendChild(node); });
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'utils.js'), 'utf8'), context, { filename: 'utils.js' });
  document.dispatch('DOMContentLoaded');
  return { context, document, body, FakeElement, FakeMutationObserver };
}

test('all JavaScript files pass the Node parser', async t => {
  for (const file of javascriptFiles) {
    await t.test(path.relative(root, file), () => {
      const result = require('node:child_process').spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    });
  }
});

test('shopEscape encodes HTML text, attributes, quotes, and hostile markup', () => {
  const { context } = createAppContext();
  const value = `<'\"&\u2028<img src=x onerror=globalThis.pwned=1>`;
  assert.equal(
    vm.runInContext(`shopEscape(${JSON.stringify(value)})`, context),
    '&lt;&#39;&quot;&amp;\u2028&lt;img src=x onerror=globalThis.pwned=1&gt;'
  );
});

test('catalog inline product IDs remain one safe HTML attribute and round-trip exactly', () => {
  const { context } = createAppContext();
  const id = `x'\"\\<> &\u2028;alert(1)//`;
  context.openProductModal = received => { context.openedId = received; };
  const html = context.__render.renderShopCard({ id, title: 'Bouquet', price: 1200, is_active: true });
  assert.equal((html.match(/\bonclick=/g) || []).length, 3);
  assert.doesNotMatch(html, /onerror\s*=/i);
  runInlineHandler(context, html, 'openProductModal(');
  assert.equal(context.openedId, id);
});

test('category filter options escape labels and preserve quote-containing values', () => {
  const { context, elements } = createAppContext();
  const category = `O'Brien <img src=x onerror=alert(1)> \\"`;
  context.catalog = [{ price: 10, category }];
  context.displayCatalog = [];
  context.getCategoryConfigList = () => [];
  context.renderStorefrontCollections = () => {};
  context.selectFilterCategory = value => { context.selectedCategory = value; };
  context.__render.setupFilterDropdown();
  const html = elements.get('filter-cat-options').innerHTML;
  assert.match(html, /O&#39;Brien &lt;img src=x onerror=alert\(1\)&gt;/);
  assert.equal((html.match(/\bonclick=/g) || []).length, 2);
  runInlineHandler(context, html, 'selectFilterCategory(', 1);
  assert.equal(context.selectedCategory, category);
});

test('Root customer output escapes stored HTML and validates phone and Telegram links', () => {
  const { context, elements } = createAppContext();
  context.__render.renderRootClients([{
    user_id: `id'\"><img src=x onerror=alert(1)>`,
    name: `<img src=x onerror=globalThis.pwned=1>`,
    phone: 'javascript:alert(1)', username: 'bad/name', total_spent: '12.5'
  }]);
  const html = elements.get('root-clients-container').innerHTML;
  assert.match(html, /&lt;img src=x onerror=globalThis\.pwned=1&gt;/);
  assert.doesNotMatch(html, /href="(?:javascript|data):/i);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /Чат скрыт/);
  assert.equal((html.match(/\bonclick=/g) || []).length, 2);
  context.deleteUserRoot = id => { context.deletedUserId = id; };
  runInlineHandler(context, html, 'deleteUserRoot(');
  assert.equal(context.deletedUserId, `id'\"><img src=x onerror=alert(1)>`);
  context.__render.renderRootClients([{ user_id: '123456', name: 'Client', phone: '+7 (000) 000-00-00', username: '@flower_shop', total_spent: 0 }]);
  const validHtml = elements.get('root-clients-container').innerHTML;
  assert.match(validHtml, /href="tel:\+70000000000"/);
  assert.match(validHtml, /href="https:\/\/t\.me\/flower_shop"[^>]*rel="noopener noreferrer"/);
  assert.match(validHtml, />0 ₽</);
});

test('Root order fields and IDs are escaped and handler arguments round-trip', () => {
  const { context, elements } = createAppContext();
  const orderId = `ORD\" onmouseover=alert(1) <ёж>`;
  context.allRootOrders = [{
    order_id: orderId, status: 'В пути', user_name: '<svg onload=alert(1)>', user_phone: '+70000000000',
    address: `a');alert(1)//`, items: [{ title: '<b>Rose</b>', qty: 2, price: 500 }], total_amount: 1000
  }];
  context.openCourierModal = id => { context.openedOrderId = id; };
  context.__render.renderRootOrders();
  const html = elements.get('root-orders-container').innerHTML;
  assert.match(html, /&lt;svg onload=alert\(1\)&gt;/);
  assert.match(html, /&lt;b&gt;Rose&lt;\/b&gt;/);
  assert.doesNotMatch(html, /onmouseover=alert\(1\)\s*<\/article>/);
  runInlineHandler(context, html, 'openCourierModal(');
  assert.equal(context.openedOrderId, orderId);
});

test('Root order renderer tolerates absent status, non-string recipient, and malformed item numbers', () => {
  const { context, elements } = createAppContext();
  context.allRootOrders = [{ order_id: 0, recipient_info: { unexpected: true }, items: [null, { title: 'Rose', qty: 'bad', price: null }], total_amount: '' }];
  assert.doesNotThrow(() => context.__render.renderRootOrders());
  const html = elements.get('root-orders-container').innerHTML;
  assert.match(html, /Статус не указан/);
  assert.match(html, /— шт\. = — ₽/);
  assert.match(html, /Сумма заказа:<\/b> <span[^>]*>—<\/span>/);
});

test('Root renderers handle missing or non-array API lists without throwing', () => {
  const { context, elements } = createAppContext();
  assert.doesNotThrow(() => context.__render.renderRootClients({ data: 'unexpected' }));
  assert.equal(elements.get('root-clients-container').innerHTML, '');
  context.allRootCatalog = null;
  context.allRootNotifs = null;
  context.allRootFaq = null;
  assert.doesNotThrow(() => context.__render.renderRootCatalogUI());
  assert.doesNotThrow(() => context.__render.renderRootNotifications());
  assert.doesNotThrow(() => context.__render.renderRootFaqUI());
});

test('cart quick-add and decrement preserve composite variant keys and quantities', () => {
  const { context } = createAppContext();
  const key = '0:::10 stems:::50 cm:::red';
  context.catalog = [{ id: 0, title: 'Rose', unit: '10 stems', variant: '50 cm', color: 'red', is_active: true }];
  context.cart = {};
  context.cartAssemblyItems = {};
  context.updateCartUI = () => {};
  context.updateProductCardAction = () => {};
  context.animateFlyToCart = () => {};
  context.__render.quickAdd(0, null);
  context.__render.quickAdd(0, null);
  assert.equal(context.cart[key], 2);
  context.__render.modifyCartByKey(key, -1);
  assert.equal(context.cart[key], 1);
  context.__render.modifyCartByKey(key, -1);
  assert.equal(Object.hasOwn(context.cart, key), false);
});

test('pickup checkout submits one mock order with preserved item payload', async () => {
  const { context, elements } = createAppContext();
  const writes = [];
  let resolveResponse;
  context.fetch = (url, options) => {
    writes.push({ url, options, payload: JSON.parse(options.body) });
    return new Promise(resolve => { resolveResponse = resolve; });
  };
  context.API_URL = 'mock://api';
  context.userId = 'user-1';
  context.currentUser = { name: 'Test Client', phone: '+70000000000' };
  context.currentFinalOrderAmount = 2400;
  context.orderDelType = 'pickup';
  context.orderRecType = 'self';
  context.isAssemblyMode = true;
  context.cartAssemblyItems = { 'v1:::10 stems:::50 cm:::red': true };
  context.cart = { 'v1:::10 stems:::50 cm:::red': 2 };
  context.filteredCatalog = [];
  context.catalog = [{ id: 'v1', title: 'Rose', unit: '10 stems', variant: '50 cm', color: 'red', price: 1200, is_active: true }];
  elements.get('ord-shop-comment').value = 'mock note';
  context.closeOrderConfirmation = () => {};
  context.closeOrderModal = () => {};
  context.openAssemblyCallModal = id => { context.openedOrder = id; };
  context.openPaymentModal = id => { context.openedOrder = id; };
  context.readCheckoutFormState = () => ({});
  context.checkoutStorageKey = kind => kind;
  context.resetCheckoutForm = () => {};
  context.clearCartStorage = () => {};
  context.updateCartUI = () => {};
  context.renderCatalog = () => {};
  const firstSubmit = context.__render.submitFinalOrder();
  const duplicateSubmit = context.__render.submitFinalOrder();
  await Promise.resolve();
  assert.equal(writes.length, 1, 'duplicate submit must not send a second request');
  resolveResponse({ json: async () => ({ success: true, order_id: 'mock-order-7' }) });
  await Promise.all([firstSubmit, duplicateSubmit]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].options.method, 'POST');
  assert.equal(writes[0].url, 'mock://api');
  assert.equal(writes[0].payload.action, 'create_order');
  assert.equal(writes[0].payload.delivery_type, 'pickup');
  assert.equal(writes[0].payload.address, 'Самовывоз: Георгиевский пр-т, 37к2');
  assert.deepEqual(JSON.parse(writes[0].payload.items_json), [{
    id: 'v1', title: 'Rose', unit: '10 stems', variant: '50 cm', color: 'red', price: 1200, qty: 2, in_bouquet: true
  }]);
  assert.equal(context.openedOrder, 'mock-order-7');
});

test('delivery checkout enforces the address and carries delivery fields to the payment step', async () => {
  const { context } = createAppContext();
  const writes = [];
  context.fetch = async (url, options) => {
    writes.push({ url, payload: JSON.parse(options.body) });
    return { json: async () => ({ success: true, order_id: 'mock-delivery-8' }) };
  };
  context.API_URL = 'mock://api';
  context.userId = 'user-2';
  context.currentUser = { name: 'Test Client', phone: '8 (000) 000-00-00' };
  context.currentFinalOrderAmount = 3450;
  context.orderDelType = 'delivery';
  context.orderRecType = 'self';
  context.isAssemblyMode = false;
  context.cartAssemblyItems = {};
  context.cart = { 'rose:::10 stems:::50 cm:::red': 1 };
  context.catalog = [{ id: 'rose', title: 'Rose', unit: '10 stems', variant: '50 cm', color: 'red', price: 3000, is_active: true }];
  context.ordSaveAddrChecked = false;
  context.selectedGeoAddress = null;
  context.currentDeliveryCost = 450;
  vm.runInContext(`selectedDeliveryTimeValue = 'Сегодня 14:00 - 16:00'`, context);
  context.filteredCatalog = [];
  for (const id of ['ord-suggest-input', 'ord-entrance', 'ord-floor', 'ord-apt', 'ord-intercom', 'ord-comment', 'ord-shop-comment']) {
    context.document.getElementById(id).value = '';
  }
  await context.__render.submitFinalOrder();
  assert.equal(writes.length, 0, 'delivery without an address must not submit');

  context.selectedGeoAddress = { data: { house: '37', geo_lat: '55.7', geo_lon: '37.6' } };
  context.document.getElementById('ord-suggest-input').value = 'Георгиевский пр-т, 37к2';
  context.document.getElementById('ord-entrance').value = '2';
  context.document.getElementById('ord-floor').value = '3';
  context.document.getElementById('ord-apt').value = '15';
  context.document.getElementById('ord-intercom').value = '15';
  context.closeOrderConfirmation = () => {};
  context.closeOrderModal = () => {};
  context.openAssemblyCallModal = () => { throw new Error('Delivery order should open payment'); };
  context.openPaymentModal = id => { context.openedOrder = id; };
  context.readCheckoutFormState = () => ({});
  context.checkoutStorageKey = kind => kind;
  context.resetCheckoutForm = () => {};
  context.clearCartStorage = () => {};
  context.updateCartUI = () => {};
  context.renderCatalog = () => {};
  await context.__render.submitFinalOrder();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].url, 'mock://api');
  assert.equal(writes[0].payload.delivery_type, 'delivery');
  assert.equal(writes[0].payload.delivery_cost, 450);
  assert.equal(writes[0].payload.delivery_time, 'Сегодня 14:00 - 16:00');
  assert.match(writes[0].payload.address, /Георгиевский пр-т, 37к2, под\. 2, эт\. 3, кв\. 15/);
  assert.equal(context.openedOrder, 'mock-delivery-8');
});

test('product and FAQ editors preserve ID zero as an update', async () => {
  const { context, elements } = createAppContext();
  const writes = [];
  context.fetch = async (_url, options) => { writes.push(JSON.parse(options.body)); return { json: async () => ({}) }; };
  context.API_URL = 'mock://api';
  context.userId = 'admin-1';
  context.sessionPasscode = 'mock-only';
  context.filteredCatalog = [];
  context.editingProductId = 0;
  context.editingFaqId = 0;
  for (const id of ['prod-edit-price', 'prod-edit-name', 'prod-edit-unit', 'prod-edit-variant', 'prod-edit-color', 'prod-edit-cat', 'prod-edit-cat-display', 'prod-edit-photo', 'prod-edit-desc', 'faq-edit-q', 'faq-edit-a']) {
    context.document.getElementById(id).value = id === 'prod-edit-price' ? '125' : `value-${id}`;
  }
  context.document.getElementById('prod-edit-cat').value = 'Flowers';
  context.document.getElementById('faq-edit-q').value = 'Question';
  context.document.getElementById('faq-edit-a').value = 'Answer';
  context.closeProductEditorModal = () => {};
  context.forceSyncRootCatalog = () => {};
  context.closeFaqEditorModal = () => {};
  context.loadRootFaq = () => {};
  await context.__render.saveProductEditor();
  await context.__render.saveFaqEditor();
  assert.equal(writes[0].action, 'admin_update_product');
  assert.equal(writes[0].id, 0);
  assert.equal(writes[1].action, 'admin_update_faq');
  assert.equal(writes[1].id, 0);
  assert.ok(writes.every(payload => !String(payload.admin_passcode).includes('production')));
});

test('registration validates required phone and sends only mock API payloads', async () => {
  const { context } = createAppContext();
  const document = context.document;
  const writes = [];
  context.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    writes.push(payload);
    return { json: async () => payload.action === 'get_or_register_user'
      ? { exists: true, newly_registered: false, user_id: 'test-user' }
      : {} };
  };
  context.API_URL = 'mock://api';
  context.userId = 'test-user';
  context.tgFirstName = 'Test User';
  context.tgUsername = 'test_user';
  context.renderProfileUI = () => {};
  context.loadNotifications = () => {};
  document.getElementById('reg-name').value = 'Test User';
  document.getElementById('reg-phone').value = '';
  await context.__render.submitRegistration();
  assert.equal(writes.length, 0, 'incomplete phone must be rejected before sending');
  document.getElementById('reg-phone').value = '8 (000) 000-00-00';
  await context.__render.submitRegistration();
  assert.equal(writes[0].action, 'get_or_register_user');
  assert.equal(writes[0].user_id, 'test-user');
  assert.equal(writes[0].phone, '8 (000) 000-00-00');
  assert.ok(writes.every(payload => !String(payload.admin_passcode || '').includes('production')));
});

test('Root switches all six sections and cancelled delete has no write', async () => {
  const { context } = createAppContext();
  const calls = [];
  for (const name of ['loadRootOrders', 'loadRootCatalog', 'loadRootClients', 'loadRootNotifications', 'loadRootStats', 'loadRootFaq']) {
    context[name] = (...args) => calls.push([name, ...args]);
  }
  for (const section of ['orders', 'catalog', 'clients', 'notifs', 'stats', 'faq']) context.window.switchRootSection(section);
  assert.deepEqual(calls.map(call => call[0]), [
    'loadRootOrders', 'loadRootCatalog', 'loadRootClients', 'loadRootNotifications', 'loadRootStats', 'loadRootFaq'
  ]);
  let writes = 0;
  context.fetch = async () => { writes += 1; return { json: async () => ({}) }; };
  context.floralConfirm = async () => false;
  await context.__render.deleteProductRoot('product-1');
  assert.equal(writes, 0);
});

test('Root catalog and category rendering keep hostile names as text', () => {
  const { context, elements } = createAppContext();
  context.allRootCatalog = [{ id: 'p1', title: '<img src=x onerror=alert(1)>', category: 'Выставки <x>', price: 250, is_active: true }];
  context.__render.renderRootCatalogUI();
  const html = elements.get('root-catalog-container').innerHTML;
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /Выставки &lt;x&gt;/);
  context.allRootCatalog = [
    { id: 'v1', title: 'Rose set', category: 'Flowers', price: '120', is_active: true },
    { id: 'v2', title: 'Rose set', category: 'Flowers', price: 'bad', is_active: true }
  ];
  context.__render.renderRootCatalogUI();
  const invalidPriceGroup = elements.get('root-catalog-container').innerHTML;
  assert.match(invalidPriceGroup, /Группа \(2\)/);
  assert.match(invalidPriceGroup, />—<\/span>/);
  assert.doesNotMatch(invalidPriceGroup, /0–120 ₽/);
});

test('Root FAQ and notification templates escape text and serialize IDs', () => {
  const { context, elements } = createAppContext();
  const id = `n'\"</button><script>alert(1)</script>`;
  context.allRootFaq = [{ id, question: '<svg onload=alert(1)>', answer: '& hi', is_active: true }];
  context.__render.renderRootFaqUI();
  const faq = elements.get('root-faq-container').innerHTML;
  assert.match(faq, /&lt;svg onload=alert\(1\)&gt;/);
  context.allRootNotifs = [{ id, title: '<b>x</b>', text: '<img src=x onerror=alert(1)>', target_tab: 'catalog', is_active: true }];
  context.__render.renderRootNotifications();
  const notifications = elements.get('root-notifs-container').innerHTML;
  assert.match(notifications, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(notifications, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.equal((notifications.match(/<script>/g) || []).length, 0);
});

test('Drive image renderer refuses executable and non-HTTPS URL schemes', () => {
  const { context, elements } = createAppContext();
  context.__render.renderDriveMediaGrid([
    null, { url: 'javascript:alert(1)' }, { url: 'data:text/html,<script>alert(1)</script>' },
    { url: 'http://example.invalid/photo.jpg' }, { url: 'https://drive.google.com/uc?id=abc' }
  ]);
  const html = elements.get('drive-media-container').innerHTML;
  assert.equal((html.match(/src=""/g) || []).length, 3);
  assert.match(html, /src="https:\/\/drive\.google\.com\/uc\?id=abc"/);
});

test('numeric strings are summed as numbers and malformed stats stay visible', () => {
  const { context, elements } = createAppContext();
  context.currentStatsPeriod = '7days';
  context.cachedStatsData = {
    past7days: [
      { date: '2026-11-14', visits: '10', orders_count: '2', orders_total: '1500', completed_count: '1' },
      { date: '2026-11-15', visits: 'bad', orders_count: null, orders_total: '', completed_count: 'NaN' }
    ], products_views: [{ title: 'Rose', views: 'bad', unique_views: null }], notifications_stats: []
  };
  context.__render.renderRootStats();
  assert.equal(elements.get('stat-val-visits').innerText, 10);
  assert.equal(elements.get('stat-val-orders').innerText, 2);
  assert.equal(elements.get('stat-val-revenue').innerText, '1500 ₽');
  assert.match(elements.get('stats-daily-tbody').innerHTML, /—/);
  assert.match(elements.get('stats-products-list').innerHTML, /—/);
});

test('invalid catalog prices are not silently presented as zero rubles', () => {
  const { context } = createAppContext();
  const html = context.__render.renderShopCard({ id: 'missing-price', title: 'Rose', price: null, is_active: true });
  assert.match(html, />—<\/span>/);
  assert.doesNotMatch(html, /0 ₽/);
});

test('keyboard enhancement uses checkbox semantics, one activation, and keeps toggle ARIA in sync', () => {
  const { context, document, FakeElement } = createUtilsContext();
  const group = new FakeElement('div', ['toggle-grid'], false);
  const delivery = new FakeElement('div', ['toggle-btn', 'active']);
  const pickup = new FakeElement('div', ['toggle-btn']);
  group.appendChild(delivery); group.appendChild(pickup);
  let activations = 0;
  pickup.onclick = () => { activations += 1; delivery.classList.remove('active'); pickup.classList.add('active'); };
  const checkbox = new FakeElement('div', ['custom-checkbox-wrap']);
  const indicator = new FakeElement('div', ['custom-checkbox', 'checked'], false);
  checkbox.appendChild(indicator);
  checkbox.onclick = () => { activations += 1; indicator.classList.toggle('checked'); };
  document.body.appendChild(group);
  document.body.appendChild(checkbox);
  assert.equal(checkbox.getAttribute('role'), 'checkbox');
  assert.equal(checkbox.getAttribute('aria-checked'), 'true');
  assert.equal(checkbox.getAttribute('aria-pressed'), null);
  assert.equal(delivery.getAttribute('aria-pressed'), 'true');
  assert.equal(pickup.getAttribute('aria-pressed'), 'false');

  let prevented = 0;
  document.dispatch('keydown', { target: pickup, key: 'Enter', repeat: true, preventDefault() { prevented += 1; } });
  assert.equal(activations, 0);
  document.dispatch('keydown', { target: pickup, key: 'Enter', repeat: false, preventDefault() { prevented += 1; } });
  document.dispatch('keyup', { target: pickup, key: 'Enter', preventDefault() { prevented += 1; } });
  assert.equal(activations, 1);
  assert.equal(delivery.getAttribute('aria-pressed'), 'false');
  assert.equal(pickup.getAttribute('aria-pressed'), 'true');

  document.dispatch('keydown', { target: checkbox, key: ' ', preventDefault() { prevented += 1; } });
  assert.equal(activations, 1);
  document.dispatch('keyup', { target: checkbox, key: ' ', preventDefault() { prevented += 1; } });
  assert.equal(activations, 2);
  assert.equal(checkbox.getAttribute('aria-checked'), 'false');
  assert.ok(prevented >= 3);
  assert.equal(typeof context.window.syncToggleClickTargetGroup, 'function');
});

test('MutationObserver enhances new leaves once and removes button semantics after nested controls appear', () => {
  const { body, FakeElement, FakeMutationObserver } = createUtilsContext();
  const leaf = new FakeElement('div');
  body.appendChild(leaf);
  assert.equal(leaf.getAttribute('role'), 'button');
  assert.equal(leaf.getAttribute('tabindex'), '0');
  const nestedButton = new FakeElement('button');
  leaf.appendChild(nestedButton);
  assert.equal(leaf.getAttribute('role'), null);
  assert.equal(leaf.getAttribute('tabindex'), null);
  assert.equal(nestedButton.getAttribute('role'), null);
  assert.equal(FakeMutationObserver.all.filter(observer => observer.options?.childList).length, 1);
});
