"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SaveCardSetupForm } from "@/components/public/save-card-setup-form";
import { CardPaymentForm } from "@/components/worker/card-payment-form";

type BookingResponse = {
  jobId: string;
  customerId: string;
  accountCreated: boolean;
  accountStatus: "created" | "existing" | "not_requested";
  setupIntentClientSecret: string | null;
  prepayClientSecret: string | null;
  prepayAmountCents: number | null;
  prepayStatus: "succeeded_saved_card" | "pending_confirmation" | null;
  stripeConfigured: boolean;
};

type AvailabilityResponse = {
  data: {
    date: string;
    workersConsidered: number;
    slots: {
      startIso: string;
      endIso: string;
      label: string;
      availableWorkerCount: number;
    }[];
  };
};

type CustomerSessionResponse = {
  data: {
    account: {
      id: string;
      email: string;
      customerId: string;
      customer: {
        id: string;
        name: string;
        email: string | null;
        phoneE164: string;
        paymentMethods: {
          id: string;
          brand: string | null;
          last4: string | null;
          isDefault: boolean;
        }[];
      };
    } | null;
  };
};

type CustomerAccount = NonNullable<CustomerSessionResponse["data"]["account"]>;

export function AppointmentBookingForm({
  initialAccount = null,
}: {
  initialAccount?: CustomerAccount | null;
}) {
  const router = useRouter();
  const DEFAULT_APPOINTMENT_DURATION_MINUTES = 120;
  const [name, setName] = useState(initialAccount?.customer.name || "");
  const [phone, setPhone] = useState(initialAccount?.customer.phoneE164 || "");
  const [email, setEmail] = useState(initialAccount?.customer.email || initialAccount?.email || "");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [prepayNow, setPrepayNow] = useState(false);
  const [prepayMode, setPrepayMode] = useState<"none" | "full" | "deposit">("none");
  const [prepayAmount, setPrepayAmount] = useState("");
  const [prepayUseSavedCard, setPrepayUseSavedCard] = useState(
    (initialAccount?.customer.paymentMethods.length || 0) > 0,
  );
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [saveCardOnFile, setSaveCardOnFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<BookingResponse | null>(null);
  const [signedInCustomer, setSignedInCustomer] = useState<CustomerAccount | null>(initialAccount);
  const [availabilityDate, setAvailabilityDate] = useState("");
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilitySlots, setAvailabilitySlots] = useState<
    {
      startIso: string;
      endIso: string;
      label: string;
      availableWorkerCount: number;
    }[]
  >([]);

  useEffect(() => {
    if (initialAccount) {
      return;
    }

    let cancelled = false;

    async function loadSignedInCustomer() {
      try {
        const response = await fetch("/api/customer/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        const json = (await response.json()) as CustomerSessionResponse;
        if (!response.ok || !json.data.account || cancelled) {
          return;
        }

        setSignedInCustomer(json.data.account);
        setName((current) => current || json.data.account!.customer.name || "");
        setPhone((current) => current || json.data.account!.customer.phoneE164 || "");
        setEmail(
          (current) =>
            current || json.data.account!.customer.email || json.data.account!.email || "",
        );
        if (json.data.account!.customer.paymentMethods.length > 0) {
          setPrepayUseSavedCard(true);
        }
        setCreateAccount(false);
      } catch {
        // Keep guest mode if session lookup fails.
      }
    }

    void loadSignedInCustomer();

    return () => {
      cancelled = true;
    };
  }, [initialAccount]);

  const amountCents = useMemo(() => {
    const parsed = Number.parseFloat(amount || "0");
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.round(parsed * 100);
  }, [amount]);

  function extractApiErrorMessage(payload: unknown): string {
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object"
    ) {
      const errorObj = payload.error as {
        message?: unknown;
        details?: {
          fieldErrors?: Record<string, string[]>;
          formErrors?: string[];
        };
      };

      const fieldErrors = errorObj.details?.fieldErrors;
      if (fieldErrors) {
        const firstField = Object.keys(fieldErrors)[0];
        const firstFieldMessage = firstField ? fieldErrors[firstField]?.[0] : null;
        if (firstFieldMessage) {
          return firstFieldMessage;
        }
      }

      const formError = errorObj.details?.formErrors?.[0];
      if (formError) {
        return formError;
      }

      if (typeof errorObj.message === "string" && errorObj.message.trim()) {
        return errorObj.message;
      }
    }

    return "Unable to schedule appointment";
  }

  function toDateTimeLocalValue(date: Date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  async function loadAvailabilityForDate(dateOnly: string) {
    if (!dateOnly) {
      setAvailabilitySlots([]);
      setAvailabilityError(null);
      return;
    }

    setLoadingAvailability(true);
    setAvailabilityError(null);

    try {
      const params = new URLSearchParams();
      params.set("date", dateOnly);
      if (state.trim()) {
        params.set("state", state.trim());
      }
      params.set("durationMinutes", String(DEFAULT_APPOINTMENT_DURATION_MINUTES));

      const response = await fetch(`/api/public/availability?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as AvailabilityResponse;

      if (!response.ok) {
        setAvailabilityError((json as any)?.error?.message || "Unable to load availability");
        setAvailabilitySlots([]);
        return;
      }

      setAvailabilitySlots(json.data.slots);
      if (!json.data.slots.length) {
        setAvailabilityError("No available slots for that date. Try another day.");
      }
    } catch {
      setAvailabilityError("Unable to load availability right now.");
      setAvailabilitySlots([]);
    } finally {
      setLoadingAvailability(false);
    }
  }

  function redirectToPortalIfSignedIn() {
    if (!signedInCustomer) {
      return;
    }

    router.replace("/customer/portal");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setBookingResult(null);

    if (!scheduledStart) {
      setSubmitting(false);
      setError("Please select a start date and time.");
      return;
    }
    const startDate = new Date(scheduledStart);
    if (Number.isNaN(startDate.getTime())) {
      setSubmitting(false);
      setError("Invalid start date/time.");
      return;
    }

    if (prepayNow && prepayMode === "deposit") {
      const depositCents = Math.round(Number.parseFloat(prepayAmount || "0") * 100);
      if (!Number.isFinite(depositCents) || depositCents <= 0) {
        setSubmitting(false);
        setError("Enter a valid deposit amount.");
        return;
      }
    }

    try {
      const response = await fetch("/api/public/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          email,
          street,
          city,
          state,
          zip,
          scheduledStart: startDate.toISOString(),
          estimatedDurationMinutes: DEFAULT_APPOINTMENT_DURATION_MINUTES,
          amountDueCents: amountCents,
          prepayNow,
          prepayMode: prepayNow ? (prepayMode === "none" ? "full" : prepayMode) : "none",
          prepayUseSavedCard: prepayNow ? prepayUseSavedCard : false,
          prepayAmountCents:
            prepayNow && prepayMode === "deposit"
              ? Math.round(Number.parseFloat(prepayAmount || "0") * 100)
              : undefined,
          notes,
          createAccount,
          password: createAccount ? password : undefined,
          saveCardOnFile,
        }),
      });

      const raw = await response.text();
      let json: unknown = null;
      if (raw) {
        try {
          json = JSON.parse(raw) as unknown;
        } catch {
          json = null;
        }
      }

      if (!response.ok) {
        setError(extractApiErrorMessage(json));
        return;
      }

      const data = (json as { data: BookingResponse }).data;
      setBookingResult(data);

      if (data.prepayStatus === "succeeded_saved_card") {
        setSuccess("Appointment created and prepaid with your saved card. Returning to portal...");
        if (!data.setupIntentClientSecret) {
          redirectToPortalIfSignedIn();
        }
        return;
      }

      if (data.prepayClientSecret && data.setupIntentClientSecret) {
        setSuccess("Appointment created. Complete card payment and optional card-on-file setup below.");
        return;
      }

      if (data.prepayClientSecret) {
        setSuccess("Appointment created. Complete prepayment below.");
        return;
      }

      if (data.setupIntentClientSecret) {
        if (data.accountStatus === "created") {
          setSuccess("Appointment booked and account created. Complete card save below.");
          return;
        }
        if (data.accountStatus === "existing") {
          setSuccess(
            "Appointment booked. An account already exists for this email, so your existing login stays active. Complete card save below.",
          );
          return;
        }
        setSuccess("Appointment created. Complete card save below.");
        return;
      }

      if (data.accountStatus === "created") {
        setSuccess("Appointment scheduled. Customer account created. You can now sign in.");
        return;
      }

      if (data.accountStatus === "existing") {
        if (signedInCustomer) {
          setSuccess("Appointment scheduled. Returning to your portal...");
          redirectToPortalIfSignedIn();
          return;
        }

        setSuccess("Appointment scheduled. Account already exists for this email, so no new account was created.");
        return;
      }

      if (signedInCustomer) {
        setSuccess("Appointment scheduled successfully. Returning to your portal...");
        redirectToPortalIfSignedIn();
        return;
      }

      setSuccess("Appointment scheduled successfully.");
    } catch {
      setError("Network error while scheduling appointment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Schedule Appointment</h2>
        <p className="mt-1 text-sm text-slate-600">
          Book window service as guest or create an account.
        </p>
        <form className="mt-4 grid gap-2" onSubmit={(event) => void onSubmit(event)}>
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            placeholder="Full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            placeholder="Phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
          <input
            type="email"
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            placeholder="Street"
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            required
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="min-h-11 rounded-xl border border-slate-300 px-3"
              placeholder="City"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              required
            />
            <input
              className="min-h-11 rounded-xl border border-slate-300 px-3"
              placeholder="State"
              value={state}
              onChange={(event) => setState(event.target.value)}
              required
            />
            <input
              className="min-h-11 rounded-xl border border-slate-300 px-3"
              placeholder="ZIP"
              value={zip}
              onChange={(event) => setZip(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-semibold text-slate-700" htmlFor="scheduledStart">
              Appointment Start Time
            </label>
            <input
              id="scheduledStart"
              type="datetime-local"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
              value={scheduledStart}
              onChange={(event) => setScheduledStart(event.target.value)}
              required
            />
            <p className="text-xs text-slate-500">
              Pick your preferred start date and time.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                type="date"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
                value={availabilityDate}
                onChange={(event) => setAvailabilityDate(event.target.value)}
              />
              <button
                type="button"
                onClick={() => void loadAvailabilityForDate(availabilityDate)}
                disabled={!availabilityDate || loadingAvailability}
                className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800 disabled:bg-slate-100"
              >
                {loadingAvailability ? "Checking..." : "Find Open Slots"}
              </button>
            </div>
            {availabilitySlots.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {availabilitySlots.map((slot) => (
                  <button
                    key={slot.startIso}
                    type="button"
                    onClick={() => setScheduledStart(toDateTimeLocalValue(new Date(slot.startIso)))}
                    className="min-h-11 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900"
                  >
                    {slot.label} ({slot.availableWorkerCount} worker
                    {slot.availableWorkerCount > 1 ? "s" : ""})
                  </button>
                ))}
              </div>
            ) : null}
            {availabilityError ? (
              <p className="mt-1 text-xs text-amber-800">{availabilityError}</p>
            ) : null}
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-semibold text-slate-700" htmlFor="amount">
              Estimated Price (USD, optional)
            </label>
            <input
              id="amount"
              type="number"
              min={0}
              step="0.01"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
              placeholder="e.g. 225.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <textarea
            className="min-h-24 rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Notes / access instructions"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          <label
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
            htmlFor="prepayNow"
          >
            <input
              id="prepayNow"
              type="checkbox"
              className="h-5 w-5"
              checked={prepayNow}
              onChange={(event) => {
                const checked = event.target.checked;
                setPrepayNow(checked);
                setPrepayMode(checked ? (prepayMode === "none" ? "full" : prepayMode) : "none");
              }}
            />
            Pay now by card
          </label>
          <p className="text-xs text-slate-500">
            If selected, choose full prepay or a deposit right after booking.
          </p>
          {prepayNow ? (
            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">Prepay Type</p>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="prepayMode"
                  value="full"
                  checked={prepayMode === "full"}
                  onChange={() => setPrepayMode("full")}
                />
                Full estimated amount
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="prepayMode"
                  value="deposit"
                  checked={prepayMode === "deposit"}
                  onChange={() => setPrepayMode("deposit")}
                />
                Deposit now
              </label>
              {prepayMode === "deposit" ? (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="min-h-11 rounded-xl border border-slate-300 px-3"
                  placeholder="Deposit amount (USD)"
                  value={prepayAmount}
                  onChange={(event) => setPrepayAmount(event.target.value)}
                  required
                />
              ) : null}
            </div>
          ) : null}
          {signedInCustomer && signedInCustomer.customer.paymentMethods.length > 0 ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-800">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={prepayUseSavedCard}
                onChange={(event) => setPrepayUseSavedCard(event.target.checked)}
                disabled={!prepayNow}
              />
              Use saved card on file
              {" "}
              (
              {(() => {
                const defaultCard =
                  signedInCustomer.customer.paymentMethods.find((method) => method.isDefault) ||
                  signedInCustomer.customer.paymentMethods[0];
                return `${(defaultCard?.brand || "card").toUpperCase()} ****${defaultCard?.last4 || "----"}`;
              })()}
              )
            </label>
          ) : null}

          {signedInCustomer ? (
            <p className="text-xs text-emerald-800">
              Signed in as {signedInCustomer.customer.name} ({signedInCustomer.email}). This
              booking will use your customer account.
            </p>
          ) : (
            <>
              <p className="text-xs text-amber-800">
                Customer session not detected on this URL. Sign in at /customer/login to autofill
                profile and use saved-card prepay.
              </p>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={createAccount}
                  onChange={(event) => setCreateAccount(event.target.checked)}
                />
                Create customer account
              </label>
              {createAccount ? (
                <input
                  type="password"
                  className="min-h-11 rounded-xl border border-slate-300 px-3"
                  placeholder="Account password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                />
              ) : null}
            </>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={saveCardOnFile}
              onChange={(event) => setSaveCardOnFile(event.target.checked)}
            />
            Save card on file for future billing
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
          >
            {submitting ? "Scheduling..." : "Schedule Appointment"}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}
      </section>

      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Pay Now</h3>
          <p className="mt-1 text-sm text-slate-600">
            If you selected prepayment, complete secure payment below.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Step 1: check &quot;Pay now by card&quot; in the booking form. Step 2: submit the
            appointment. Step 3: complete card payment here.
          </p>

          {bookingResult?.prepayClientSecret ? (
            <div className="mt-4 space-y-2">
              {typeof bookingResult.prepayAmountCents === "number" ? (
                <p className="text-sm font-semibold text-slate-900">
                  Prepay amount: ${(bookingResult.prepayAmountCents / 100).toFixed(2)}
                </p>
              ) : null}
              <CardPaymentForm
                clientSecret={bookingResult.prepayClientSecret}
                onSuccess={() => {
                  setSuccess("Prepayment submitted. Returning to your portal...");
                  redirectToPortalIfSignedIn();
                }}
              />
            </div>
          ) : bookingResult?.prepayStatus === "succeeded_saved_card" ? (
            <p className="mt-4 text-sm text-emerald-700">
              Prepayment completed successfully using the saved card on file.
            </p>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              Select &quot;Pay now by card&quot; before booking to prepay this appointment.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Saved Card Setup</h3>
          <p className="mt-1 text-sm text-slate-600">
            If card-on-file was selected, complete secure card setup below.
          </p>

          {bookingResult?.setupIntentClientSecret ? (
            <div className="mt-4">
              <SaveCardSetupForm
                clientSecret={bookingResult.setupIntentClientSecret}
                onSuccess={() => {
                  setSuccess("Card saved successfully. Returning to your portal...");
                  redirectToPortalIfSignedIn();
                }}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              Submit an appointment with &quot;Save card on file&quot; checked to show secure card
              capture.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
