"use client";
import { useMemo, useState } from "react";
import { SurveyFields } from "./SurveyFields";
import { PhotoCapture } from "./PhotoCapture";
import { VoiceRecorder } from "./VoiceRecorder";
import { validateSurveyEdit, type SurveyFormValues, type ExistingMedia } from "@/lib/validation";
import { updateSurvey, type SurveyEditInput } from "@/lib/submitSurvey";
import type { MediaSlot, AudioSlot } from "@/lib/upload";
import type { SurveyWithRelations } from "@/lib/types";

type EditMedia = {
  photos: { kind: "front" | "inner" | "quotation"; url: string; storagePath: string }[];
  audioUrl: string | null;
};

function initialValues(s: SurveyWithRelations): SurveyFormValues {
  return {
    shop_name: s.shop_name,
    market: s.market,
    shop_size: s.shop_size,
    customer_name: s.customer_name,
    customer_number: s.customer_number,
    gps: { lat: s.gps_lat, lng: s.gps_lng, accuracy: s.gps_accuracy },
    most_selling_fan: s.most_selling_fan,
    rec_30w_1: s.rec_30w_1,
    rec_30w_2: s.rec_30w_2 ?? "",
    rec_50w_1: s.rec_50w_1,
    rec_50w_2: s.rec_50w_2 ?? "",
    most_selling_fan_other: s.most_selling_fan_other ?? "",
    rec_30w_1_other: s.rec_30w_1_other ?? "",
    rec_30w_2_other: s.rec_30w_2_other ?? "",
    rec_50w_1_other: s.rec_50w_1_other ?? "",
    rec_50w_2_other: s.rec_50w_2_other ?? "",
    frontPhoto: null, innerPhotos: [], quotationPhotos: [], audio: null,
  };
}

const asExisting = (m: { url: string; storagePath: string }): ExistingMedia =>
  ({ url: m.url, storagePath: m.storagePath });

export function SurveyEditForm({
  survey, media, onSaved,
}: {
  survey: SurveyWithRelations;
  media: EditMedia;
  onSaved: () => void;
}) {
  const [v, setV] = useState<SurveyFormValues>(() => initialValues(survey));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const originalPhotoPaths = useMemo(() => media.photos.map((p) => p.storagePath), [media]);
  const originalAudioPath = survey.audio_path;

  const [existingFront, setExistingFront] = useState<ExistingMedia | null>(
    media.photos.filter((p) => p.kind === "front").map(asExisting)[0] ?? null,
  );
  const [existingInner, setExistingInner] = useState<ExistingMedia[]>(
    media.photos.filter((p) => p.kind === "inner").map(asExisting),
  );
  const [existingQuotation, setExistingQuotation] = useState<ExistingMedia[]>(
    media.photos.filter((p) => p.kind === "quotation").map(asExisting),
  );
  const [audioKept, setAudioKept] = useState<boolean>(!!media.audioUrl);

  const set = <K extends keyof SurveyFormValues>(k: K, val: SurveyFormValues[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  function frontSlot(): MediaSlot {
    if (v.frontPhoto) return { file: v.frontPhoto };
    if (existingFront) return { keep: existingFront.storagePath };
    return { file: undefined as unknown as File }; // guarded by validation (front count 0)
  }
  function listSlots(existing: ExistingMedia[], added: File[]): MediaSlot[] {
    return [...existing.map((e) => ({ keep: e.storagePath })), ...added.map((f) => ({ file: f }))];
  }
  function audioSlot(): AudioSlot {
    if (v.audio) return { file: v.audio };
    if (audioKept && originalAudioPath) return { keep: originalAudioPath };
    return null;
  }

  const counts = {
    front: (existingFront ? 1 : 0) + (v.frontPhoto ? 1 : 0),
    inner: existingInner.length + v.innerPhotos.length,
    quotation: existingQuotation.length + v.quotationPhotos.length,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const errs = validateSurveyEdit(v, counts);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      document.querySelector('[aria-invalid="true"], [data-invalid="true"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const input: SurveyEditInput = {
      values: v,
      media: {
        front: frontSlot(),
        inner: listSlots(existingInner, v.innerPhotos),
        quotation: listSlots(existingQuotation, v.quotationPhotos),
        audio: audioSlot(),
      },
      originalPhotoPaths,
      originalAudioPath,
    };
    setBusy(true);
    try {
      await updateSurvey(survey.id, input);
      onSaved();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-28">
      <h1 className="text-xl font-semibold">Edit survey</h1>
      {formError ? <p role="alert" className="text-sm text-red-600">{formError}</p> : null}

      <SurveyFields
        v={v}
        set={set}
        errors={errors}
        photos={
          <div data-region="photos" data-invalid={errors.frontPhoto || errors.innerPhotos || errors.quotationPhotos ? "true" : undefined}>
            <PhotoCapture
              front={v.frontPhoto} inner={v.innerPhotos} quotation={v.quotationPhotos}
              onFrontChange={(f) => set("frontPhoto", f)}
              onInnerChange={(files) => set("innerPhotos", files)}
              onQuotationChange={(files) => set("quotationPhotos", files)}
              existingFront={existingFront}
              existingInner={existingInner}
              existingQuotation={existingQuotation}
              onRemoveExistingFront={() => setExistingFront(null)}
              onRemoveExistingInner={(sp) => setExistingInner((xs) => xs.filter((x) => x.storagePath !== sp))}
              onRemoveExistingQuotation={(sp) => setExistingQuotation((xs) => xs.filter((x) => x.storagePath !== sp))}
            />
            {errors.frontPhoto ? <span role="alert" className="text-xs text-red-600">{errors.frontPhoto}</span> : null}
            {errors.innerPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.innerPhotos}</span> : null}
            {errors.quotationPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.quotationPhotos}</span> : null}
          </div>
        }
        voice={
          <div data-region="voice">
            <VoiceRecorder
              value={v.audio}
              onChange={(b) => set("audio", b)}
              existingUrl={audioKept ? media.audioUrl : null}
              onClearExisting={() => setAudioKept(false)}
            />
            {errors.audio ? <span role="alert" className="block text-xs text-red-600">{errors.audio}</span> : null}
          </div>
        }
      />

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
        <button type="submit" disabled={busy}
          className="w-full rounded-lg bg-slate-900 py-3 text-base font-medium text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
