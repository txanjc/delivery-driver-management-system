import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          DeliverEaze Logistics
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">
          Unauthorized
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your account does not have active Administrator access to this portal.
        </p>
        <Link
          className="mt-6 inline-flex rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          href="/login"
        >
          Return to login
        </Link>
      </section>
    </main>
  );
}
