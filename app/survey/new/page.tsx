"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SurveyForm } from "@/components/form/SurveyForm";
import { submitSurvey } from "@/lib/submitSurvey";
import { useToast } from "@/components/Toast";
import type { SurveyFormValues } from "@/lib/validation";

export default function NewSurveyPage() {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState("");
  const dirty = useRef(false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  async function handleSubmit(v: SurveyFormValues) {
    setError("");
    try {
      dirty.current = false;
      await submitSurvey(v);
      toast("Survey submitted", "success");
      router.push("/dashboard");
    } catch (e) {
      dirty.current = true;
      setError((e as Error).message);
      toast((e as Error).message, "error");
    }
  }

  return (
    <>
      {error ? <p role="alert" className="mx-auto max-w-md px-4 pt-4 text-sm text-red-600">{error}</p> : null}
      <SurveyForm onSubmit={handleSubmit} onDirty={() => { dirty.current = true; }} />
    </>
  );
}
