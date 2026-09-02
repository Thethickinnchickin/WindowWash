"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SaveCardSetupForm } from "@/components/public/save-card-setup-form";
import { CardPaymentForm } from "@/components/worker/card-payment-form";
import {
  AccessLevel,
  ServiceFrequency,
  ServicePackage,
  StoryCount,
  accessOptions,
  calculateWindowWashEstimate,
  formatCents,
  frequencyOptions,
  servicePackages,
  storyOptions,
} from "@/lib/pricing";

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

const packageOrder: ServicePackage[] = ["exterior", "interior_exterior", "complete"];
const storyOrder: StoryCount[] = ["one", "two", "three_plus"];
const accessOrder: AccessLevel[] = ["easy", "standard", "difficult"];
const frequencyOrder: ServiceFrequency[] = ["one_time", "quarterly", "monthly"];

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
  const [servicePackage, setServicePackage] = useState<ServicePackage>("interior_exterior");
  const [windowCount, setWindowCount] = useState("12");
  const [screenCount, setScreenCount] = useState("0");
  const [trackCount, setTrackCount] = useState("0");
  const [hardWaterWindowCount, setHardWaterWindowCount] = useState("0");
  const [postConstruction, setPostConstruction] = useState(false);
  const [stories, setStories] = useState<StoryCount>("one");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("easy");
  const [frequency, setFrequency] = useState<ServiceFrequency>("one_time");
  const [notes, setNotes] = useState("");
  const [prepayNow, setPrepayNow] = useState(false);
  const [prepayMode, setPrepayMode] = useState<"none" | "full" | "deposit">("none");
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

  const pricingInput = useMemo(
    () => ({
      servicePackage,
      windowCount: parseCount(windowCount),
      screenCount: parseCount(screenCount),
      trackCount: parseCount(trackCount),
      hardWaterWindowCount: parseCount(hardWaterWindowCount),
      postConstruction,
      stories,
      accessLevel,
      frequency,
      city,
      state,
      zip,
    }),
    [
      servicePackage,
      windowCount,
      screenCount,
      trackCount,
      hardWaterWindowCount,
      postConstruction,
      stories,
      accessLevel,
      frequency,
      city,
      state,
      zip,
    ],
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
      const depositCents = estimate.depositCents;
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
          estimatedDurationMinutes: estimate.estimatedDurationMinutes,
          amountDueCents: estimate.totalCents,
          pricing: {
            servicePackage,
            windowCount: pricingInput.windowCount,
            screenCount: pricingInput.screenCount,
            trackCount: pricingInput.trackCount,
            hardWaterWindowCount: pricingInput.hardWaterWindowCount,
            postConstruction,
            stories,
            accessLevel,
            frequency,
          },
          prepayNow,
          prepayMode: prepayNow ? (prepayMode === "none" ? "full" : prepayMode) : "none",
          prepayUseSavedCard: prepayNow ? prepayUseSavedCard : false,
          prepayAmountCents:
            prepayNow && prepayMode === "deposit"
              ? estimate.depositCents
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

          <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
            <p className="text-sm font-black uppercase text-slate-900">Service Package</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {packageOrder.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setServicePackage(option)}
                  className={
                    servicePackage === option
                      ? "min-h-20 rounded-xl border border-cyan-300 bg-slate-950 px-3 py-2 text-left text-white"
                      : "min-h-20 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-left text-slate-900"
                  }
                >
                  <span className="block text-sm font-black">{servicePackages[option].label}</span>
                  <span className="mt-1 block text-xs font-semibold opacity-80">
                    {formatCents(servicePackages[option].pricePerWindowCents)} per window
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-black uppercase text-slate-900">Job Size</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <QuoteCountInput label="Windows" value={windowCount} onChange={setWindowCount} />
              <QuoteCountInput label="Screens" value={screenCount} onChange={setScreenCount} />
              <QuoteCountInput label="Tracks/sills" value={trackCount} onChange={setTrackCount} />
              <QuoteCountInput label="Hard water" value={hardWaterWindowCount} onChange={setHardWaterWindowCount} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-black uppercase text-slate-900">Difficulty</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {storyOrder.map((option) => (
                <QuoteOptionButton
                  key={option}
                  active={stories === option}
                  label={storyOptions[option].label}
                  onClick={() => setStories(option)}
                />
              ))}
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {accessOrder.map((option) => (
                <QuoteOptionButton
                  key={option}
                  active={accessLevel === option}
                  label={accessOptions[option].label}
                  onClick={() => setAccessLevel(option)}
                />
              ))}
            </div>
            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-800">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={postConstruction}
                onChange={(event) => setPostConstruction(event.target.checked)}
              />
              Post-construction cleanup
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-black uppercase text-slate-900">Service Frequency</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {frequencyOrder.map((option) => (
                <QuoteOptionButton
                  key={option}
                  active={frequency === option}
                  label={frequencyOptions[option].label}
                  onClick={() => setFrequency(option)}
                />
              ))}
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
                setPrepayMode(checked ? (prepayMode === "none" ? "deposit" : prepayMode) : "none");
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
                Full estimate ({formatCents(estimate.totalCents)})
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="prepayMode"
                  value="deposit"
                  checked={prepayMode === "deposit"}
                  onChange={() => setPrepayMode("deposit")}
                />
                Deposit now ({formatCents(estimate.depositCents)})
              </label>
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
            {estimate.estimatedDurationMinutes} min service estimate. Recommended deposit:{" "}
            {formatCents(estimate.depositCents)}.
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

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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

function QuoteOptionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "min-h-11 rounded-xl border border-cyan-300 bg-slate-950 px-3 text-sm font-black text-white"
          : "min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
      }
    >
      {label}
    </button>
  );
}
