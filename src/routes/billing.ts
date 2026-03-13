import express, { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-02-25.clover" })
  : null;

const STRIPE_PRICES: Record<
  string,
  { monthly: string; annual: string; amount: number }
> = {
  starter: { monthly: "price_FREE", annual: "price_FREE", amount: 0 },
  hobby: {
    monthly: "price_hobby_monthly_REPLACE",
    annual: "price_hobby_annual_REPLACE",
    amount: 49,
  },
  team: {
    monthly: "price_team_monthly_REPLACE",
    annual: "price_team_annual_REPLACE",
    amount: 199,
  },
  enterprise: {
    monthly: "price_enterprise_monthly_REPLACE",
    annual: "price_enterprise_annual_REPLACE",
    amount: 599,
  },
};

function getSubscriptionPeriod(subscription: Stripe.Subscription): {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
} {
  const currentItem = subscription.items.data[0];

  return {
    currentPeriodStart: currentItem?.current_period_start
      ? new Date(currentItem.current_period_start * 1000)
      : null,
    currentPeriodEnd: currentItem?.current_period_end
      ? new Date(currentItem.current_period_end * 1000)
      : null,
  };
}

function getInvoicePaymentIntent(
  invoice: Stripe.Invoice | null,
): Stripe.PaymentIntent | null {
  const intent = invoice?.payments?.data[0]?.payment?.payment_intent;
  return intent && typeof intent !== "string" ? intent : null;
}

function ensureStripe(res: Response): Stripe | null {
  if (!stripe) {
    res.status(500).json({ error: "Stripe is not configured" });
    return null;
  }
  return stripe;
}

router.post(
  "/create-customer",
  requireAuth,
  async (req: Request, res: Response) => {
    const stripeClient = ensureStripe(res);
    if (!stripeClient) return;

    try {
      const authUser = (req as AuthRequest).user!;
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          stripeCustomerId: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.stripeCustomerId) {
        return res.json({ customerId: user.stripeCustomerId });
      }

      const customer = await stripeClient.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        metadata: { advanciaUserId: user.id },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      });

      return res.json({ customerId: customer.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: message });
    }
  },
);

router.post(
  "/create-setup-intent",
  requireAuth,
  async (req: Request, res: Response) => {
    const stripeClient = ensureStripe(res);
    if (!stripeClient) return;

    try {
      const { customerId } = req.body as { customerId?: string };
      if (!customerId) {
        return res.status(400).json({ error: "customerId is required" });
      }

      const setupIntent = await stripeClient.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
      });

      return res.json({ clientSecret: setupIntent.client_secret });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: message });
    }
  },
);

