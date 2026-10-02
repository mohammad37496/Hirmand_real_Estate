import { createError, defineEventHandler, getCookie, readBody, setResponseHeader } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { isAllowedMediaRef, isVideoUrl } from "@/lib/media";
import { assertSameOrigin, clientFingerprint, consumeAdminAttempt, tooManyAttemptsError } from "@/lib/admin-rate-limit.server";

const VISITOR_COOKIE = "hirmand_visitor_id";

function createTrackingToken() {
  const year = String(new Date().getFullYear()).slice(-2);
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
  return "HIR-" + year + "-" + random;
}

const moneyField = z.union([z.string().regex(/^\d{1,20}$/), z.null()]).optional().default(null);
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

const submissionSchema = z.object({
  website: z.string().max(0).optional().default(""),
  ownerName: z.string().trim().min(2).max(80),
  ownerPhone: z.string().trim().regex(/^09\d{9}$/),
  title: z.string().trim().min(8).max(180),
  transactionType: z.enum(["buy","sell","rent","mortgage"]),
  propertyType: z.enum(["apartment","villa","office","heritage","land","commercial"]),
  neighborhood: z.string().trim().min(2).max(80),
  address: z.string().trim().max(240).optional().default(""),
  areaM2: z.number().int().min(1).max(100000),
  bedrooms: z.number().int().min(0).max(30).nullable().optional().default(null),
  bathrooms: z.number().int().min(0).max(30).nullable().optional().default(null),
  floor: z.number().int().min(-60).max(200).nullable().optional().default(null),
  totalFloors: z.number().int().min(0).max(200).nullable().optional().default(null),
  builtYear: z.number().int().min(1200).max(2500).nullable().optional().default(null),
  orientation: z.enum(["north","south","east","west","northeast","northwest","southeast","southwest","two_fronts","three_fronts","four_fronts","other"]).nullable().optional().default(null),
  parking: z.boolean().default(false),
  elevator: z.boolean().default(false),
  storage: z.boolean().default(false),
  painted: z.boolean().default(false),
  wallpaper: z.boolean().default(false),
  convertible: z.boolean().default(false),
  cabinetType: optionalText(40),
  flooringType: optionalText(40),
  coolingSystem: optionalText(40),
  heatingSystem: optionalText(40),
  wallClosetType: optionalText(40),
  otherAmenities: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  price: moneyField,
  deposit: moneyField,
  rent: moneyField,
  description: z.string().trim().min(80).max(5000),
  features: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  images: z.array(z.string().trim().min(1).max(2048).refine(isAllowedMediaRef, "نشانی رسانه نامعتبر است.")).min(1).max(20),
  latitude: z.number().finite().min(-90).max(90).nullable().optional().default(null),
  longitude: z.number().finite().min(-180).max(180).nullable().optional().default(null),
}).superRefine((value, ctx) => {
  const videos = value.images.filter((src) => isVideoUrl(src));
  const images = value.images.filter((src) => !isVideoUrl(src));
  if (!images.length) ctx.addIssue({ code:"custom", path:["images"], message:"حداقل یک تصویر لازم است." });
  if (videos.length > 1) ctx.addIssue({ code:"custom", path:["images"], message:"حداکثر یک ویدئو مجاز است." });
  const hasMoney = (v: string | null) => Boolean(v && /^\d{1,20}$/.test(v));
  if (value.transactionType === "sell" && !hasMoney(value.price)) ctx.addIssue({ code:"custom", path:["price"], message:"برای فروش قیمت کل را وارد کنید." });
  if (value.transactionType === "rent" && !hasMoney(value.deposit) && !hasMoney(value.rent)) ctx.addIssue({ code:"custom", path:["deposit"], message:"برای اجاره حداقل رهن یا اجاره را وارد کنید." });
  if (value.transactionType === "mortgage" && !hasMoney(value.deposit)) ctx.addIssue({ code:"custom", path:["deposit"], message:"برای رهن مبلغ رهن را وارد کنید." });
});

function buildLeadNote(data: z.infer<typeof submissionSchema>) {
  return [
    "ثبت کامل ملک توسط مشتری — در انتظار بررسی کارشناس",
    "عنوان: " + data.title,
    "نوع معامله: " + data.transactionType,
    "نوع ملک: " + data.propertyType,
    "محله: " + data.neighborhood,
    "متراژ: " + String(data.areaM2) + " متر",
    "رسانه: " + String(data.images.length) + " فایل",
  ].join("\n");
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  if (dbSource === "unconfigured") throw createError({ statusCode: 503, statusMessage: "ثبت ملک آنلاین موقتاً در دسترس نیست." });
  assertSameOrigin(event);

  const attempt = await consumeAdminAttempt("customer-property:" + clientFingerprint(event));
  if (!attempt.allowed) throw tooManyAttemptsError(attempt.retryAfterSeconds);

  const parsed = submissionSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || "اطلاعات ملک ناقص یا نامعتبر است." });
  }
  if (parsed.data.website) throw createError({ statusCode: 400, statusMessage: "درخواست نامعتبر است." });

  const sql = await getSql();
  const trackingToken = createTrackingToken();
  const submissionId = crypto.randomUUID();
  const leadId = crypto.randomUUID();
  void getCookie(event, VISITOR_COOKIE);

  const existing = await sql.query<{ id:string; public_tracking_token:string|null }>(
    "select id, public_tracking_token from customer_property_submissions where owner_phone=$1 and created_at > current_timestamp - interval '30 minutes' and status='pending' limit 1",
    [parsed.data.ownerPhone],
  );
  if (existing[0]) {
    return { success:true, duplicate:true, trackingToken: existing[0].public_tracking_token || trackingToken };
  }

  try {
    await sql.query(
      "insert into leads (id,name,phone,people_count,job,deal,property_type,neighborhood,consultant,note,source,follow_up_at,public_tracking_token) values ($1,$2,$3,1,$4,$5,$6,$7,'',$8,'website',current_timestamp + interval '2 hours',$9)",
      [
        leadId,
        parsed.data.ownerName,
        parsed.data.ownerPhone,
        "مالک",
        "ثبت ملک - " + parsed.data.transactionType,
        parsed.data.propertyType,
        parsed.data.neighborhood,
        buildLeadNote(parsed.data),
        trackingToken,
      ],
    );
    await sql.query(
      "insert into customer_property_submissions (id,lead_id,public_tracking_token,status,owner_name,owner_phone,property_data) values ($1,$2,$3,'pending',$4,$5,$6::jsonb)",
      [
        submissionId,
        leadId,
        trackingToken,
        parsed.data.ownerName,
        parsed.data.ownerPhone,
        JSON.stringify(parsed.data),
      ],
    );
    await sql.query(
      "insert into lead_activities (lead_id,activity_type,title,note,metadata) values ($1,'follow_up',$2,$3,$4::jsonb)",
      [
        leadId,
        "ثبت ملک توسط مشتری",
        "ملک جدید برای بررسی و انتشار ارسال شده است.",
        JSON.stringify({ submissionId, mediaCount: parsed.data.images.length }),
      ],
    ).catch(() => {});
  } catch (error) {
    await sql.query("delete from leads where id=$1", [leadId]).catch(() => {});
    throw error;
  }

  return {
    success:true,
    duplicate:false,
    submissionId,
    trackingToken,
    message:"ملک شما با موفقیت برای بررسی کارشناسان هیرمند ارسال شد.",
  };
});
