export const productRecords = [
  {
    id: "p1",
    title: "Розовый ритм",
    description: "Объёмная композиция с мягкими оттенками и живой фактурой.",
    basePrice: 4650,
    images: ["assets/bouquet-rose.jpg"],
    badges: [{ label: "Выбор флориста", tone: "default" }],
    availability: "available",
    category: "soft",
    collection: "popular",
    optionGroups: [
      { key: "size", label: "Размер", required: true, values: [
        { id: "compact", label: "Компактный", priceDelta: 0 },
        { id: "classic", label: "Классический", priceDelta: 850 },
        { id: "grand", label: "Большой", priceDelta: 1650 }
      ] },
      { key: "wrap", label: "Оформление", required: true, dependsOn: { key: "size", values: ["grand"] }, values: [
        { id: "linen", label: "Льняная лента", priceDelta: 0 },
        { id: "silk", label: "Шёлковая лента", priceDelta: 290 }
      ] }
    ]
  },
  {
    id: "p2",
    title: "Гранатовый вечер",
    description: "Глубокий цвет и выразительная форма для заметного жеста.",
    basePrice: 5200,
    images: ["assets/bouquet-cream.jpg"],
    badges: [{ label: "Новинка", tone: "new" }, { label: "Лимитированная серия", tone: "limited" }],
    availability: "limited",
    category: "bright",
    collection: "new",
    optionGroups: [
      { key: "stem-count", label: "Объём композиции", required: true, values: [
        { id: "small", label: "Малый", priceDelta: 0 },
        { id: "medium", label: "Средний", priceDelta: 900 },
        { id: "large", label: "Большой", priceDelta: 1900 }
      ] },
      { key: "card", label: "Открытка", required: false, values: [
        { id: "none", label: "Без открытки", priceDelta: 0 },
        { id: "paper", label: "Авторская бумага", priceDelta: 180 }
      ] }
    ]
  },
  {
    id: "p3",
    title: "Тихое утро",
    description: "Светлая композиция с чистой формой.",
    basePrice: 3900,
    images: ["assets/bouquet-white.jpg"],
    badges: [],
    availability: "unavailable",
    category: "minimal",
    collection: "popular",
    optionGroups: []
  },
  {
    id: "p4",
    title: "Композиция из сезонных цветов с длинным названием для проверки трёх строк и устойчивой сетки",
    description: "Тестовая запись с длинным русским заголовком без специальных правил рендера.",
    basePrice: 6350,
    images: [],
    badges: [],
    availability: "available",
    category: "soft",
    collection: "new",
    optionGroups: []
  }
];

export const initialOrders = [
  { id: "FG-2048", client: "Анна Смирнова", address: "ул. Примерная, 12", status: "Подтверждён", statusTone: "success", amount: 4650, time: "14:20" },
  { id: "FG-2047", client: "Ирина Волкова", address: "пр-т Цветочный, 8", status: "Собирается", statusTone: "queued", amount: 5200, time: "13:05" },
  { id: "FG-2046", client: "Мария Белова", address: "пер. Тихий, 4", status: "Готов", statusTone: "info", amount: 3900, time: "12:41" }
];

export const clients = [
  { name: "Анна Смирнова", orders: 4, total: 17600, last: "Сегодня · 14:20", status: "Постоянный клиент", tone: "success" },
  { name: "Екатерина", orders: 1, total: 5200, last: "12 ноября", status: "Новый", tone: "queued" }
];

export const faqRecords = [
  { question: "Как ухаживать за композицией?", answer: "Подрежьте стебли под углом и меняйте воду ежедневно. Это демонстрационный ответ для проверки аккордеона.", visible: true },
  { question: "Можно ли добавить открытку?", answer: "Да, текст открытки можно указать в пожеланиях к заказу. В реальном приложении состав определяется бизнес-логикой.", visible: true },
  { question: "Как выбрать время получения?", answer: "Интервалы отображаются как пример формы. Доступные слоты в настоящем продукте задаются сервером.", visible: false }
];

export const broadcastDraft = {
  title: "Коллекция недели",
  message: "Новая подборка цветов — тихие оттенки, выразительные формы и немного весеннего света.",
  segment: "Все клиенты"
};
