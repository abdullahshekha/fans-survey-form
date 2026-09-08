import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SurveyDetail } from "@/components/SurveyDetail";

vi.mock("@/components/MiniMap", () => ({ MiniMap: () => <div /> }));
vi.mock("@/components/admin/DeleteSurveyButton", () => ({ DeleteSurveyButton: () => <div /> }));

const baseSurvey: any = {
  id: "s1", shop_name: "Al Madina", market: "Arambagh", shop_size: "Medium",
  customer_name: "Bilal", customer_number: "03001234567",
  gps_lat: 24.86, gps_lng: 67.02, gps_accuracy: 10,
  most_selling_fan: "Other", most_selling_fan_other: "Fanco",
  rec_30w_1: "GFC", rec_30w_1_other: null,
  rec_30w_2: null, rec_30w_2_other: null,
  rec_50w_1: "Royal", rec_50w_1_other: null,
  rec_50w_2: null, rec_50w_2_other: null,
  audio_path: null, created_at: "2026-09-08T10:00:00Z",
  rep: { id: "r1", username: "rep.one", full_name: "Rep One" }, photos: [],
};

describe("SurveyDetail v2", () => {
  it("renders an Other brand with its typed name", () => {
    render(<SurveyDetail survey={baseSurvey}
      media={{ photos: [], audio: null }} />);
    expect(screen.getByText(/Other — "Fanco"/)).toBeInTheDocument();
  });

  it("shows a Quotation section only when quotation photos exist", () => {
    const { rerender } = render(<SurveyDetail survey={baseSurvey}
      media={{ photos: [{ kind: "front", url: "u/f" }], audio: null }} />);
    expect(screen.queryByText("Quotation")).not.toBeInTheDocument();
    rerender(<SurveyDetail survey={baseSurvey}
      media={{ photos: [{ kind: "front", url: "u/f" }, { kind: "quotation", url: "u/q" }], audio: null }} />);
    expect(screen.getByText("Quotation")).toBeInTheDocument();
  });

  it("shows an Edit link only when canEdit is true", () => {
    const { rerender } = render(<SurveyDetail survey={baseSurvey} media={{ photos: [], audio: null }} />);
    expect(screen.queryByRole("link", { name: /edit survey/i })).not.toBeInTheDocument();
    rerender(<SurveyDetail survey={baseSurvey} media={{ photos: [], audio: null }} canEdit />);
    expect(screen.getByRole("link", { name: /edit survey/i })).toHaveAttribute("href", "/survey/s1/edit");
  });

  it("shows an Edited marker when edited_at is set", () => {
    render(<SurveyDetail survey={{ ...baseSurvey, edited_at: "2026-09-08T12:00:00Z" }}
      media={{ photos: [], audio: null }} />);
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });
});
