# Требования: перенос Floral Glass polish

Основа: `origin/main` `64474c470158dcab06c8ba084ea8d4e08bbd913f`.
Рабочая ветка: `codex/floral-glass-polish-integration`.

| ID | Требование | Статус |
|---|---|---|
| POL-01 | Сохранить старый checkout и все его пользовательские файлы без изменений. | verified — старый worktree не редактировался |
| POL-02 | Зафиксировать сопоставление локальных изменений с актуальным main. | verified — `qa/floral-glass-polish-integration/TRANSFER_MATRIX.md` |
| POL-03 | Сохранить Floral Glass как базовую архитектуру, обе темы, адаптивность и отсутствие overflow. | verified — 6 ширин × 2 темы |
| POL-04 | Улучшить клавиатурную доступность интерактивных элементов без нарушения вложенных кнопок и JS-контрактов. | verified — browser Enter + leaf target smoke |
| POL-05 | Увеличить малые сенсорные цели, не ломая компоновку на заданных ширинах. | verified — browser geometry 44 px, overflow отсутствует |
| POL-06 | Экранировать данные клиента/товара в Root, сохранив API, права и действия. | verified — payload smoke; API/business files unchanged |
| POL-07 | Выполнить syntax, regression, diff, browser и responsive проверки без реальных записей. | verified — initial browser smoke passed; permanent Node suite added in final audit; browser limits documented |
| POL-08 | Сохранить матрицу переноса, отчёт и скриншоты до/после. | verified — `qa/floral-glass-polish-integration/` |
| POL-09 | Создать коммит, опубликовать ветку и открыть PR без merge. | verified — PR #5 открыт; HEAD `ae742bb` |
| POL-10 | Сохранить обе темы, `--fg-*` tokens и модульные Floral Glass components без старого CSS override слоя. | verified — визуальные изменения только в актуальных модулях; audit правит поведение и не добавляет legacy CSS |
| POL-11 | Сохранить HUD, навигацию, категории, карточки и товар дня; менять только их touch/keyboard presentation. | verified — браузер обеих тем и responsive matrix |
| POL-12 | Сохранить cart variants/composite keys и поведение quick-add/quantity. | verified — `js/cart.js` unchanged; catalog IDs сохраняют string contract |
| POL-13 | Сохранить checkout drafts, delivery/pickup, order calculations, payment and confirmation. | verified — бизнес-поведение `js/order.js` сохранено; добавлена только синхронизация ARIA toggles |
| POL-14 | Сохранить профиль, address history and registration behavior. | verified — `js/profile.js` unchanged |
| POL-15 | Сохранить notifications and notification interactions. | verified — API/actions unchanged; UI uses same handlers |
| POL-16 | Сохранить все 6 Root sections and administrative actions. | verified — all sections switched; render templates preserve handler actions |
| POL-17 | Сохранить existing DOM IDs and inline JS contracts. | verified — altered elements retain IDs/handlers; checkout IDs checked |
| POL-18 | Preserve user copies of Apps Script, backups, instructions, tests and design/QA materials. | verified — old checkout status matches initial inventory; no Apps Script in PR |
| POL-19 | Do not merge or deploy; report mock-only limits. | verified — PR #5 открыт, `merged: false`; deploy не выполнялся |

Ограничения: не менять `sources/apps-script/`; не выполнять reset, clean, force-push, merge или deploy.

## Финальная регрессия PR #5

| ID | Требование | Статус |
|---|---|---|
| AUD-01 | Добавить один документированный dependency-free Node test command и CI для будущих PR. | verified — `node --test tests/regression.test.js`, GitHub Actions workflow |
| AUD-02 | Проверить escaping, inline handler IDs, категории, фото-схемы и все изменённые Root-шаблоны. | verified — тесты реальных функций в VM; backend не запускался |
| AUD-03 | Проверить некорректные/отсутствующие API fields и числовые значения, не подменяя ошибки нулями. | verified — malformed fixtures и placeholder `—` |
| AUD-04 | Проверить Enter/Space, однократное действие, checkbox/toggle ARIA и DOM mutations. | verified — isolated DOM fixture, новые элементы и вложенный control |
| AUD-05 | Проверить cart variants, pickup checkout/payload, duplicate submit, регистрацию и Root-разделы на mock API. | verified — mock-only функции; production host заблокирован тестовым окружением |
| AUD-06 | Независимо провести Security, QA и Frontend reviews. | verified — отчёты сведены в `qa/floral-glass-polish-integration/REPORT.md` |
| AUD-07 | Не менять Apps Script, production данные и секреты; не выполнять merge/deploy. | verified — только локальный mock fetch; PR открыт и не слит |
