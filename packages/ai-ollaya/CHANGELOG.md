# @tanstack/ai-ollaya

## 0.2.0

### Minor Changes

- [#1562](https://github.com/TanStack/ai/pull/1562) [`f29596b`](https://github.com/TanStack/ai/commit/f29596ba407f7fc766f4484b492cb415f9b6a9ff) - Add `@tanstack/ai-ollaya`, an evaluate adapter for a local Ollaya decision
  server. `ollayaDecider(model)` runs `decide()` against the open-source `laya`
  models over Ollaya's `POST /v1/systemone` endpoint — same wire contract as
  TypeSafe's Jev, fully local, no API key. Defaults to `http://127.0.0.1:11435`.

### Patch Changes

- [#1571](https://github.com/TanStack/ai/pull/1571) [`e9ff416`](https://github.com/TanStack/ai/commit/e9ff4161efed9e6470755ba82edd66a9834c370a) - Treat a blank `baseURL` as the default Ollaya host, `http://127.0.0.1:11435`.
