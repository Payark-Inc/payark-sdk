# Plan: Implement Effect in PayArk SDK

This document outlines the strategy for integrating the [Effect](https://effect.website/) ecosystem into the PayArk SDK to provide a type-safe, functional, and robust developer experience.

## Objectives

- Integrate `effect` as a core dependency for internal logic (HTTP, Error handling).
- Expose an `Effect`-based API side-by-side with the current Promise-based API.
- Leverage Effect Schema for robust runtime validation and type-safe error reporting.
- Implement specialized "Effectful" resources (e.g., `checkout.effect`, `payments.effect`).

## 1. Analysis & Infrastructure

- [ ] Research Effect Ecosystem: Study `Schema`, `HttpClient`, `Effect` patterns for SDKs.
- [ ] Define Core Effect Types: Map existing `PayArkError` to Effect `Data.Error` or tagged unions.
- [ ] Define API Schema: Use `@effect/schema` to define request/response shapes for better runtime safety.

## 2. Implementation: Core Layers

- [ ] **HTTP Layer (`HttpClient`)**:
  - Optional: Refactor internal `HttpClient` to use `@effect/platform/HttpClient`.
  - Map HTTP errors to specialized Effect types.
- [ ] **Error Handling**:
  - Convert `errors.ts` definitions to be Effect-compatible.
  - Implement a centralized error mapper from raw API responses to Effect errors.

## 3. Implementation: Resource Extension

- [ ] Update `BaseResource`: Add support for Effect-returning methods.
- [ ] **Checkout Resource**:
  - Implement `checkout.createEffect()` or `checkout.effect`.
- [ ] **Payments Resource**:
  - Implement `payments.listEffect()`, `payments.getEffect()`.
- [ ] **Project Resource**:
  - Implement `projects.listEffect()`.

## 4. API Exposure & Documentation

- [ ] Update `PayArk` class to expose the Effect flavor.
- [ ] Update `index.ts` re-exports.
- [ ] Update README with examples of using the Effect API.
- [ ] Add `examples/` folder showing Effect integration in Next.js/Express.

## 5. Verification & Testing

- [ ] Unit Tests: Validate Effect-based methods return correct results/errors.
- [ ] Integration Tests: Use TestHttpClient to mock API responses and verify Effect behavior.
- [ ] Ensure backward compatibility with existing Promise API.

---

## Decisions

- **Namespaced API**: We will expose the Effect API via `payark.effect.*` (e.g., `payark.effect.checkout.create`). This keeps the top-level API clean while providing a sandbox for functional patterns.
- **Internal Refactor**: We will implement a new `EffectHttpClient` that leverages `@effect/platform/HttpClient`. This allows us to use Effect's native retry, timeout, and tracing capabilities without touching the legacy `fetch` logic for the Promise API.
- **Schema First**: We will integrate `@effect/schema` for the Effect API. This ensures that any data coming from the Effect side is validated at runtime, providing much better error messages than a simple `try/catch`.

## Status

- [x] Initial Research
- [x] Plan Created
- [x] `effect` package added to `packages/sdk/package.json`
- [x] Implementation Strategy Finalized
- [x] Infrastructure (Errors, HTTP Client, Config Service)
- [x] Schema Definitions (Checkout, Payment, Project, Paginated)
- [x] Resource Implementation (Checkout, Payments, Projects)
- [x] Verification (Unit & High-Level Tests)
- [x] Documentation (README)
