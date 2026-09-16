"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMarket, renameMarket } from "@/app/admin/housekeeping/actions";

export function MarketsSection({ markets }: { markets: { name: string; color: string }[] }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function beginRename(name: string) {
    setError("");
    setRenaming(name);
    setRenameValue(name);
  }

  function saveRename(oldName: string) {
    setError("");
    start(async () => {
      try {
        await renameMarket(oldName, renameValue);
        setRenaming(null);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function submitAdd() {
    setError("");
    start(async () => {
      try {
        await addMarket(newName);
        setNewName("");
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold">Markets</h2>
        <p className="text-sm text-slate-500">
          Renaming a market updates it everywhere, including past surveys. Markets cannot be deleted here.
        </p>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <ul className="flex flex-col gap-2">
        {markets.map((m) => (
          <li key={m.name} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: m.color }} />
            {renaming === m.name ? (
              <>
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  aria-label={`Rename ${m.name}`}
                  className="rounded border border-slate-300 px-2 py-1"
                />
                <button disabled={pending} onClick={() => saveRename(m.name)}
                  className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-60">
                  Save
                </button>
                <button disabled={pending} onClick={() => setRenaming(null)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex-1">{m.name}</span>
                <button disabled={pending} aria-label={`Rename ${m.name}`} onClick={() => beginRename(m.name)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs">
                  Rename
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New market name"
          aria-label="New market name"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button disabled={pending || !newName.trim()} onClick={submitAdd}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60">
          Add market
        </button>
      </div>
    </div>
  );
}
