import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SurveyFields } from "@/components/form/SurveyFields";
import { EMPTY_SURVEY } from "@/components/form/SurveyForm";

describe("SurveyFields", () => {
  it("renders every scalar field and both slots", () => {
    render(<SurveyFields v={EMPTY_SURVEY} set={vi.fn()} errors={{}}
      photos={<div data-testid="photos-slot" />} voice={<div data-testid="voice-slot" />} />);
    expect(screen.getByLabelText(/shop name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/market/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/customer number/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /most selling fan/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /50W — Recommend 2/i })).toBeInTheDocument();
    expect(screen.getByTestId("photos-slot")).toBeInTheDocument();
    expect(screen.getByTestId("voice-slot")).toBeInTheDocument();
  });
});
