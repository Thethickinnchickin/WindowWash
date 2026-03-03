export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">You are offline</h1>
        <p className="mt-2 text-sm text-slate-600">
          The app shell is available, and queued updates will sync automatically when your connection returns.
        </p>
      </section>
    </main>
  );
}
