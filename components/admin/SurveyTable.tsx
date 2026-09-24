import Link from "next/link";
import { brandDisplay, formatDateTime } from "@/lib/format";
import type { AdminSurveyRow } from "@/lib/adminQueries";
import { AudioPlayButton } from "./AudioPlayButton";
import { SurveyThumbnails, type LightboxPhoto } from "./PhotoLightbox";

export function SurveyTable({ rows, photosByRow }: {
  rows: AdminSurveyRow[];
  photosByRow: Map<string, LightboxPhoto[]>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No surveys match these filters.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link href={`/survey/${r.id}`} className="text-base font-semibold text-slate-900 hover:text-brand-700">
                {r.shop_name}
              </Link>
              {r.edited_at ? (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Edited</span>
              ) : null}
              <p className="mt-1 text-sm text-slate-500">
                {r.market} · {r.shop_size} · {r.rep_username}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <p className="text-sm text-slate-500">{formatDateTime(r.created_at)}</p>
              <p className="text-sm font-medium text-slate-700">{brandDisplay(r.most_selling_fan, r.most_selling_fan_other)}</p>
            </div>
          </div>

          {r.audio_path ? (
            <div className="mt-3">
              <AudioPlayButton surveyId={r.id} />
            </div>
          ) : null}

          <div className="mt-3 border-t border-slate-100 pt-3">
            <SurveyThumbnails shopName={r.shop_name} photos={photosByRow.get(r.id) ?? []} />
          </div>
        </div>
      ))}
    </div>
  );
}
