# Plan: Extract @payark/sdk-effect into a standalone package

## Goal

Restore @payark/sdk to a zero-dependency package and create a high-performance @payark/sdk-effect package.

## Phase 1: Infrastructure

- [ ] Create `packages/sdk-effect` directory.
- [ ] Initialize `package.json` with `@effect/*` dependencies.
- [ ] Setup `tsup.config.ts`, `tsconfig.json`, and `bun` testing.
- [ ] Copy shared types from `packages/sdk/src/types.ts` to reaching accessible location or link them.

## Phase 2: Code Migration

- [ ] Move `src/effect/*` from `sdk` to `sdk-effect/src`.
- [ ] Refactor `http.ts` in `sdk-effect` to be completely independent of `sdk/src/client`.
- [ ] Remove `effect` dependencies from `packages/sdk/package.json`.
- [ ] Clean up `packages/sdk/src/effect` (delete directory).
- [ ] Update `packages/sdk/src/client.ts` to remove the `.effect` property.

## Phase 3: Optimization & Polish

- [ ] Implement `Effect.withSpan` for all resource methods for observability.
- [ ] Add `Config` provider for global API keys.
- [ ] Implement `Stream` support for `list` methods (for effortless pagination).
- [ ] Update `sdk-effect` tests and ensure they pass in the new location.

## Phase 4: Documentation

- [ ] Create `packages/sdk-effect/README.md`.
- [ ] Update `packages/sdk/README.md` to point to the new package.

## Verification

- [ ] `bun run build` in both packages.
- [ ] `bun test` in both packages.
- [ ] Zero-dependency check for `@payark/sdk`.
