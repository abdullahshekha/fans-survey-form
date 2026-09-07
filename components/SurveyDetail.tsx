import { MediaGallery } from "./MediaGallery";
import { MiniMap } from "./MiniMap";
import { formatDateTime } from "@/lib/format";
import type { SurveyWithRelations } from "@/lib/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

export function SurveyDetail({ survey, media }: {
  survey: SurveyWithRelations;
  media: { photos: { kind: "front" | "inner"; url: string }[]; audio: string | null };
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-5">
      <header>
        <h1 className="text-xl font-semibold">{survey.shop_name}</h1>
        <p className="text-sm text-slate-500">
          {survey.market} · by {survey.rep.full_name} · {formatDateTime(survey.created_at)}
        </p>
      </header>

      <MediaGallery photos={media.photos} />

      <section>
        <Row label="Shop size" value={survey.shop_size} />
        <Row label="Customer name" value={survey.customer_name} />
        <Row label="Customer number" value={survey.customer_number} />
        <Row label="Most selling fan" value={survey.most_selling_fan} />
        <Row label="30W — Recommend 1" value={survey.rec_30w_1} />
        <Row label="30W — Recommend 2" value={survey.rec_30w_2} />
        <Row label="50W — Recommend 1" value={survey.rec_50w_1} />
        <Row label="50W — Recommend 2" value={survey.rec_50w_2} />
        <Row label="GPS" value={`${survey.gps_lat.toFixed(5)}, ${survey.gps_lng.toFixed(5)}`} />
      </section>

      {media.audio ? (
        <section className="flex flex-col gap-1">
          <span className="text-sm font-medium">Pak Fan comments</span>
          <audio src={media.audio} controls className="w-full" />
        </section>
      ) : null}

      <MiniMap lat={survey.gps_lat} lng={survey.gps_lng} />
    </main>
  );
}
