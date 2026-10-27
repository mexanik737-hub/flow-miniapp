// Конфигурация бэкенда и сетевого окружения
const API_URL = "https://script.google.com/macros/s/AKfycbyVgg5E-dVDS66rVmi_cCBgt7DPaE46RocWXk2wT5HXhc_I95DV6rcvinHB0ksVjdKAvA/exec";

// Динамический защищенный конфиг, наполняемый с сервера через get_config
let SERVER_CONFIG = {
  dadata_token: "",
  sbp_url: "",
  sbp_qr: "",
  shop_phone: "",
  shop_phone_tel: "",
  support_url: "",
  store_lat: null,
  store_lon: null
};

// Инициализация контекста Telegram WebApp
const tg = window.Telegram?.WebApp;

let userId = tg?.initDataUnsafe?.user?.id;
if (!userId) {
  userId = localStorage.getItem('flw_user_id');
  if (!userId) {
    userId = 'anon_' + Math.floor(10000000 + Math.random() * 90000000);
    localStorage.setItem('flw_user_id', userId);
  }
}

const tgFirstName = tg?.initDataUnsafe?.user?.first_name || "Клиент";
const tgUsername = tg?.initDataUnsafe?.user?.username ? `@${tg.initDataUnsafe.user.username}` : "";
let sessionPasscode = ""; // Заполняется строго при ручном вводе через скрытый HUD

let currentUser = JSON.parse(localStorage.getItem('flw_user_profile') || 'null');
let isAdmin = (currentUser?.is_admin === true || String(currentUser?.is_admin).toUpperCase() === 'TRUE');

/**
 * Всплывающее системное уведомление (Toast)
 */
function toast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerText = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

/**
 * Базовый сетевой транспорт (GET-запросы к Apps Script)
 */
async function apiGet(action, params = {}) {
  try {
    const query = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${API_URL}?${query}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`API GET [${action}] failed:`, err);
    throw err;
  }
}

/**
 * Базовый сетевой транспорт (POST-запросы к Apps Script с text/plain для обхода CORS preflight)
 */
async function apiPost(payload = {}) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`API POST [${payload.action}] failed:`, err);
    throw err;
  }
}

/**
 * Переключение выпадающих селектов
 */
function toggleDropdown(boxId) {
  const el = document.getElementById(boxId);
  if (!el) return;
  const wasOpen = el.classList.contains('open');
  document.querySelectorAll('.custom-select-box').forEach(b => b.classList.remove('open'));
  if (!wasOpen) el.classList.add('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-box')) {
    document.querySelectorAll('.custom-select-box').forEach(b => b.classList.remove('open'));
  }
});

/**
 * Универсальный переключатель чекбоксов
 */
function toggleCheckbox(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const isChecked = el.classList.contains('checked');
  el.classList.toggle('checked', !isChecked);
  el.innerText = !isChecked ? '✓' : '';
}

/**
 * Парсер даты заказа из строки в миллисекунды для таймеров
 */
function parseOrderDateToTs(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{2}):(\d{2})\s(\d{2})\.(\d{2})\.(\d{4})/);
  if (match) {
    const [_, h, m, day, mon, yr] = match;
    return new Date(yr, mon - 1, day, h, m).getTime();
  }
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Естественная сортировка чисел и строк для ростовок (40 см, 50 см, 60 см) и фасовок
 */
function sortAscendingValues(arr) {
  return arr.sort((a, b) => {
    const numA = parseInt(String(a).match(/\d+/)?.[0] || 0, 10);
    const numB = parseInt(String(b).match(/\d+/)?.[0] || 0, 10);
    if (numA !== numB) {
      return numA - numB;
    }
    return String(a).localeCompare(String(b), 'ru', { numeric: true });
  });
}
