import { Customer } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";

export async function ensureStripeCustomer(customer: Pick<Customer, "id" | "name" | "email" | "phoneE164" | "stripeCustomerId">) {
  if (customer.stripeCustomerId) {
    return customer.stripeCustomerId;
  }

  const stripe = requireStripe();
  const created = await stripe.customers.create({
    name: customer.name,
    email: customer.email || undefined,
    phone: customer.phoneE164,
    metadata: {
      localCustomerId: customer.id,
    },
  });

  await prisma.customer.update({
    where: { id: customer.id },
    data: { stripeCustomerId: created.id },
  });

  return created.id;
}

export async function storeCardOnFileFromStripe(params: {
  customerId: string;
  stripePaymentMethodId: string;
  isDefault?: boolean;
}) {
  const stripe = requireStripe();
  const paymentMethod = await stripe.paymentMethods.retrieve(params.stripePaymentMethodId);

  if (paymentMethod.type !== "card") {
    return null;
  }

  const card = paymentMethod.card;

  if (!card) {
    return null;
  }

  const isDefault = Boolean(params.isDefault);

  if (isDefault) {
    await prisma.customerPaymentMethod.updateMany({
      where: { customerId: params.customerId },
      data: { isDefault: false },
    });
  }

  return prisma.customerPaymentMethod.upsert({
    where: {
      stripePaymentMethodId: params.stripePaymentMethodId,
    },
    create: {
      customerId: params.customerId,
      stripePaymentMethodId: params.stripePaymentMethodId,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      isDefault,
    },
    update: {
      brand: card.brand,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      isDefault,
    },
  });
}
