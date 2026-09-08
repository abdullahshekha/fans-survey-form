"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteSurvey } from "@/app/admin/surveys/actions";

export function DeleteSurveyButton({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  if (!confirming) {
    return <button onClick={() => setConfirming(true)} className="text-sm text-red-600 underline">Delete survey</button>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
      <p>Permanently delete this survey and its photos and voice note?</p>
      <div className="flex gap-2">
        <button disabled={pending} className="rounded bg-red-600 px-3 py-1.5 text-white"
          onClick={() => start(async () => {
            const res = await deleteSurvey(surveyId);
            if (res.error) setError(res.error);
            else router.push("/admin/surveys");
          })}>
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button onClick={() => setConfirming(false)} className="rounded border border-slate-300 px-3 py-1.5">Cancel</button>
      </div>
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    </div>
  );
}
