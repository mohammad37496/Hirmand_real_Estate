import assert from "node:assert/strict";
import test from "node:test";
import { propertyInputSchema } from "./properties.ts";
import { isMoneyText, normalizeMoneyText, normalizeMoneyInput } from "./property-input-normalization.ts";

function baseProperty(overrides: Record<string, unknown> = {}) {
  return {
    title: "فایل آپارتمان تست قرارداد داده",
    transactionType: "sell",
    propertyType: "apartment",
    neighborhood: "مرداویج",
    areaM2: null,
    bedrooms: 2,
    bathrooms: 1,
    floor: null,
    totalFloors: null,
    builtYear: 1400,
    parking: true,
    elevator: true,
    storage: true,
    otherAmenities: [],
    description: "این توضیحات برای آزمون قرارداد داده فرم مدیریت ثبت شده است.",
    features: [],
    images: [],
    contactName: "هیرمند",
    contactPhone: "09130000000",
    status: "published",
    featured: false,
    ...overrides,
  };
}

test("money normalization treats literal null and empty values as null without changing real digits", () => {
  assert.equal(normalizeMoneyInput("null"), null);
  assert.equal(normalizeMoneyInput(" undefined "), null);
  assert.equal(normalizeMoneyText("۱۲۳٬۴۵۶"), "123456");
  assert.equal(normalizeMoneyText("1,234,567"), "1234567");
  assert.equal(normalizeMoneyText(""), "");
  assert.equal(isMoneyText("99999999999999999999"), true);
});

test("property input schema owns the money contract as string|null", () => {
  const parsed = propertyInputSchema.parse(
    baseProperty({
      price: "۹۹۹۹۹۹۹۹۹۹۹۹۹۹۹۹۹۹۹",
      deposit: "null",
      rent: "",
    }),
  );

  assert.equal(parsed.price, "99999999999999999999");
  assert.equal(parsed.deposit, null);
  assert.equal(parsed.rent, null);
});

test("legacy numeric money payloads remain compatible only when finite", () => {
  const parsed = propertyInputSchema.parse(
    baseProperty({
      price: 1500000000,
      deposit: null,
      rent: undefined,
    }),
  );
  assert.equal(parsed.price, "1500000000");
  assert.equal(parsed.deposit, null);
  assert.equal(parsed.rent, null);
});

test("malformed money and NaN are rejected instead of being silently nulled", () => {
  assert.throws(
    () => propertyInputSchema.parse(baseProperty({ price: "12.5" })),
    /Invalid|regex|expected/i,
  );
  assert.throws(
    () => propertyInputSchema.parse(baseProperty({ price: NaN })),
    /Invalid|expected/i,
  );
});

test("integer fields remain number|null and reject string null", () => {
  assert.throws(
    () => propertyInputSchema.parse(baseProperty({ areaM2: "null" })),
    /Invalid|expected/i,
  );
  const parsed = propertyInputSchema.parse(baseProperty({ areaM2: null, bedrooms: 3 }));
  assert.equal(parsed.areaM2, null);
  assert.equal(parsed.bedrooms, 3);
});
