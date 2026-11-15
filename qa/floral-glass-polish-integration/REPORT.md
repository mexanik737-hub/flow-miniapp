# Отчёт: локальная полировка на Floral Glass

База: `64474c470158dcab06c8ba084ea8d4e08bbd913f` (актуальный `main`).
Ветка: `codex/floral-glass-polish-integration`.

## Выполнено

- Сохранён утверждённый Floral Glass UI и его модульная архитектура.
- Размеры малых целей и Root navigation доведены до 44 px. Для заголовка карточки добавлена отдельная native keyboard button; контейнер карточки не получает вложенную button-role.
- Кнопки уведомлений и профиля в HUD стали нативными кнопками с доступными именами.
- Кликабельные leaf `div` с inline handlers получают `role=button`, `tabindex=0`, keyboard Enter/Space. Узлы с вложенными интерактивными элементами исключаются; для toggle/checkbox передаётся `aria-pressed`.
- Root безопасно выводит клиентские/заказные/товарные данные, категории, FAQ, уведомления, статистику и фото-превью. Ссылки на Telegram и телефон формируются из проверенных значений. Контракты API, права, серверные действия и бизнес-расчёты не менялись.
- Матрица переноса показывает, что крупные изменения оплаты, регистрации, профиля, Root прав и статистики уже были включены в актуальный main.

## Проверки

- `node --check` для всех JavaScript-файлов в `js/` — пройдено.
- `git -c core.whitespace=cr-at-eol diff --check` — пройдено. У worktree `core.autocrlf=true`, поэтому явный `cr-at-eol` нужен для корректной проверки CRLF-файла `index.html`.
- Browser: каталог запустился с четырьмя безопасными фиктивными товарами; keyboard Enter открыл карточку товара; HUD-кнопки стали `BUTTON`; Root переключил все 6 секций. Root использовал только mock GET запросы; действий записи не нажимали.
- Browser security smoke: тестовые HTML payloads в клиентах, каталоге, категориях, заказе, FAQ, уведомлениях и статистике не создали injected DOM-элементов и не исполнились; `javascript:` не попал в телефонную ссылку или Drive preview. Кнопки Root-действий присутствуют.
- Адаптивность проверена в светлой и тёмной теме на 320, 360, 390, 430, 768 и 1440 px: горизонтального overflow нет. Минимальные измеренные цели HUD, quick-add и title button — 44 px.
- В браузерной сессии внешний логотип `lh3.googleusercontent.com` заблокирован изолированной средой (`net::ERR_FAILED`). Security smoke также сформировал один ожидаемо невалидный test image source; оба сообщения относятся к загрузке ресурсов, не к исполнению JS. Фото в mock-товарах отсутствовали. Реальные Telegram WebView, Google Apps Script, фото-хранилище, клавиатуры iOS/Android и server-side auth не проверялись.
- В текущем main нет исполняемого test runner/package script. Старая `tests/regression.test.js` привязана к пользовательскому `sources/apps-script/` из старого checkout, поэтому не переносилась и не использовалась как свидетельство теста актуального main. QA-отчёт PR №4 фиксирует 276 прошлых сценариев; это исторический baseline, а не повторный запуск в этой ветке.

## Снимки

До — артефакты подтверждённой Floral Glass интеграции:

- `../floral-glass-integration/screenshots/current-390-dark-catalog.jpg`
- `../floral-glass-integration/screenshots/current-390-light-catalog.jpg`

После:

- `screenshots/after-390-dark-catalog.png`
- `screenshots/after-390-light-catalog.png`

Сравнение композиции подтверждает, что полировка остаётся в утверждённой Floral Glass системе. Из-за недоступности внешнего изображения в изолированном браузере фактура фотографий не сравнивается.

## Сохранность

Старый worktree, его uncommitted файлы, локальные Apps Script зеркала, backups, тесты и дизайн/QА материалы не переносились и не редактировались. Текущий PR включает только работу отдельного worktree от `64474c47`.

## Дополнение: финальная регрессия и независимые аудиты PR #5

Проверяемый исходный коммит: `ae742bbbc5a6c6271f77cd4b6c9246a46d2f8f46`.

### Независимые результаты

- **Security review:** новых подтверждённых XSS в проверенных шаблонах клиентов/заказов/каталога/FAQ/уведомлений не обнаружено. Подтверждённая проблема осталась в фильтре категорий витрины: необработанное название интерполировалось одновременно в текст и `onclick`. Исправлено JSON serialization + `shopEscape`. Отдельно зафиксированы: серверная авторизация Root не доказана без Apps Script; passcode в query string — унаследованный риск; любой HTTPS URL в Root Drive preview может раскрыть время просмотра внешнему хосту.
- **Frontend review:** `aria-pressed` соседних checkout toggles рассинхронизировался при смене доставки/получателя; visual checkbox wrappers объявлялись как buttons. Исправлено групповой синхронизацией toggle state и семантикой `role=checkbox` + `aria-checked`. Новый nested interactive node снимает с прежнего leaf target роль/табуляцию.
- **QA review:** Root orders падал при отсутствующем/non-string status/recipient и ошибочных item полях; `Number(...) || 0` скрывал ошибки чисел и weekly sums могли склеивать строки; редакторы продукта и FAQ трактовали ID `0` как создание. Исправлено и покрыто fixtures.
- **Test inventory:** в исходном `ae742bb` не было `package.json`, runner, тестов или CI. npm/Playwright package отсутствуют в среде; выбран встроенный `node:test`, без новых runtime dependencies.

### Постоянный набор

Команда: `node --test tests/regression.test.js` (Node.js 20+). Текущий последний запуск: **31 тест пройден, 0 ошибок**. Набор проверяет parser для всех JS modules, escaping и восстановление IDs из inline handlers, category payload, Root шаблоны и URL схемы, malformed API shapes, числовые edge cases, корзину и composite keys, delivery/pickup checkout exact payload + duplicate submit, registration validation, editor ID `0`, Root section switching, отмену удаления, keyboard Enter/Space, ARIA и dynamic MutationObserver.

GitHub Actions `.github/workflows/frontend-regression.yml` выполняет test command и `git diff --check` для PR в `main`.

### Ограничения и риски

- VM тесты запускают реальные JS функции с минимальным mock DOM; HTML-строки проходят round-trip проверку serialized inline args, но браузерный HTML parser не заменён полноценным Playwright тестом.
- Браузерные тесты не запускались: страница автоматически отправляет GET к настроенному Google Apps Script уже при открытии, а в окружении отсутствует надёжный Playwright runner, который можно включить в CI без новой зависимости. Тестовый `fetch` по умолчанию падает, успешные тестовые записи используют только `mock://api`.
- Серверная проверка роли/passcode для каждого `admin_*` action не подтверждена: backend в GitHub checkout отсутствует. Production API, Google Sheets, Telegram, платежи и Apps Script не проверялись/не изменялись.
- PR открыт, не слит. Готовность: frontend regressions исправлены и покрыты; перед merge требуется отдельное подтверждение backend authorization и успешный обычный результат GitHub Actions.
