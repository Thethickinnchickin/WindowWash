"use client";

import { FormEvent, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function SaveCardInner({
  onSuccess,
  clientSecret,
  setupIntentIdFromClientSecret,
}: {
  onSuccess: () => void;
  clientSecret: string;
  setupIntentIdFromClientSecret: string | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finalizeSetupIntent(setupIntentId: string) {
    const response = await fetch("/api/public/setup-intent/finalize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        setupIntentId,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error?.message || "Could not finalize saved card");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const existingIntent = await stripe.retrieveSetupIntent(clientSecret);
    if (existingIntent.setupIntent?.status === "succeeded") {
      const setupIntentId = existingIntent.setupIntent.id || setupIntentIdFromClientSecret;
      if (!setupIntentId) {
        setSubmitting(false);
        setError("Card was confirmed, but setup intent id was missing.");
        return;
      }

      try {
        await finalizeSetupIntent(setupIntentId);
        setSubmitting(false);
        onSuccess();
        return;
      } catch (finalizeError) {
        setSubmitting(false);
        setError(
          finalizeError instanceof Error
            ? finalizeError.message
            : "Failed to save card in customer profile",
        );
        return;
      }
    }

    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    setSubmitting(false);

    if (result.error) {
      const maybeDuplicateSuccess =
        result.error.code === "setup_intent_unexpected_state" ||
        result.error.message?.toLowerCase().includes("already succeeded");

      if (maybeDuplicateSuccess) {
        if (!setupIntentIdFromClientSecret) {
          setError("Card was confirmed, but setup intent id was missing.");
          return;
        }

        try {
          await finalizeSetupIntent(setupIntentIdFromClientSecret);
          onSuccess();
        } catch (finalizeError) {
          setError(
            finalizeError instanceof Error
              ? finalizeError.message
              : "Failed to save card in customer profile",
          );
        }
        return;
      }

      setError(result.error.message || "Failed to save card");
      return;
    }

    const setupIntentId = result.setupIntent?.id || setupIntentIdFromClientSecret;
    if (!setupIntentId) {
      setError("Card was confirmed, but setup intent id was missing.");
      return;
    }

    try {
      await finalizeSetupIntent(setupIntentId);
      onSuccess();
    } catch (finalizeError) {
      setError(
        finalizeError instanceof Error
          ? finalizeError.message
          : "Failed to save card in customer profile",
      );
    }
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <PaymentElement />
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting || !stripe || !elements}
        className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
      >
        {submitting ? "Saving card..." : "Save Card on File"}
      </button>
    </form>
  );
}

export function SaveCardSetupForm({
  clientSecret,
  onSuccess,
}: {
  clientSecret: string;
  onSuccess: () => void;
}) {
  const setupIntentIdFromClientSecret = useMemo(() => {
    const split = clientSecret.split("_secret_");
    return split.length > 1 ? split[0] : null;
  }, [clientSecret]);

  if (!stripePromise) {
    return (
      <p className="text-sm text-amber-700">
        Stripe publishable key missing. Cannot collect card details.
      </p>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <SaveCardInner
        onSuccess={onSuccess}
        clientSecret={clientSecret}
        setupIntentIdFromClientSecret={setupIntentIdFromClientSecret}
      />
    </Elements>
  );
}
