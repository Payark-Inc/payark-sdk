import { CheckoutEffect } from "./resources/checkout";

export class PayArkEffect {
  private _checkout?: CheckoutEffect;

  /**
   * Checkout sessions resource (Effect).
   */
  get checkout(): CheckoutEffect {
    if (!this._checkout) {
      this._checkout = new CheckoutEffect();
    }
    return this._checkout;
  }
}

export { PayArkEffectError } from "./errors";
export * from "./schemas";
