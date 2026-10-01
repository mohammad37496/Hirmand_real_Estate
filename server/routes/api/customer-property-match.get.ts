import { defineEventHandler, getQuery, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { getCustomerIdentity } from "@/lib/customer-identity.server";

function num(value: unknown) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  const slug = String((getQuery(event) as Record<string, unknown>).slug ?? "").trim();
  if (!slug) return { enabled: false, score: null, reasons: [] };
  if (dbSource === "unconfigured") return { enabled: false, score: null, reasons: [] };

  const { visitorId, userId } = await getCustomerIdentity(event);
  const sql = await getSql();
  const [profileRows, propertyRows] = await Promise.all([
    sql.query<Record<string, unknown>>(
      "select transaction_type,property_type,neighborhoods,min_price,max_price,min_area,max_area,bedrooms,requested_amenities,must_have_amenities " +
      "from customer_need_profiles where visitor_id=$1 or ($2 is not null and user_id=$2) " +
      "order by case when visitor_id=$1 then 0 else 1 end limit 1",
      [visitorId, userId],
    ),
    sql.query<Record<string, unknown>>(
      "select transaction_type,property_type,neighborhood,area_m2,bedrooms,price,deposit,rent,parking,elevator,storage from properties where status='published' and slug=$1 limit 1",
      [slug],
    ),
  ]);
  const profile = profileRows[0];
  const property = propertyRows[0];
  if (!profile || !property) return { enabled: false, score: null, reasons: [] };

  const pTx = String(profile.transaction_type ?? "");
  const pType = String(profile.property_type ?? "");
  const neighborhoods = list(profile.neighborhoods);
  const requested = list(profile.requested_amenities);
  const mustHave = list(profile.must_have_amenities);
  const candidatePrice = num(property.price ?? property.deposit ?? property.rent);
  const candidateArea = num(property.area_m2);
  const candidateBedrooms = num(property.bedrooms);

  let score = 0;
  const reasons: string[] = [];
  const checks: Array<{ ok: boolean; points: number; reason: string }> = [];

  if (!pTx) checks.push({ok:true,points:18,reason:"نوع معامله برای شما باز است"});
  else checks.push({ok:pTx===String(property.transaction_type),points:25,reason:"نوع معامله مطابق نیاز شما"});
  if (!pType) checks.push({ok:true,points:16,reason:"نوع ملک محدود نشده است"});
  else checks.push({ok:pType===String(property.property_type),points:20,reason:"نوع ملک مطابق نیاز شما"});
  if (!neighborhoods.length) checks.push({ok:true,points:10,reason:"محله محدود نشده است"});
  else checks.push({ok:neighborhoods.some(x=>String(property.neighborhood??"").includes(x)),points:15,reason:"محله مورد علاقه شما"});
  if (candidatePrice == null || (profile.min_price==null && profile.max_price==null)) checks.push({ok:true,points:12,reason:"برای قیمت محدودیت دقیقی ثبت نشده"});
  else checks.push({ok:(profile.min_price==null||candidatePrice>=Number(profile.min_price))&&(profile.max_price==null||candidatePrice<=Number(profile.max_price)),points:15,reason:"قیمت در بازه بودجه شماست"});
  if (candidateArea == null || (profile.min_area==null && profile.max_area==null)) checks.push({ok:true,points:8,reason:"متراژ محدود نشده است"});
  else checks.push({ok:(profile.min_area==null||candidateArea>=Number(profile.min_area))&&(profile.max_area==null||candidateArea<=Number(profile.max_area)),points:10,reason:"متراژ در بازه دلخواه شماست"});
  if (profile.bedrooms==null || candidateBedrooms==null) checks.push({ok:true,points:7,reason:"تعداد خواب معیار سخت نیست"});
  else checks.push({ok:candidateBedrooms>=Number(profile.bedrooms),points:7,reason:"تعداد خواب مطابق نیاز شماست"});

  for (const check of checks) {
    if (check.ok) { score += check.points; reasons.push(check.reason); }
  }

  const amenity = (id:string) =>
    id==="parking" ? Boolean(property.parking) :
    id==="elevator" ? Boolean(property.elevator) :
    id==="storage" ? Boolean(property.storage) : false;
  const missing = mustHave.filter(id=>!amenity(id));
  score -= missing.length * 8;
  if (requested.some(amenity)) reasons.push("چند مورد از امکانات مهم شما را دارد");
  const finalScore=Math.max(0,Math.min(100,Math.round(score)));
  return {
    enabled:true,
    score:finalScore,
    reasons:reasons.slice(0,4),
    missingMustHave:missing,
  };
});