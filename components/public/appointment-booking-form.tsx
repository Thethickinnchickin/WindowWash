"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calculateWindowWashEstimate,
  formatCents,
} from "@/lib/pricing";

type BookingResponse = {
  jobId: string;
  customerId: string;
  accountCreated: boolean;
  accountStatus: "created" | "existing" | "not_requested";
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
        };
      } | null;
  };
};

type CustomerAccount = NonNullable<CustomerSessionResponse["data"]["account"]>;

function parseCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function AppointmentBookingForm({
  initialAccount = null,
}: {
  initialAccount?: CustomerAccount | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialAccount?.customer.name || "");
  const [phone, setPhone] = useState(initialAccount?.customer.phoneE164 || "");
  const [email, setEmail] = useState(initialAccount?.customer.email || initialAccount?.email || "");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("CA");
  const [zip, setZip] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [windowCount, setWindowCount] = useState("12");
  const [notes, setNotes] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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

  const pricingInput = useMemo(
    () => ({
      windowCount: parseCount(windowCount),
      city,
      state,
      zip,
    }),
    [windowCount, city, state, zip],
  );
  const estimate = useMemo(() => calculateWindowWashEstimate(pricingInput), [pricingInput]);

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
      params.set("durationMinutes", String(estimate.estimatedDurationMinutes));

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
          estimatedDurationMinutes: estimate.estimatedDurationMinutes,
          amountDueCents: estimate.totalCents,
          pricing: {
            windowCount: pricingInput.windowCount,
          },
          notes,
          createAccount,
          password: createAccount ? password : undefined,
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
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
        <h2 className="text-xl font-bold text-slate-900">Schedule Appointment</h2>
        <p className="mt-1 text-sm text-slate-600">
          Book window service as guest or create an account.
        </p>
        <form className="mt-4 grid gap-3" onSubmit={(event) => void onSubmit(event)}>
          <div className="grid gap-2 sm:grid-cols-2">
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
              className="min-h-11 rounded-xl border border-slate-300 px-3 sm:col-span-2"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
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

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-black uppercase text-slate-900">Window Count</p>
            <p className="mt-1 text-sm text-slate-600">$20 per window. Payment is handled after the job is completed.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <QuoteCountInput label="Windows" value={windowCount} onChange={setWindowCount} />
            </div>
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
          <textarea
            className="min-h-24 rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Notes / access instructions"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          {signedInCustomer ? (
            <p className="text-xs text-emerald-800">
              Signed in as {signedInCustomer.customer.name} ({signedInCustomer.email}). This
              booking will use your customer account.
            </p>
          ) : (
            <>
              <p className="text-xs text-amber-800">
                Customer session not detected on this URL. Sign in at /customer/login to autofill
                profile details.
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

          <button
            type="submit"
            disabled={submitting}
            className="neon-button min-h-11 rounded-xl px-4 py-2 text-sm font-black disabled:bg-slate-400 disabled:text-white"
          >
            {submitting ? "Scheduling..." : `Schedule Appointment - ${formatCents(estimate.totalCents)}`}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}
      </section>

      <div className="space-y-4 xl:sticky xl:top-6">
        <section className="rounded-2xl border border-cyan-300 bg-slate-950 p-4 text-white shadow-sm sm:p-5">
          <p className="text-xs font-black uppercase text-lime-300">Live Estimate</p>
          <p className="mt-2 text-4xl font-black">{formatCents(estimate.totalCents)}</p>
          <p className="mt-1 text-sm font-semibold text-cyan-100">
            {estimate.estimatedDurationMinutes} min service estimate. Payment is handled after completion.
          </p>
          <div className="mt-4 space-y-2 border-t border-white/15 pt-3">
            {estimate.lines.map((line) => (
              <div key={line.label} className="flex gap-3 text-sm">
                <span className="flex-1 text-cyan-50">{line.label}</span>
                <span className={line.amountCents < 0 ? "font-black text-lime-300" : "font-black text-white"}>
                  {line.amountCents < 0 ? "-" : ""}
                  {formatCents(Math.abs(line.amountCents))}
                </span>
              </div>
            ))}
          </div>
          {estimate.requiresReview ? (
            <div className="mt-4 rounded-xl border border-amber-300/50 bg-amber-300/10 p-3 text-xs text-amber-50">
              <p className="font-black uppercase">Needs confirmation</p>
              {estimate.reviewReasons.map((reason) => (
                <p key={reason} className="mt-1">
                  {reason}
                </p>
              ))}
            </div>
          ) : null}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-lg font-bold text-slate-900">Payment</h3>
          <p className="mt-1 text-sm text-slate-600">
            Payment is handled after the job is completed.
          </p>
        </section>
      </div>
    </div>
  );
}

function QuoteCountInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {label}
      <input
        type="number"
        min={0}
        max={300}
        className="min-h-11 rounded-xl border border-slate-300 px-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
