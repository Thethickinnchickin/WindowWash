"use client";

import { FormEvent, useEffect, useState } from "react";

type Customer = {
  id: string;
  name: string;
  phoneE164: string;
  email: string | null;
  smsOptOut: boolean;
  _count?: {
    jobs: number;
  };
};

export function CustomersManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [smsOptOut, setSmsOptOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/admin/customers");
    const json = await response.json();
    if (response.ok) {
      setCustomers(json.data.customers);
      setError(null);
      return;
    }

    setError(json.error?.message || "Failed to load customers");
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCustomer(event: FormEvent) {
    event.preventDefault();

    const response = await fetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, smsOptOut }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error?.message || "Failed to create customer");
      return;
    }

    setName("");
    setPhone("");
    setEmail("");
    setSmsOptOut(false);
    await load();
  }

  async function toggleSmsOptOut(customer: Customer) {
    const response = await fetch(`/api/admin/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        smsOptOut: !customer.smsOptOut,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      setError(json.error?.message || "Failed to update customer");
      return;
    }

    await load();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">Create Customer</h2>
        <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={(event) => void createCustomer(event)}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            required
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone"
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            required
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email (optional)"
            className="min-h-11 rounded-xl border border-slate-300 px-3"
          />
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm">
            <input
              type="checkbox"
              checked={smsOptOut}
              onChange={(event) => setSmsOptOut(event.target.checked)}
            />
            SMS opt-out
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white"
          >
            Save Customer
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">Customers</h2>
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="p-2">Name</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Email</th>
                <th className="p-2">Jobs</th>
                <th className="p-2">SMS</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-t border-slate-200">
                  <td className="p-2 font-semibold text-slate-900">{customer.name}</td>
                  <td className="p-2">{customer.phoneE164}</td>
                  <td className="p-2">{customer.email || "-"}</td>
                  <td className="p-2">{customer._count?.jobs ?? 0}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => void toggleSmsOptOut(customer)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                    >
                      {customer.smsOptOut ? "Opted Out" : "Allowed"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
