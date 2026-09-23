"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calculateWindowWashEstimate,
  formatCents,
} from "@/lib/pricing";
import { trackEvent } from "@/lib/analytics";

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
type AvailabilitySlot = AvailabilityResponse["data"]["slots"][number];

function parseCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateOnlyValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function fromDateOnlyValue(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateOnlyLabel(value: string) {
  const date = fromDateOnlyValue(value);
  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatAppointmentLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function AppointmentBookingForm({
  initialAccount = null,
}: {
  initialAccount?: CustomerAccount | null;
}) {
  const router = useRouter();
  const availabilityDateInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialAccount?.customer.name || "");
  const [phone, setPhone] = useState(initialAccount?.customer.phoneE164 || "");
  const [email, setEmail] = useState(initialAccount?.customer.email || initialAccount?.email || "");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("CA");
  const [zip, setZip] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [windowCount, setWindowCount] = useState("");
  const [gutterLinearFeet, setGutterLinearFeet] = useState("0");
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
      gutterLinearFeet: parseCount(gutterLinearFeet),
      city,
      state,
      zip,
    }),
    [windowCount, gutterLinearFeet, city, state, zip],
  );
  const estimate = useMemo(() => calculateWindowWashEstimate(pricingInput), [pricingInput]);
  const quickAvailabilityDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 10 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);

      return {
        value: toDateOnlyValue(date),
        label:
          index === 0
            ? "Today"
            : index === 1
              ? "Tomorrow"
              : new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
        dateLabel: new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
        }).format(date),
      };
    });
  }, []);
  const selectedAppointmentLabel = scheduledStart ? formatAppointmentLabel(scheduledStart) : null;

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

  function openAvailabilityCalendar() {
    const input = availabilityDateInputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    try {
      input.showPicker?.();
    } catch {
      // Some browsers only allow showPicker during direct user gestures.
    }
  }

  function handleAvailabilityDateChange(value: string) {
    if (value !== availabilityDate) {
      setScheduledStart("");
    }

    setAvailabilityDate(value);
    if (!value) {
      setAvailabilitySlots([]);
      setAvailabilityError(null);
      return;
    }

    void loadAvailabilityForDate(value);
  }

  function handleSlotSelect(slot: AvailabilitySlot) {
    const nextScheduledStart = toDateTimeLocalValue(new Date(slot.startIso));
    setScheduledStart(nextScheduledStart);
    trackEvent("booking_slot_selected", {
      event_category: "booking",
      workers_available: slot.availableWorkerCount,
      selected_date: availabilityDate,
    });
  }

  function handleFindOpenSlotsClick() {
    if (!availabilityDate) {
      setAvailabilityError(null);
      openAvailabilityCalendar();
      return;
    }

    void loadAvailabilityForDate(availabilityDate);
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
      trackEvent("find_open_slots", {
        event_category: "booking",
        available_slots: json.data.slots.length,
        duration_minutes: estimate.estimatedDurationMinutes,
        window_count: pricingInput.windowCount,
        gutter_linear_feet: pricingInput.gutterLinearFeet,
      });
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

    if (estimate.totalCents <= 0) {
      setSubmitting(false);
      setError("Enter at least one window or gutter footage amount.");
      return;
    }

    const startDate = new Date(scheduledStart);
    if (Number.isNaN(startDate.getTime())) {
      setSubmitting(false);
      setError("Invalid start date/time.");
      return;
    }

    try {
      trackEvent("booking_submit", {
        event_category: "booking",
        currency: "USD",
        value: estimate.totalCents / 100,
        window_count: pricingInput.windowCount,
        gutter_linear_feet: pricingInput.gutterLinearFeet,
        create_account: createAccount,
      });

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
            gutterLinearFeet: pricingInput.gutterLinearFeet,
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
        trackEvent("booking_error", {
          event_category: "booking",
          status_code: response.status,
        });
        setError(extractApiErrorMessage(json));
        return;
      }

      const data = (json as { data: BookingResponse }).data;
      trackEvent("booking_scheduled", {
        event_category: "booking",
        currency: "USD",
        value: estimate.totalCents / 100,
        account_status: data.accountStatus,
        window_count: pricingInput.windowCount,
        gutter_linear_feet: pricingInput.gutterLinearFeet,
      });

      if (data.accountStatus === "created") {
        router.replace("/book/confirmation");
        return;
      }

      if (data.accountStatus === "existing") {
        if (signedInCustomer) {
          setSuccess("Appointment scheduled. Returning to your portal...");
          redirectToPortalIfSignedIn();
          return;
        }

        router.replace("/book/confirmation");
        return;
      }

      if (signedInCustomer) {
        setSuccess("Appointment scheduled successfully. Returning to your portal...");
        redirectToPortalIfSignedIn();
        return;
      }

      router.replace("/book/confirmation");
    } catch {
      trackEvent("booking_error", {
        event_category: "booking",
        error_type: "network",
      });
      setError("Network error while scheduling appointment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
        <h2 className="text-xl font-bold text-slate-900">Request an Estimate and Appointment</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter contact info, address, window count, gutter footage if needed, and a preferred time.
        </p>
        <form className="mt-4 grid gap-3" onSubmit={(event) => void onSubmit(event)}>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <FormStepLabel number="1" label="Contact" />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              autoComplete="name"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
              placeholder="Full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <input
              autoComplete="tel"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
              placeholder="Phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
            <input
              type="email"
              autoComplete="email"
              className="min-h-11 rounded-xl border border-slate-300 px-3 sm:col-span-2"
              placeholder="Email for confirmation and receipt"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <FormStepLabel number="2" label="Service address" />
            <input
              autoComplete="street-address"
              className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 px-3"
              placeholder="Street address"
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              required
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <input
                autoComplete="address-level2"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
                placeholder="City"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                required
              />
              <input
                autoComplete="address-level1"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
                placeholder="State"
                value={state}
                onChange={(event) => setState(event.target.value)}
                required
              />
              <input
                autoComplete="postal-code"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
                placeholder="ZIP"
                value={zip}
                onChange={(event) => setZip(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <FormStepLabel number="3" label="Service estimate" />
            <p className="mt-1 text-sm text-slate-600">
              Estimate uses $20 per window and $10 per linear foot of gutters. The total shown is an
              estimate until the job is reviewed or completed.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <QuoteCountInput
                label="Windows"
                helper="$20 est./window"
                placeholder="Number of windows"
                value={windowCount}
                onChange={setWindowCount}
              />
              <QuoteCountInput
                label="Gutters"
                helper="$10 est./linear ft, optional"
                placeholder="Gutter feet, if needed"
                value={gutterLinearFeet}
                onChange={setGutterLinearFeet}
                max={5000}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-[#fffaf0] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <FormStepLabel number="4" label="Appointment" />
                <p className="mt-1 text-sm text-slate-600">
                  Pick a date, then select one of the open arrival times.
                </p>
              </div>
              {selectedAppointmentLabel ? (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
                  {selectedAppointmentLabel}
                </div>
              ) : null}
            </div>

            <input type="hidden" value={scheduledStart} readOnly />

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {quickAvailabilityDates.map((option) => {
                const selected = availabilityDate === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleAvailabilityDateChange(option.value)}
                    className={
                      selected
                        ? "min-h-16 rounded-lg border border-[#D0B830] bg-[#080704] px-3 py-2 text-left shadow-sm"
                        : "min-h-16 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left shadow-sm hover:border-[#D0B830]"
                    }
                  >
                    <span className={selected ? "block text-xs font-black uppercase text-[#f7e680]" : "block text-xs font-black uppercase text-[#8a7211]"}>
                      {option.label}
                    </span>
                    <span className={selected ? "mt-1 block text-sm font-bold text-white" : "mt-1 block text-sm font-bold text-slate-900"}>
                      {option.dateLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                ref={availabilityDateInputRef}
                type="date"
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-3"
                value={availabilityDate}
                onChange={(event) => handleAvailabilityDateChange(event.target.value)}
              />
              <button
                type="button"
                onClick={handleFindOpenSlotsClick}
                disabled={loadingAvailability}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:border-[#D0B830] disabled:bg-slate-100"
              >
                {loadingAvailability ? "Checking..." : availabilityDate ? "Refresh Times" : "More Dates"}
              </button>
            </div>

            {availabilityDate ? (
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {loadingAvailability
                  ? `Checking open times for ${formatDateOnlyLabel(availabilityDate)}...`
                  : `Open times for ${formatDateOnlyLabel(availabilityDate)}`}
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Choose one of the dates above, or use More Dates for another day.
              </p>
            )}

            {availabilitySlots.length > 0 ? (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {availabilitySlots.map((slot) => (
                  <button
                    key={slot.startIso}
                    type="button"
                    aria-pressed={scheduledStart === toDateTimeLocalValue(new Date(slot.startIso))}
                    onClick={() => handleSlotSelect(slot)}
                    className={
                      scheduledStart === toDateTimeLocalValue(new Date(slot.startIso))
                        ? "min-h-12 rounded-lg border border-[#D0B830] bg-[#080704] px-3 text-sm font-black text-white"
                        : "min-h-12 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-bold text-emerald-900 hover:border-emerald-500"
                    }
                  >
                    <span className="block">{slot.label}</span>
                    <span className="block text-[11px] font-semibold opacity-80">
                      {slot.availableWorkerCount} worker{slot.availableWorkerCount > 1 ? "s" : ""} open
                    </span>
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
            placeholder="Notes or access instructions, optional"
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
              <label className="flex items-start gap-2 rounded-xl border border-[#D0B830]/30 bg-[#fffaf0] p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={createAccount}
                  onChange={(event) => setCreateAccount(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-bold text-slate-900">Save my details in a customer portal account</span>
                  <span className="block text-xs text-slate-600">
                    Optional. You can book without creating an account.
                  </span>
                </span>
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
            {submitting ? "Scheduling..." : `Request Appointment - Est. Total ${formatCents(estimate.totalCents)}`}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}
      </section>

      <div className="space-y-4 xl:sticky xl:top-6">
        <section className="rounded-2xl border border-[#D0B830]/60 bg-[#080704] p-4 text-white shadow-sm sm:p-5">
          <p className="text-xs font-black uppercase text-[#f7e680]">Estimated Total</p>
          <p className="mt-2 text-4xl font-black">{formatCents(estimate.totalCents)}</p>
          <p className="mt-1 text-sm font-semibold text-[#fff3b0]">
            Based on estimated pricing: $20 per window and $10 per linear foot of gutters. Final price
            is confirmed after review or completion.
          </p>
          <div className="mt-4 space-y-2 border-t border-white/15 pt-3">
            {estimate.lines.map((line) => (
              <div key={line.label} className="flex gap-3 text-sm">
                <span className="flex-1 text-[#fffaf0]">{line.label}</span>
                <span className={line.amountCents < 0 ? "font-black text-[#f7e680]" : "font-black text-white"}>
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
  helper,
  placeholder,
  value,
  onChange,
  max = 300,
}: {
  label: string;
  helper: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        className="min-h-11 rounded-xl border border-slate-300 px-3"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="text-xs font-semibold text-slate-500">{helper}</span>
    </label>
  );
}

function FormStepLabel({ number, label }: { number: string; label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-black uppercase text-slate-900">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#080704] text-xs text-[#f7e680]">
        {number}
      </span>
      {label}
    </p>
  );
}
