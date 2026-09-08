import { describe, it, expect } from "vitest";
import { normalizePhone, validateSurvey, validateSurveyEdit, validateScalarFields, buildSurveyPayload, validateAudioUpload, type SurveyFormValues } from "@/lib/validation";
import { MAX_AUDIO_UPLOAD_MB } from "@/lib/constants";

const valid: SurveyFormValues = {
  shop_name: "Al Madina Electronics",
  market: "Arambagh",
  shop_size: "Medium",
  customer_name: "Bilal",
  customer_number: "0300 1234567",
  gps: { lat: 24.86, lng: 67.02, accuracy: 12 },
  most_selling_fan: "GFC",
  rec_30w_1: "Tamoor",
  rec_30w_2: "",
  rec_50w_1: "Royal",
  rec_50w_2: "",
  most_selling_fan_other: "",
  rec_30w_1_other: "",
  rec_30w_2_other: "",
  rec_50w_1_other: "",
  rec_50w_2_other: "",
  frontPhoto: new File(["x"], "front.jpg", { type: "image/jpeg" }),
  innerPhotos: [new File(["x"], "a.jpg", { type: "image/jpeg" })],
  quotationPhotos: [],
  audio: null,
};

describe("normalizePhone", () => {
  it.each([
    ["03001234567", "03001234567"],
    ["0300 123 4567", "03001234567"],
    ["+923001234567", "03001234567"],
    ["+92 300 1234567", "03001234567"],
  ])("accepts %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
  it.each(["12345", "0300123456", "030012345678", "0421234567", ""])(
    "rejects %s",
    (input) => expect(normalizePhone(input)).toBeNull(),
  );
});

describe("validateSurvey", () => {
  it("passes a fully valid form", () => {
    expect(validateSurvey(valid)).toEqual({});
  });
  it("flags every missing required field", () => {
    const errs = validateSurvey({
      ...valid, shop_name: " ", market: "", shop_size: "", customer_name: "",
      customer_number: "abc", gps: null, most_selling_fan: "", rec_30w_1: "",
      rec_50w_1: "", frontPhoto: null, innerPhotos: [],
      most_selling_fan_other: "", rec_30w_1_other: "", rec_30w_2_other: "",
      rec_50w_1_other: "", rec_50w_2_other: "", quotationPhotos: [],
    });
    for (const k of ["shop_name","market","shop_size","customer_name","customer_number","gps","most_selling_fan","rec_30w_1","rec_50w_1","frontPhoto","innerPhotos"]) {
      expect(errs).toHaveProperty(k);
    }
  });
  it("allows blank optional recommendations", () => {
    expect(validateSurvey({ ...valid, rec_30w_2: "", rec_50w_2: "" })).toEqual({});
  });
  it("rejects an out-of-range optional recommendation", () => {
    expect(validateSurvey({ ...valid, rec_30w_2: "Nonsense" })).toHaveProperty("rec_30w_2");
  });
  it("rejects more than 10 inner photos", () => {
    const many = Array.from({ length: 11 }, (_, i) => new File(["x"], `${i}.jpg`, { type: "image/jpeg" }));
    expect(validateSurvey({ ...valid, innerPhotos: many })).toHaveProperty("innerPhotos");
  });
});

describe("buildSurveyPayload", () => {
  it("normalizes phone and maps photo paths", () => {
    const p = buildSurveyPayload("11111111-1111-1111-1111-111111111111", valid, {
      front: "uid/sid/front.jpg", inner: ["uid/sid/inner-0.jpg"], quotation: [], audio: null,
    });
    expect(p.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(p.customer_number).toBe("03001234567");
    expect(p.rec_30w_2).toBeNull();
    expect(p.audio_path).toBeNull();
    expect(p.photos).toEqual([
      { kind: "front", storage_path: "uid/sid/front.jpg", sort_order: 0 },
      { kind: "inner", storage_path: "uid/sid/inner-0.jpg", sort_order: 0 },
    ]);
  });
});

describe("Other brand", () => {
  it("accepts a real brand with no _other text", () => {
    expect(validateSurvey({ ...valid, most_selling_fan: "GFC", most_selling_fan_other: "" })).toEqual({});
  });
  it("requires the typed name when the field is Other", () => {
    const e = validateSurvey({ ...valid, most_selling_fan: "Other", most_selling_fan_other: "  " });
    expect(e.most_selling_fan_other).toMatch(/brand name/i);
    expect(e.most_selling_fan).toBeUndefined();
  });
  it("accepts Other + a name, trims it in the payload", () => {
    expect(validateSurvey({ ...valid, most_selling_fan: "Other", most_selling_fan_other: " Fanco " })).toEqual({});
    const p = buildSurveyPayload("11111111-1111-1111-1111-111111111111",
      { ...valid, most_selling_fan: "Other", most_selling_fan_other: " Fanco " },
      { front: "u/s/front.jpg", inner: ["u/s/inner-0.jpg"], quotation: [], audio: null });
    expect(p.most_selling_fan).toBe("Other");
    expect(p.most_selling_fan_other).toBe("Fanco");
    expect(p.rec_30w_1_other).toBeNull();
  });
  it("rejects an Other name longer than 40 chars", () => {
    const e = validateSurvey({ ...valid, rec_30w_1: "Other", rec_30w_1_other: "x".repeat(41) });
    expect(e.rec_30w_1_other).toMatch(/40/);
  });
  it("still allows a blank optional recommendation", () => {
    expect(validateSurvey({ ...valid, rec_30w_2: "", rec_30w_2_other: "" })).toEqual({});
  });
});

describe("quotation photos", () => {
  const img = (n: string) => new File([new Uint8Array(4)], n, { type: "image/jpeg" });
  it("0 is fine", () => {
    expect(validateSurvey({ ...valid, quotationPhotos: [] })).toEqual({});
  });
  it("errors above the cap of 2", () => {
    const e = validateSurvey({ ...valid, quotationPhotos: [img("a"), img("b"), img("c")] });
    expect(e.quotationPhotos).toMatch(/2 quotation/i);
  });
  it("maps quotation paths into the payload", () => {
    const p = buildSurveyPayload("11111111-1111-1111-1111-111111111111", valid,
      { front: "u/s/front.jpg", inner: ["u/s/inner-0.jpg"], quotation: ["u/s/quotation-0.jpg", "u/s/quotation-1.jpg"], audio: null });
    expect(p.photos).toEqual([
      { kind: "front", storage_path: "u/s/front.jpg", sort_order: 0 },
      { kind: "inner", storage_path: "u/s/inner-0.jpg", sort_order: 0 },
      { kind: "quotation", storage_path: "u/s/quotation-0.jpg", sort_order: 0 },
      { kind: "quotation", storage_path: "u/s/quotation-1.jpg", sort_order: 1 },
    ]);
  });
});

const goodScalars: SurveyFormValues = {
  shop_name: "Al Madina", market: "Arambagh", shop_size: "Small",
  customer_name: "B", customer_number: "03001234567",
  gps: { lat: 24.86, lng: 67.02, accuracy: 10 },
  most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: "", rec_50w_1: "Royal", rec_50w_2: "",
  most_selling_fan_other: "", rec_30w_1_other: "", rec_30w_2_other: "", rec_50w_1_other: "", rec_50w_2_other: "",
  frontPhoto: null, innerPhotos: [], quotationPhotos: [], audio: null,
};

describe("validateSurveyEdit", () => {
  it("passes when front is an existing photo and inner count >= 1", () => {
    const e = validateSurveyEdit(goodScalars, { front: 1, inner: 2, quotation: 0 });
    expect(e).toEqual({});
  });
  it("flags a missing front and empty inner set", () => {
    const e = validateSurveyEdit(goodScalars, { front: 0, inner: 0, quotation: 0 });
    expect(e.frontPhoto).toMatch(/front photo/i);
    expect(e.innerPhotos).toMatch(/at least one/i);
  });
  it("caps inner at 10 and quotation at 2", () => {
    const e = validateSurveyEdit(goodScalars, { front: 1, inner: 11, quotation: 3 });
    expect(e.innerPhotos).toMatch(/no more than 10/i);
    expect(e.quotationPhotos).toMatch(/no more than 2/i);
  });
  it("reuses the scalar checks", () => {
    const e = validateSurveyEdit({ ...goodScalars, shop_name: "" }, { front: 1, inner: 1, quotation: 0 });
    expect(e.shop_name).toBeTruthy();
  });
});

describe("validateScalarFields", () => {
  it("returns no errors for good scalars and ignores media", () => {
    expect(validateScalarFields(goodScalars)).toEqual({});
  });
});

describe("validateAudioUpload", () => {
  const file = (type: string, bytes: number) =>
    new File([new Uint8Array(bytes)], "n", { type });

  it("accepts an audio file within the size cap", () => {
    expect(validateAudioUpload(file("audio/mpeg", 5 * 1024 * 1024))).toBeNull();
  });
  it("rejects a non-audio type", () => {
    expect(validateAudioUpload(file("application/pdf", 10))).toMatch(/audio file/i);
  });
  it("rejects a file over the cap", () => {
    expect(validateAudioUpload(file("audio/wav", (MAX_AUDIO_UPLOAD_MB + 1) * 1024 * 1024)))
      .toMatch(new RegExp(`${MAX_AUDIO_UPLOAD_MB} MB`));
  });
});
