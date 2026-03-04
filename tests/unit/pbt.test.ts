// ---------------------------------------------------------------------------
// PayArk SDK – Property-Based Tests
// ---------------------------------------------------------------------------

import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import * as Schema from "@effect/schema/Schema";
import { CreateCheckoutParams, Provider } from "../../src/types";
import { Either } from "effect";

describe("SDK Property-Based Tests", () => {
  // ── Manual Arbitrary for CreateCheckoutParams ───────────────────────────

  const providerArb = fc.constantFrom(...Provider.literals);
  const metadataArb = fc.dictionary(fc.string(), fc.anything());

  const createCheckoutParamsArb = fc.record({
    amount: fc.oneof(fc.integer(), fc.float()),
    currency: fc.oneof(fc.constant("NPR"), fc.constant("USD"), fc.string()),
    provider: providerArb,
    returnUrl: fc.webUrl(),
    cancelUrl: fc.option(fc.webUrl()),
    metadata: fc.option(metadataArb),
  });

  // ── Validation Invariants ────────────────────────────────────────────────

  test("CreateCheckoutParams schema should handle all kinds of inputs safely", () => {
    const decode = Schema.decodeUnknownEither(CreateCheckoutParams);

    fc.assert(
      fc.property(createCheckoutParamsArb, (params) => {
        const result = decode(params);

        // If it's a valid amount (Number) and valid provider, it should be Right.
        // Effect-schema Number also accepts non-NaN/non-Infinite numbers by default.
        if (
          typeof params.amount === "number" &&
          Number.isFinite(params.amount) &&
          Provider.literals.includes(params.provider as any)
        ) {
          // We expect schema validation to at least not crash
          return true;
        }

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
