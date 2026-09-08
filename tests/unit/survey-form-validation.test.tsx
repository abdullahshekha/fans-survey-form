import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurveyForm } from "@/components/form/SurveyForm";

describe("SurveyForm validation", () => {
  it("blocks submit and shows errors when required fields are empty", async () => {
    const onSubmit = vi.fn();
    render(<SurveyForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /submit survey/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/shop name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/select a market/i)).toBeInTheDocument();
    expect(screen.getByText(/capture the shop location/i)).toBeInTheDocument();
    expect(screen.getByText(/add a front photo/i)).toBeInTheDocument();
  });

  it("shows a phone-format error for a bad number", async () => {
    render(<SurveyForm onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/customer number/i), "12345");
    await userEvent.click(screen.getByRole("button", { name: /submit survey/i }));
    expect(await screen.findByText(/valid pakistani mobile number/i)).toBeInTheDocument();
  });

  it("requires a typed name when a brand is set to Other", async () => {
    render(<SurveyForm onSubmit={vi.fn()} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /most selling fan/i }), "Other");
    await userEvent.click(screen.getByRole("button", { name: /submit survey/i }));
    expect(await screen.findByText(/enter the brand name/i)).toBeInTheDocument();
  });
});
