"use client";
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
  return (
    <SurveyEditForm
      survey={survey}
      media={media}
      onSaved={() => { toast("Changes saved", "success"); router.push(`/survey/${survey.id}`); }}
    />
  );
}
