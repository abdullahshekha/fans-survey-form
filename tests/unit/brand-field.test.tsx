import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrandField } from "@/components/form/BrandField";

const base = {
  label: "Most selling fan", name: "most_selling_fan",
  value: "", otherValue: "", onChange: vi.fn(), onOtherChange: vi.fn(),
};

describe("BrandField", () => {
  it("shows the brand select with an Other option, no text input", () => {
    render(<BrandField {...base} />);
    expect(screen.getByRole("combobox", { name: /most selling fan/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /other/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/type the brand name/i)).not.toBeInTheDocument();
  });

  it("reveals the text input when the value is Other", () => {
    render(<BrandField {...base} value="Other" />);
    const input = screen.getByPlaceholderText(/type the brand name/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("maxLength", "40");
  });

  it("calls onChange from the select and onOtherChange from the text input", async () => {
    const onChange = vi.fn();
    const onOtherChange = vi.fn();
    const { rerender } = render(<BrandField {...base} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "Other");
    expect(onChange).toHaveBeenCalledWith("Other");
    rerender(<BrandField {...base} value="Other" onOtherChange={onOtherChange} />);
    await userEvent.type(screen.getByPlaceholderText(/type the brand name/i), "F");
    expect(onOtherChange).toHaveBeenCalledWith("F");
  });

  it("renders the error text once", () => {
    render(<BrandField {...base} value="Other" error="Enter the brand name" />);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByText("Enter the brand name")).toBeInTheDocument();
  });
});
