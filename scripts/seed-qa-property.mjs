import { PGlite } from "@electric-sql/pglite";

const pg = new PGlite({ dataDir: ".grok/pglite.data" });
await pg.waitReady;

const existing = await pg.query(
  "select count(*)::int as n from properties where slug = $1",
  ["qa-refinement-sample"],
);

if (existing.rows[0].n === 0) {
  await pg.query(
    `insert into properties (
      id, slug, status, featured, title, transaction_type, property_type, city,
      neighborhood, address, area_m2, bedrooms, bathrooms, floor, total_floors,
      built_year, parking, elevator, storage, price, description, features, images,
      contact_name, contact_phone, published_at, latitude, longitude
    ) values (
      'qa-refine-0001', 'qa-refinement-sample', 'published', false, $1, 'sell', 'apartment', 'اصفهان',
      'سعادت‌آباد', 'خیابان گلستان، مجتمع نور', 145, 3, 2, 4, 6,
      1401, true, true, true, 12500000000, $2,
      $3::jsonb,
      '["/images/type-apartment.jpg"]'::jsonb,
      'محمود مرادی', '09131056029', now(), 51.6660, 32.6420
    )`,
    [
      "آپارتمان مدرن سه خوابه سعادت‌آباد",
      "این آپارتمان مدرن با نمای باز و نورگیری عالی، در یکی از بهترین نقاط سعادت‌آباد قرار دارد.\nآشپزخانه اُپن با کابینت تمام‌چوب، کف سرامیک درجه یک و آسانسور پرسرعت از ویژگی‌های آن است.\nمناسب خانواده‌های چهار نفره و سکونت دائم.",
      JSON.stringify(["پارکینگ مسقف", "آسانسور پرسرعت", "بالکن اختصاصی", "کمد دیواری", "درب ضدسرقت"]),
    ],
  );
  console.log("seeded");
} else {
  console.log("already present:", existing.rows[0].n);
}

await pg.close();
