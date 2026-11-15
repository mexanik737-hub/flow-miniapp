# Handoff

Цель этой ветки — перенести полезные элементы локальной полировки на актуальный Floral Glass UI. Работа идёт только на `codex/floral-glass-polish-integration` от `64474c47`.

Перед push/PR:

1. Проверить `git status`, полный diff, скриншоты и QA/transfer matrix.
2. Перепроверить, что старый checkout не менялся, а `sources/apps-script/` отсутствует в изменениях.
3. Создать один логический commit, push обычным fast-forward способом и открыть PR в `main`.
4. Не выполнять merge/deploy.

Неисполняемый regression harness отсутствует на main. В PR описать browser checks и исторический PR #4 отчёт отдельно, не заявляя повторный запуск старой suite.