router.post("/upgrade", requireAuth, async (req: Request, res: Response) => {
  const stripeClient = ensureStripe(res);
  if (!stripeClient) return;

  try {
    const authUser = (req as AuthRequest).user!;
    const { customerId, planId, billingInterval, paymentMethodId } =
      req.body as {
        customerId?: string;
        planId?: string;
        billingInterval?: "monthly" | "annual";
        paymentMethodId?: string;
      };

    if (!customerId || !planId || !billingInterval) {
      return res
        .status(400)
        .json({ error: "customerId, planId and billingInterval are required" });
    }

    const priceConfig = STRIPE_PRICES[planId];
    if (!priceConfig) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const priceId =
      billingInterval === "annual" ? priceConfig.annual : priceConfig.monthly;

    if (paymentMethodId) {
      await stripeClient.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      await stripeClient.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    const existingSub = await prisma.subscription.findUnique({
      where: { userId: authUser.id },
    });
    let subscription: Stripe.Subscription;

    if (existingSub?.stripeSubscriptionId) {
      const existingStripeSub = await stripeClient.subscriptions.retrieve(
        existingSub.stripeSubscriptionId,
      );
      subscription = await stripeClient.subscriptions.update(
        existingStripeSub.id,
        {
          items: [{ id: existingStripeSub.items.data[0].id, price: priceId }],
          proration_behavior: "always_invoice",
          payment_behavior: "default_incomplete",
          expand: ["latest_invoice.payment_intent"],
        },
      );
    } else {
      subscription = await stripeClient.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        proration_behavior: "always_invoice",
        expand: ["latest_invoice.payment_intent"],
      });
    }

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
    const paymentIntent = getInvoicePaymentIntent(latestInvoice);
    const { currentPeriodStart, currentPeriodEnd } =
      getSubscriptionPeriod(subscription);

    await prisma.subscription.upsert({
      where: { userId: authUser.id },
      create: {
        userId: authUser.id,
        planId,
        billingInterval,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        status: subscription.status,
        currentPeriodStart,
        currentPeriodEnd,
        amount: priceConfig.amount,
      },
      update: {
        planId,
        billingInterval,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        status: subscription.status,
        amount: priceConfig.amount,
        currentPeriodStart,
        currentPeriodEnd,
      },
    });

    await prisma.billingTransaction.create({
      data: {
        userId: authUser.id,
        type: "subscription_upgrade",
        description: `Plan upgrade to ${planId} (${billingInterval})`,
        amount: paymentIntent?.amount ? paymentIntent.amount / 100 : 0,
        currency: "usd",
        status: paymentIntent?.status || "succeeded",
        stripePaymentIntentId: paymentIntent?.id,
        stripeSubscriptionId: subscription.id,
      },
    });

    return res.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret:
        paymentIntent?.client_secret ??
        latestInvoice?.confirmation_secret?.client_secret ??
        null,
      requiresAction: paymentIntent?.status === "requires_action",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

router.post("/cancel", requireAuth, async (req: Request, res: Response) => {
  const stripeClient = ensureStripe(res);
  if (!stripeClient) return;

  try {
    const authUser = (req as AuthRequest).user!;
    const sub = await prisma.subscription.findUnique({
      where: { userId: authUser.id },
    });

    if (!sub?.stripeSubscriptionId) {
      return res.status(404).json({ error: "No subscription found" });
    }

    const cancelled = await stripeClient.subscriptions.update(
      sub.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      },
    );

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: true, status: "canceling" },
    });

    return res.json({
      message: "Subscription will cancel at period end",
      cancelAt: cancelled.cancel_at
        ? new Date(cancelled.cancel_at * 1000)
        : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

router.get(
  "/status/:userId",
  requireAuth,
  async (req: Request, res: Response) => {
    const stripeClient = ensureStripe(res);
    if (!stripeClient) return;

    try {
      const authUser = (req as AuthRequest).user!;
      const userId = req.params.userId as string;

      if (authUser.id !== userId && !["admin", "cfo"].includes(authUser.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const [sub, user, txns] = await Promise.all([
        prisma.subscription.findUnique({ where: { userId } }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { stripeCustomerId: true },
        }),
        prisma.billingTransaction.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ]);

      let paymentMethods: Array<Record<string, unknown>> = [];
      let nextInvoice: Record<string, unknown> | null = null;

      if (user?.stripeCustomerId) {
        const [pmList, upcoming] = await Promise.all([
          stripeClient.paymentMethods.list({
            customer: user.stripeCustomerId,
            type: "card",
          }),
          sub?.stripeSubscriptionId
            ? stripeClient.invoices
                .createPreview({
                  customer: user.stripeCustomerId,
                  subscription: sub.stripeSubscriptionId,
                })
                .catch(() => null)
            : Promise.resolve(null),
        ]);

        paymentMethods = pmList.data.map((pm) => ({
          id: pm.id,
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          expMonth: pm.card?.exp_month,
          expYear: pm.card?.exp_year,
          isDefault: pm.id === pmList.data[0]?.id,
        }));

        nextInvoice = upcoming
          ? {
              amount: upcoming.amount_due / 100,
              date: upcoming.next_payment_attempt
                ? new Date(upcoming.next_payment_attempt * 1000)
                : null,
            }
          : null;
      }

      return res.json({
        plan: sub?.planId || "starter",
        status: sub?.status || "inactive",
        billingInterval: sub?.billingInterval || "monthly",
        currentPeriodEnd: sub?.currentPeriodEnd,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd || false,
        nextInvoice,
        paymentMethods,
        transactions: txns,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: message });
    }
  },
);

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const stripeClient = ensureStripe(res);
    if (!stripeClient) return;

    const sig = req.headers["stripe-signature"] as string | undefined;
    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(400).send("Missing Stripe webhook configuration");
    }

    let event: Stripe.Event;
    try {
      event = stripeClient.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(400).send(`Webhook Error: ${message}`);
    }

    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const paymentIntent = getInvoicePaymentIntent(invoice);
        await prisma.billingTransaction.updateMany({
          where: {
            stripePaymentIntentId: paymentIntent?.id || undefined,
          },
          data: { status: "succeeded" },
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (user) {
          await prisma.subscription.updateMany({
            where: { userId: user.id },
            data: { status: "past_due" },
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: "cancelled", planId: "starter" },
        });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const { currentPeriodStart, currentPeriodEnd } =
          getSubscriptionPeriod(sub);
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status: sub.status,
            currentPeriodStart,
            currentPeriodEnd,
          },
        });
        break;
      }
      default:
        break;
    }

    return res.json({ received: true });
  },
);

router.post(
  "/add-payment-method",
  requireAuth,
  async (req: Request, res: Response) => {
    const stripeClient = ensureStripe(res);
    if (!stripeClient) return;

    try {
      const {
        customerId,
        paymentMethodId,
        setDefault = true,
      } = req.body as {
        customerId?: string;
        paymentMethodId?: string;
        setDefault?: boolean;
      };

      if (!customerId || !paymentMethodId) {
        return res
          .status(400)
          .json({ error: "customerId and paymentMethodId are required" });
      }

      await stripeClient.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      if (setDefault) {
        await stripeClient.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
      }

      const pm = await stripeClient.paymentMethods.retrieve(paymentMethodId);
      if (!("card" in pm) || !pm.card) {
        return res.status(400).json({ error: "Invalid payment method" });
      }

      return res.json({
        id: pm.id,
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: message });
    }
  },
);

router.delete(
  "/payment-method/:pmId",
  requireAuth,
  async (req: Request, res: Response) => {
    const stripeClient = ensureStripe(res);
    if (!stripeClient) return;

    try {
      const pmId = req.params.pmId as string;
      await stripeClient.paymentMethods.detach(pmId);
      return res.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: message });
    }
  },
);

export default router;
