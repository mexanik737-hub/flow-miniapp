# Frontend regression tests

Run the dependency-free regression suite with Node.js 20 or newer:

```sh
node --test tests/regression.test.js
```

The suite evaluates the real frontend functions in isolated Node VM contexts. Its `fetch` default throws; test cases that exercise writes replace it with a mock endpoint and assert the captured payload. It never uses `sources/apps-script/`, Google Sheets, Telegram, payment services, or production API hosts.

Coverage includes JavaScript parsing, HTML escaping and serialized inline-handler arguments, category labels and IDs, Root renderers and URL schemes, malformed API fields and numeric values, cart variant keys, pickup checkout and duplicate-submit protection, registration validation, Root section navigation, editor ID `0`, cancelled destructive actions, keyboard activation, ARIA state, and dynamic `MutationObserver` behavior.

GitHub Actions runs this command and `git diff --check` on pull requests targeting `main`. Browser layout and real Telegram/WebView behavior are not exercised by this dependency-free suite. A browser CI runner is deferred because the repository has no browser-test dependencies and the available local browser loads the configured external Apps Script endpoint on page navigation; tests in this suite therefore remain isolated and make no live requests.
