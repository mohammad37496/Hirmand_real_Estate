import assert from "node:assert/strict";
import test from "node:test";
import {
  isMoneyText,
  nullableMoneyFieldSchema,
  nullableNumericValue,
  normalizeMoneyInput,
  normalizeMoneyText,
} from "./property-input-normalization.ts";

test("money normalization treats null-like values as null without changing real digits", () => {
  assert.equal(normalizeMoneyInput("null"), null);
  assert.equal(normalizeMoneyInput(" undefined "), null);
  assert.equal(normalizeMoneyText("۱۲۳٬۴۵۶"), "123456");
  assert.equal(normalizeMoneyText("1,234,567"), "1234567");
  assert.equal(normalizeMoneyText(""), "");
  assert.equal(isMoneyText("99999999999999999999"), true);
});

test("money schema owns the contract as string|null", () => {
  assert.equal(nullableMoneyFieldSchema.parse("null"), null);
  assert.equal(nullableMoneyFieldSchema.parse(""), null);
  assert.equal(nullableMoneyFieldSchema.parse("۱۲۳۴۵۶"), "123456");
  assert.equal(nullableMoneyFieldSchema.parse("99999999999999999999"), "99999999999999999999");
});

test("finite legacy numeric money payloads are normalized to strings", () => {
  assert.equal(nullableMoneyFieldSchema.parse(1500000000), "1500000000");
  assert.equal(nullableMoneyFieldSchema.parse(null), null);
});

test("malformed money and NaN are rejected instead of being silently nulled", () => {
  assert.throws(() => nullableMoneyFieldSchema.parse("12.5"), /Invalid|regex|expected/i);
  assert.throws(() => nullableMoneyFieldSchema.parse("NaN"), /Invalid|regex|expected/i);
  assert.throws(() => nullableMoneyFieldSchema.parse(NaN), /Invalid|expected/i);
});

test("integer input contract rejects malformed non-empty values", async () => {
  const { isInvalidIntegerInput, nullableIntegerInput } = await import("./property-input-normalization.ts");
  assert.equal(isInvalidIntegerInput("۱۲۳٬۴۵۶"), false);
  assert.equal(nullableIntegerInput("۱۲۳٬۴۵۶"), 123456);
  assert.equal(isInvalidIntegerInput(""), false);
  assert.equal(nullableIntegerInput(""), null);
  assert.equal(isInvalidIntegerInput("null"), false);
  assert.equal(nullableIntegerInput("null"), null);
  assert.equal(isInvalidIntegerInput("NaN"), true);
  assert.equal(isInvalidIntegerInput("12.5"), true);
  assert.equal(isInvalidIntegerInput("-2"), true);
  assert.equal(isInvalidIntegerInput("-2", true), false);
});

// `pg` and PGlite return PostgreSQL `numeric` columns as strings. A mapping
// helper that only accepts numbers silently nulls them, which is how
// price_drop_percent became permanently null and the price-drop badge never
// rendered. This pins the numeric read boundary.
test("nullableNumericValue keeps numeric columns that arrive as strings", () => {
  assert.equal(nullableNumericValue("12.50"), 12.5);
  assert.equal(nullableNumericValue("0"), 0);
  assert.equal(nullableNumericValue(" -3.25 "), -3.25);
  assert.equal(nullableNumericValue("1e3"), 1000);
  assert.equal(nullableNumericValue("۱۲٫۵"), 12.5);
});

test("nullableNumericValue still passes real numbers straight through", () => {
  assert.equal(nullableNumericValue(12.5), 12.5);
  assert.equal(nullableNumericValue(0), 0);
  assert.equal(nullableNumericValue(-7), -7);
});

test("nullableNumericValue nulls anything that is not a finite number", () => {
  for (const value of [
    null,
    undefined,
    "",
    "   ",
    "null",
    "abc",
    "1,5",
    "12.5%",
    "1 000",
    NaN,
    Infinity,
    -Infinity,
    {},
    [],
    true,
  ]) {
    assert.equal(nullableNumericValue(value), null, `expected null for ${JSON.stringify(value)}`);
  }
});
