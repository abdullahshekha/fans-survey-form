import { MediaGallery } from "./MediaGallery";
import { MiniMap } from "./MiniMap";
import { DeleteSurveyButton } from "@/components/admin/DeleteSurveyButton";
import { brandDisplay, formatDateTime } from "@/lib/format";
import type { SurveyWithRelations } from "@/lib/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

export function SurveyDetail({ survey, media, canDelete }: {
  survey: SurveyWithRelations;
  media: { photos: { kind: "front" | "inner" | "quotation"; url: string }[]; audio: string | null };
  canDelete?: boolean;
}) {
  const mainPhotos = media.photos.filter((p) => p.kind !== "quotation");
  const quotationPhotos = media.photos.filter((p) => p.kind === "quotation");
  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-5">
      <header>
        <h1 className="text-xl font-semibold">{survey.shop_name}</h1>
        <p className="text-sm text-slate-500">
          {survey.market} · by {survey.rep.full_name} · {formatDateTime(survey.created_at)}
        </p>
      </header>

      <MediaGallery photos={mainPhotos} />

      <section>
        <Row label="Shop size" value={survey.shop_size} />
        <Row label="Customer name" value={survey.customer_name} />
        <Row label="Customer number" value={survey.customer_number} />
        <Row label="Most selling fan" value={brandDisplay(survey.most_selling_fan, survey.most_selling_fan_other)} />
        <Row label="30W — Recommend 1" value={brandDisplay(survey.rec_30w_1, survey.rec_30w_1_other)} />
        <Row label="30W — Recommend 2" value={brandDisplay(survey.rec_30w_2, survey.rec_30w_2_other)} />
        <Row label="50W — Recommend 1" value={brandDisplay(survey.rec_50w_1, survey.rec_50w_1_other)} />
        <Row label="50W — Recommend 2" value={brandDisplay(survey.rec_50w_2, survey.rec_50w_2_other)} />
        <Row label="GPS" value={`${survey.gps_lat.toFixed(5)}, ${survey.gps_lng.toFixed(5)}`} />
      </section>

      {media.audio ? (
        <section className="flex flex-col gap-1">
          <span className="text-sm font-medium">Pak Fan comments</span>
          <audio src={media.audio} controls className="w-full" />
        </section>
      ) : null}

      {quotationPhotos.length > 0 ? (
        <section className="flex flex-col gap-1">
          <span className="text-sm font-medium">Quotation</span>
          <MediaGallery photos={quotationPhotos} />
        </section>
      ) : null}

      <MiniMap lat={survey.gps_lat} lng={survey.gps_lng} />

      {canDelete ? (
        <div className="border-t border-slate-200 pt-4">
          <DeleteSurveyButton surveyId={survey.id} />
        </div>
      ) : null}
    </main>
  );
}
