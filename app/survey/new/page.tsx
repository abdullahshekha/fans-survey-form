"use client";
import { SurveyForm } from "@/components/form/SurveyForm";

export default function NewSurveyPage() {
  return <SurveyForm onSubmit={async () => { /* wired up in Task 18 */ }} />;
}
