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
