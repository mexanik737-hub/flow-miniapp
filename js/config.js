const API_URL = "https://script.google.com/macros/s/AKfycbyVgg5E-dVDS66rVmi_cCBgt7DPaE46RocWXk2wT5HXhc_I95DV6rcvinHB0ksVjdKAvA/exec";
 
// Константы координат и ID администратора
const STORE_LAT = 55.966987;
const STORE_LON = 37.151059;
const ADMIN_TELEGRAM_ID = "8900179932";


// Динамический защищенный конфиг с сервера
let SERVER_CONFIG = {
  dadata_token: "",
  sbp_url: "",
  sbp_qr: "",
  shop_phone: "",
  shop_phone_tel: "",
  support_url: "",
  store_lat: null,
  store_lon: null,
  yandex_org_url: "https://yandex.ru/maps/org/tsvety/18169538769?si=w0t417tmmfzn5zadubrew3uker"
};


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
let sessionPasscode = ""; // Заполняется строго при ручном вводе


function applyTelegramTheme() {
  const scheme = tg?.colorScheme || 'dark';
  document.documentElement.setAttribute('data-theme', scheme);
  if (tg) {
    tg.setHeaderColor(scheme === 'light' ? '#ffffff' : '#090c12');
    tg.setBackgroundColor(scheme === 'light' ? '#f8fafc' : '#090c12');
  }
}
applyTelegramTheme();
if (tg?.onEvent) tg.onEvent('themeChanged', applyTelegramTheme);


// Глобальное состояние каталога и корзины
let catalog = [];
let displayCatalog = [];
let filteredCatalog = [];
let selectedFilterCategoryValue = 'Все';


// Локальное сохранение корзины клиента (восстановление при открытии)
let cart = JSON.parse(localStorage.getItem('flw_cart') || '{}');
let cartAssemblyItems = JSON.parse(localStorage.getItem('flw_cart_assembly') || '{}');
let isAssemblyMode = false;
let ordSaveAddrChecked = false;


// Состояние пользователя и адресов
let currentUser = JSON.parse(localStorage.getItem('flw_user_profile') || 'null');
let savedAddresses = JSON.parse(localStorage.getItem('flw_saved_addresses') || '[]');
let isAdmin = (currentUser?.is_admin === true || String(currentUser?.is_admin).toUpperCase() === 'TRUE');


// Состояние Root-панели
let allRootOrders = [];
let allRootCatalog = [];
let allRootClients = [];
let allRootFaq = [];
let lastRootOrdersHash = "";
let currentRootSubTab = 'active';


// Состояние модалок и характеристик товара
let activePopItem = null;
let popQty = 1;
let selectedGroupPack = "";
let selectedGroupVariant = "";
let selectedGroupColor = ""; // Новая независимая характеристика цвета


let orderDelType = 'delivery';
let orderRecType = 'self';


let selectedGeoAddress = null;
let currentDeliveryCost = 0;
let currentDistanceKm = 0;
let currentFlowersSubtotal = 0;
let currentFinalOrderAmount = 0;


let activePaymentOrderId = null;
let paymentTimerInterval = null;
let activeRootOrderForStatus = null;
let activeRootOrderForEdit = null;
let tempEditingItems = [];
let tempSelectedCatalogIdToAdd = "";
let uploadTargetContext = null;
let driveModalTarget = "single";
let suggestDebounceTimer = null;
let editingProductId = null;
let editingGroupName = null;
let editingSavedAddrIdx = null;
let editingFaqId = null;


let hudTapCount = 0;
let hudTapTimer = null;


let isTextEditActive = false;
let isFabVisible = false;


// Кеш списка FAQ для ленивой загрузки
let cachedFaqData = null;
