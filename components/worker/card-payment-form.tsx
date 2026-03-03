"use client";

import { FormEvent, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function CardPaymentInner({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message || "Payment failed");
      return;
    }

    onSuccess();
  };

  return (
    <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
      <div className="rounded-xl border border-slate-200 p-3">
        <PaymentElement />
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting || !stripe || !elements}
        className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
      >
        {submitting ? "Processing..." : "Submit Card Payment"}
      </button>
    </form>
  );
}

export function CardPaymentForm({
  clientSecret,
  onSuccess,
}: {
  clientSecret: string;
  onSuccess: () => void;
}) {
  if (!stripePromise) {
    return (
      <p className="text-sm text-amber-700">
        Missing `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Card form is unavailable.
      </p>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CardPaymentInner onSuccess={onSuccess} />
    </Elements>
  );
}
