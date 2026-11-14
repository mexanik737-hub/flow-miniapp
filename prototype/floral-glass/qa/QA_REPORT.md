# QA · Floral Glass UI

## Среда и способ рендера

Проверен запущенный локальный стенд по HTTP: `python3 -m http.server` + Playwright 1.62.1 + Chromium headless shell, Chrome for Testing 151.0.7922.34. Сетевые ресурсы не нужны: все изображения локальные.

Проблема чёрного окна диагностирована. Системный `/usr/bin/chromium` завершался до открытия страницы: wrapper выдавал `[: 5225713664: unexpected operator`, затем Chromium падал на `process_singleton_posix.cc:297` с `socket() failed: Operation not permitted`; crashpad также не мог выполнить `ptrace`. Playwright не нашёл свой ожидаемый pinned browser. Для скриншотов использован доступный headless shell напрямую — он успешно отрисовал страницу и модальные окна.

Для просмотра на своей машине не требуется Playwright: достаточно запустить локальный HTTP-сервер из README и открыть страницу в обычном браузере.

## Результаты

- Проверены 60 состояний: каталог, корзина, оформление, UI Kit и шесть Root-разделов при ширинах 320, 360, 390, 430, 768 и 1440 px. Горизонтального переполнения документа нет.
- Каталог дополнительно снят в обеих темах на каждой из шести ширин.
- В DOM нет атрибутов `style`; компоненты используют общие классы и токены.
- Проверены варианты товара: зависимое оформление включается для размера «Большой», надбавки меняют итоговую цену; позиции без фото/бейджей и недоступная позиция отображаются штатно.
- Проверены добавление варианта в корзину, переход к оформлению, режим самовывоза, локальное завершение заказа, все шесть вкладок Root, Dialog и вложенный ConfirmDialog, повторяемые поля категории и добавление строки в редакторе вариантов.
- Ошибок JavaScript/консоли: 0. Неуспешных запросов: 0. Внешних сетевых запросов: 0.
- Скриншоты сделаны из работающей страницы, не из макетной генерации.

## Скриншоты

Основные изображения:

- `screenshots/catalog-light.png`, `screenshots/catalog-dark.png` — полный каталог в двух темах.
- `screenshots/product-sheet-light.png` — товар и открытый Bottom Sheet с выбранными вариантами.
- `screenshots/cart-light.png`, `screenshots/checkout-light.png` — корзина и форма оформления.
- `screenshots/root-orders-light.png`, `screenshots/root-broadcasts-light.png`, `screenshots/root-faq-light.png`, `screenshots/root-desktop-light.png` — Root на телефоне и широком экране.
- `screenshots/courier-dialog-light.png`, `screenshots/category-sheet-light.png`, `screenshots/variant-editor-light.png`, `screenshots/nested-confirm-light.png` — модальные формы и редакторы.
- `screenshots/ui-kit-buttons-light.png`, `screenshots/ui-kit-controls-light.png`, `screenshots/ui-kit-feedback-light.png`, `screenshots/ui-kit-overlays-light.png` — разделы UI Kit.
- `screenshots/responsive-{theme}-{width}.png` — вид каталога при ширинах 320, 360, 390, 430, 768 и 1440 px.

## Визуальные источники

Стенд следует утверждённым `DESIGN.md`, `VISUAL_COMPOSITION.md`, `COMPONENT_CATALOG.md`, `DATA_AND_RENDERING.md`, `MOTION.md` и `QA_ACCEPTANCE.md`. Использованы идеи многоуровневого стеклянного материала и бликов из источника Liquid Glass, указанного в `RESOURCES.md`; его код в проект не копировался. Композиция Bento, фотографии, слои модальных окон, сокращение движения и состояния карточек собраны штатными HTML/CSS/JS.
