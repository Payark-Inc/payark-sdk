import { CheckoutEffect } from "./resources/checkout";
import { PaymentsEffect } from "./resources/payments";
import { ProjectsEffect } from "./resources/projects";
import type { PayArkConfig } from "../types";

/**
 * Main entry point for the Effect-based PayArk API.
 */
export class PayArkEffect {
  private _checkout?: CheckoutEffect;
  private _payments?: PaymentsEffect;
  private _projects?: ProjectsEffect;

  constructor(private readonly config: PayArkConfig) {}

  /**
   * Checkout sessions resource (Effect).
   */
  get checkout(): CheckoutEffect {
    if (!this._checkout) {
      this._checkout = new CheckoutEffect(this.config);
    }
    return this._checkout;
  }

  /**
   * Payments resource (Effect).
   */
  get payments(): PaymentsEffect {
    if (!this._payments) {
      this._payments = new PaymentsEffect(this.config);
    }
    return this._payments;
  }

  /**
   * Projects resource (Effect).
   */
  get projects(): ProjectsEffect {
    if (!this._projects) {
      this._projects = new ProjectsEffect(this.config);
    }
    return this._projects;
  }
}

export { PayArkEffectError } from "./errors";
export * from "./schemas";
