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
| POL-07 | Выполнить syntax, regression, diff, browser и responsive проверки без реальных записей. | verified — доступные checks пройдены; отсутствие executable runner описано в `docs/agent/VERIFICATION.md` |
| POL-08 | Сохранить матрицу переноса, отчёт и скриншоты до/после. | verified — `qa/floral-glass-polish-integration/` |
| POL-09 | Создать коммит, опубликовать ветку и открыть PR без merge. | pending |
| POL-10 | Сохранить обе темы, `--fg-*` tokens и модульные Floral Glass components без старого CSS override слоя. | verified — изменения только в существующих CSS modules |
| POL-11 | Сохранить HUD, навигацию, категории, карточки и товар дня; менять только их touch/keyboard presentation. | verified — браузер обеих тем и responsive matrix |
| POL-12 | Сохранить cart variants/composite keys и поведение quick-add/quantity. | verified — `js/cart.js` unchanged; catalog IDs сохраняют string contract |
| POL-13 | Сохранить checkout drafts, delivery/pickup, order calculations, payment and confirmation. | verified — `js/order.js` unchanged; modal and field IDs verified |
| POL-14 | Сохранить профиль, address history and registration behavior. | verified — `js/profile.js` unchanged |
| POL-15 | Сохранить notifications and notification interactions. | verified — API/actions unchanged; UI uses same handlers |
| POL-16 | Сохранить все 6 Root sections and administrative actions. | verified — all sections switched; render templates preserve handler actions |
| POL-17 | Сохранить existing DOM IDs and inline JS contracts. | verified — altered elements retain IDs/handlers; checkout IDs checked |
| POL-18 | Preserve user copies of Apps Script, backups, instructions, tests and design/QA materials. | verified — old checkout status matches initial inventory; no Apps Script in PR |
| POL-19 | Do not merge or deploy; report mock-only limits. | pending — keep pending until PR opened and confirmed unmerged |

Ограничения: не менять `sources/apps-script/`; не выполнять reset, clean, force-push, merge или deploy.
