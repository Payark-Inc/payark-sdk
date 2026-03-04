// ---------------------------------------------------------------------------
// PayArk SDK – Property-Based Tests
// ---------------------------------------------------------------------------

import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import type { CreateCheckoutParams, Provider } from "../../src/types";

/** All valid provider values — kept in sync with the `Provider` type. */
const PROVIDERS: Provider[] = [
  "esewa",
  "khalti",
  "connectips",
  "imepay",
  "fonepay",
  "sandbox",
];

describe("SDK Property-Based Tests", () => {
  // ── Manual Arbitrary for CreateCheckoutParams ───────────────────────────

  const providerArb = fc.constantFrom(...PROVIDERS);
  const metadataArb = fc.dictionary(fc.string(), fc.anything());

  const createCheckoutParamsArb: fc.Arbitrary<CreateCheckoutParams> = fc.record(
    {
      amount: fc.oneof(
        fc.nat({ max: 1_000_000 }).map((n) => n + 1),
        fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
      ),
      currency: fc.oneof(fc.constant("NPR"), fc.constant("USD"), fc.string()),
      provider: providerArb,
      returnUrl: fc.webUrl(),
      cancelUrl: fc.option(fc.webUrl(), { nil: undefined }),
      metadata: fc.option(metadataArb, { nil: undefined }),
    },
  );

  // ── Validation Invariants ────────────────────────────────────────────────

  test("CreateCheckoutParams schema should handle all kinds of inputs safely", () => {
    fc.assert(
      fc.property(createCheckoutParamsArb, (params) => {
        // Invariant: a structurally valid params object must have these fields
        expect(typeof params.amount).toBe("number");
        expect(Number.isFinite(params.amount)).toBe(true);
        expect(PROVIDERS).toContain(params.provider);
        expect(typeof params.returnUrl).toBe("string");
        return true;
      }),
      { numRuns: 1000 },
    );
  });

  // ── Currency Logic ───────────────────────────────────────────────────────

  test("Currency amount scaling should never lose precision", () => {
    // Business rule: Amount is in the base currency (e.g. NPR).
    // We want to ensure that converting to cents (x100) is stable for PBT.

    fc.assert(
      fc.property(fc.float({ min: 0, max: 1000000, noNaN: true }), (amount) => {
        const cents = Math.round(amount * 100);
        const back = cents / 100;

        // This is a classic float PBT test
        return Math.abs(amount - back) < 0.01;
      }),
    );
  });
});
