import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { DIVAR_EXTRA_AREA_GROUP, mergeNeighborhoodGroups, normalizeAreaDirectoryKey } from "./area-directory-core.ts";

const catalog = JSON.parse(await readFile(new URL("../../data/divar-isfahan-neighborhoods.json", import.meta.url), "utf8"));

test("bundled Divar Isfahan snapshot has complete, valid neighborhood geometry", () => {
  assert.equal(catalog.city?.slug, "isfahan");
  assert.ok(catalog.districts.length >= 250);
  assert.equal(new Set(catalog.districts.map((item: {id: number|string}) => String(item.id))).size, catalog.districts.length);
  for (const item of catalog.districts) {
    assert.ok(item.name && item.slug);
    assert.ok(Number.isFinite(item.default_location?.latitude));
    assert.ok(Number.isFinite(item.default_location?.longitude));
    assert.ok(Array.isArray(item.bbox) && item.bbox.length === 4);
    assert.ok(item.bbox.every((coordinate: number) => Number.isFinite(coordinate)));
  }
});

test("Persian name normalization handles ZWNJ and Arabic letter variants", () => {
  assert.equal(normalizeAreaDirectoryKey("شهرک ولی‌عصر"), normalizeAreaDirectoryKey("شهرک ولیعصر"));
  assert.equal(normalizeAreaDirectoryKey("كوى"), normalizeAreaDirectoryKey("کوی"));
});

test("matches Dorcheh and Valiasr geometry and preserves every Divar ID", () => {
  const groups = mergeNeighborhoodGroups([{title:"غرب",items:[{name:"درچه"},{name:"شهرک ولی‌عصر"}]}], catalog.districts);
  const items = groups.flatMap((group: {items: Array<Record<string, any>>}) => group.items);
  const dorcheh = items.find((item: any) => item.name === "درچه");
  const valiasr = items.find((item: any) => item.name === "شهرک ولی‌عصر");
  assert.equal(dorcheh?.divarDistrictId, "1547");
  assert.equal(dorcheh?.divarSlug, "dorcheh");
  assert.deepEqual([dorcheh?.lat, dorcheh?.lng], [32.613102, 51.5545082]);
  assert.deepEqual(valiasr?.divarBbox?.map((value: number) => Number(value.toFixed(7))), [51.6557426,32.7353516,51.6666031,32.7431221]);
  const represented = new Set(items.map((item: any) => item.divarDistrictId).filter(Boolean));
  for (const district of catalog.districts) assert.ok(represented.has(String(district.id)), "missing Divar ID " + district.id + " " + district.name);
  assert.ok(groups.some((group: {title: string}) => group.title === DIVAR_EXTRA_AREA_GROUP));
});
