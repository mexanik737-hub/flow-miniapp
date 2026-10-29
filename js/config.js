// URL развернутого веб-приложения Google Apps Script (замените при смене развертывания)
const API_URL = "https://script.google.com/macros/s/AKfycbzQ3tH2Z7aA7N-E3t5uW5V1vG7Y8x4Z1aB2cD3eF4g5h6i7j8k/exec";

// Идентификаторы доступа и супер-администратор
const ADMIN_TELEGRAM_ID = "8900179932";
const ROOT_PASSCODE_DEFAULT = "m1rfol159036";

// Координаты салона по умолчанию (Зеленоград, Георгиевский пр-т, 37к2)
const STORE_LAT = 55.976822;
const STORE_LON = 37.151748;

// Инициализация Telegram WebApp API
const tg = window.Telegram?.WebApp;
let userId = "anon_" + Math.floor(Math.random() * 899999 + 100000);
let tgFirstName = "Клиент";
let tgUsername = "";

if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
  const u = tg.initDataUnsafe.user;
  userId = String(u.id);
  tgFirstName = u.first_name || "Клиент";
  tgUsername = u.username ? "@" + u.username : "";
}

// Глобальные состояния данных каталога и корзины
let catalog = [];
let displayCatalog = [];
let filteredCatalog = [];
let selectedFilterCategoryValue = "Все";

// Корзина и сборка букета (считывание из localStorage)
let cart = {};
let cartAssemblyItems = {};
let isAssemblyMode = false;

try {
  const savedCart = localStorage.getItem('flw_cart');
  if (savedCart) cart = JSON.parse(savedCart);
  const savedAsm = localStorage.getItem('flw_cart_assembly');
  if (savedAsm) cartAssemblyItems = JSON.parse(savedAsm);
  const savedAsmMode = localStorage.getItem('flw_is_assembly_mode');
  if (savedAsmMode) isAssemblyMode = (savedAsmMode === 'true');
} catch (e) {
  cart = {};
  cartAssemblyItems = {};
  isAssemblyMode = false;
}

// Активная карточка товара в модалке
let activePopItem = null;
let popQty = 1;
let selectedGroupPack = "";
let selectedGroupVariant = "";
let selectedGroupColor = "";

// Профиль клиента
let currentUser = null;
let isAdmin = (String(userId) === ADMIN_TELEGRAM_ID);
let sessionPasscode = "";
let savedAddresses = [];
let editingSavedAddrIdx = null;

try {
  const cachedProf = localStorage.getItem('flw_user_profile');
  if (cachedProf) currentUser = JSON.parse(cachedProf);
  const cachedAddrs = localStorage.getItem('flw_saved_addresses');
  if (cachedAddrs) savedAddresses = JSON.parse(cachedAddrs);
} catch (e) {}

// Оформление заказа
let orderDelType = "delivery";
let orderRecType = "self";
let selectedGeoAddress = null;
let currentFlowersSubtotal = 0;
let currentDeliveryCost = 0;
let currentDistanceKm = 0;
let currentFinalOrderAmount = 0;
let suggestDebounceTimer = null;
let ordSaveAddrChecked = false;
let activePaymentOrderId = null;
let paymentTimerInterval = null;

// Уведомления клиента
let clientNotifications = [];
let readNotificationIds = [];
try {
  const cachedNotifs = localStorage.getItem('flw_read_notifs');
  if (cachedNotifs) readNotificationIds = JSON.parse(cachedNotifs);
} catch (e) {}

// Административная панель Root
let currentRootSubTab = "active";
let allRootOrders = [];
let lastRootOrdersHash = "";
let allRootCatalog = [];
let allRootClients = [];
let allRootNotifs = [];
let allRootFaq = [];
let activeRootOrderForStatus = null;
let activeRootOrderForEdit = null;
let tempEditingItems = [];
let tempSelectedCatalogIdToAdd = "";
let editingProductId = null;
let editingGroupName = null;
let editingFaqId = null;
let uploadTargetContext = null;
let driveModalTarget = "single";
let cachedStatsData = null;
let currentStatsPeriod = "today";

// Режим живого редактирования текстов
let isFabVisible = false;
let isTextEditActive = false;
let SERVER_CONFIG = {};

// Счётчик тапов по плашке салона для входа в Root
let hudTapCount = 0;
let hudTapTimer = null;
