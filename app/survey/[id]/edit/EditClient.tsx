"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SurveyEditForm } from "@/components/form/SurveyEditForm";
import { useToast } from "@/components/Toast";
import type { SurveyWithRelations } from "@/lib/types";

export function EditClient({ survey, media }: {
  survey: SurveyWithRelations;
  media: { photos: { kind: "front" | "inner" | "quotation"; url: string; storagePath: string }[]; audioUrl: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const dirty = useRef(false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return (
    <SurveyEditForm
      survey={survey}
      media={media}
      onDirty={() => { dirty.current = true; }}
      onSaved={() => {
        dirty.current = false;
        toast("Changes saved", "success");
        router.push(`/survey/${survey.id}`);
      }}
    />
  );
}
