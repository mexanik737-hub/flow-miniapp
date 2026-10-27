// Навигация по экранам
function navigateTab(screenName, btnEl) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screenName}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.dock-tab').forEach(t => t.classList.remove('active'));
  if (btnEl) {
    btnEl.classList.add('active');
    btnEl.classList.add('spinning');
    setTimeout(() => btnEl.classList.remove('spinning'), 400);
  }

  if (screenName === 'profile') {
    if (typeof checkUserSession === 'function') checkUserSession();
    if (typeof loadUserOrders === 'function') loadUserOrders();
  }
  if (screenName === 'about') {
    loadAboutFaq();
  }
  if (screenName === 'root' && isAdmin) {
    if (typeof loadRootOrders === 'function') loadRootOrders(false);
  }
}

// Загрузка динамического конфига текстов и реквизитов
async function loadConfig() {
  try {
    const cfg = await apiGet('get_config');
    SERVER_CONFIG = cfg;

    const sbpBtn = document.getElementById('pay-sbp-btn');
    if (sbpBtn && cfg.sbp_url) sbpBtn.href = cfg.sbp_url;

    const qrImg = document.getElementById('sbp-qr-image-tag');
    if (qrImg && cfg.sbp_qr) qrImg.src = cfg.sbp_qr;

    if (cfg.shop_phone_tel) {
      const telLink = 'tel:' + cfg.shop_phone_tel;
      const callBtn = document.getElementById('shop-call-btn');
      if (callBtn) callBtn.href = telLink;

      const phoneTextBtn = document.getElementById('shop-phone-text-btn');
      if (phoneTextBtn) {
        phoneTextBtn.href = telLink;
        if (cfg.shop_phone) phoneTextBtn.innerText = cfg.shop_phone;
      }

      const asmBtn = document.getElementById('assembly-call-btn');
      if (asmBtn) {
        asmBtn.href = telLink;
        asmBtn.innerText = `📞 Позвонить в салон (${cfg.shop_phone || ''})`;
      }
    }

    if (cfg.store_lat && cfg.store_lon) {
      const mapIframe = document.getElementById('yandex-map-iframe');
      if (mapIframe) {
        mapIframe.src = `https://yandex.ru/map-widget/v1/?ll=${cfg.store_lon}%2C${cfg.store_lat}&z=16&pt=${cfg.store_lon},${cfg.store_lat},pm2rdm`;
      }
    }

    Object.keys(cfg).forEach(key => {
      document.querySelectorAll(`[data-config-key="${key}"]`).forEach(el => {
        el.innerText = cfg[key];
      });
    });
  } catch (e) {}
}

// Загрузка и аккордеон FAQ в «О нас»
async function loadAboutFaq() {
  const container = document.getElementById('about-faq-container');
  if (!container) return;

  try {
    const faqList = await apiGet('faq');
    if (!faqList.length) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center;">Вопросы загружаются...</div>`;
      return;
    }

    container.innerHTML = faqList.map((f, idx) => `
      <div class="faq-pill-item" id="about-faq-pill-${idx}">
        <div class="faq-pill-header" onclick="toggleFaqPill(${idx})">
          <span>${f.question}</span>
          <span>▼</span>
        </div>
        <div class="faq-pill-body">${f.answer}</div>
      </div>
    `).join('');
  } catch (e) {}
}

function toggleFaqPill(idx) {
  const el = document.getElementById(`about-faq-pill-${idx}`);
  if (!el) return;
  el.classList.toggle('open');
}

function contactSupport() {
  const url = SERVER_CONFIG.support_url || "https://t.me/";
  if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}

// Стартовый цикл инициализации
document.addEventListener('DOMContentLoaded', () => {
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
  }

  loadConfig();
  if (typeof loadCatalog === 'function') loadCatalog();
  if (typeof checkUserSession === 'function') checkUserSession();
  if (typeof initDraggableFab === 'function') initDraggableFab();

  // Фоновый опрос заказов раз в 35 секунд
  setInterval(() => {
    const activeScreen = document.querySelector('.screen.active')?.id;
    if (activeScreen === 'screen-profile') {
      if (typeof loadUserOrders === 'function') loadUserOrders();
    }
    if (activeScreen === 'screen-root' && isAdmin) {
      const secOrders = document.getElementById('root-sec-orders')?.style.display !== 'none';
      if (secOrders && typeof loadRootOrders === 'function') loadRootOrders(false);
    }
  }, 35000);
});
