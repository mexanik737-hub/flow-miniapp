# Handoff

Цель этой ветки — перенести полезные элементы локальной полировки на актуальный Floral Glass UI и закрепить regression/security tests для PR #5. Работа идёт только на `codex/floral-glass-polish-integration` от `64474c47`.

Перед последующей передачей:

1. Проверить `git status`, полный diff, скриншоты и QA/transfer matrix.
2. Перепроверить, что старый checkout не менялся, а `sources/apps-script/` отсутствует в изменениях.
3. Коммитить и обновлять только ветку `codex/floral-glass-polish-integration`; PR #5 уже открыт.
4. Не выполнять merge/deploy.

`node --test tests/regression.test.js` запускает воспроизводимые VM regressions. Browser layout, реальные Apps Script, Telegram WebView и серверную авторизацию не проверяли в этом этапе. Не подключать локальный browser к production endpoint.
