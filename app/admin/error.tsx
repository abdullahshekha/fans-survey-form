"use client";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-slate-500">
        This page could not be loaded. Please try again.
      </p>
      <button
        onClick={() => reset()}
        className="mt-4 rounded border px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        Retry
      </button>
    </div>
  );
}
