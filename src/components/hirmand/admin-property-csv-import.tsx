import { CheckCircle2, FileSpreadsheet, UploadCloud, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { saveProperty } from "@/lib/properties";

type Row = Record<string, string>;

const aliases: Record<string, string[]> = {
  title: ["title","عنوان","عنوان فایل"],
  transactionType: ["transactiontype","transaction","معامله","نوع معامله"],
  propertyType: ["propertytype","property_type","نوع ملک"],
  neighborhood: ["neighborhood","محله"],
  address: ["address","آدرس"],
  areaM2: ["aream2","area","متراژ"],
  bedrooms: ["bedrooms","خواب","تعداد خواب"],
  bathrooms: ["bathrooms","حمام","تعداد حمام"],
  floor: ["floor","طبقه"],
  builtYear: ["builtyear","سال ساخت"],
  price: ["price","قیمت"],
  deposit: ["deposit","رهن","ودیعه"],
  rent: ["rent","اجاره"],
  description: ["description","توضیحات"],
  features: ["features","امکانات"],
  images: ["images","تصاویر","عکس"],
  contactName: ["contactname","مشاور","نام مشاور"],
  contactPhone: ["contactphone","تلفن","تلفن مشاور"],
  ownerName: ["ownername","مالک"],
  ownerPhone: ["ownerphone","تلفن مالک"],
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[_\-\s]+/g, "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if ((ch === "," || ch === ";") && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
function getValue(row: Row, key: string) {
  const wanted = aliases[key] ?? [];
  for (const alias of wanted) {
    const value = row[normalize(alias)];
    if (value != null) return value.trim();
  }
  return "";
}
function intValue(value: string, min = 0) {
  const n = Number(normalize(value).replace(/[٬،,]/g, ""));
  return Number.isInteger(n) && n >= min ? n : null;
}
function money(value: string) {
  const clean = normalize(value).replace(/[٬،,]/g, "");
  return /^\d{1,20}$/.test(clean) ? clean : null;
}
function mapTx(value: string) {
  const v = normalize(value);
  if (v.includes("rent") || v.includes("اجاره")) return "rent" as const;
  if (v.includes("mortgage") || v.includes("رهن")) return "mortgage" as const;
  if (v.includes("buy") || v.includes("خرید")) return "buy" as const;
  return "sell" as const;
}
function mapType(value: string) {
  const v = normalize(value);
  if (v.includes("villa") || v.includes("ویل")) return "villa" as const;
  if (v.includes("office") || v.includes("ادار")) return "office" as const;
  if (v.includes("land") || v.includes("زمین")) return "land" as const;
  if (v.includes("commercial") || v.includes("تجار")) return "commercial" as const;
  if (v.includes("heritage") || v.includes("قدیم")) return "heritage" as const;
  return "apartment" as const;
}
function csvSample() {
  return ["عنوان,نوع معامله,نوع ملک,محله,متراژ,خواب,قیمت,رهن,اجاره,توضیحات,نام مشاور,تلفن مشاور","آپارتمان نمونه,فروش,آپارتمان,مرداویج,120,2,18000000000,,,فایل نمونه برای ورود گروهی اطلاعات,مشاور هیرمند,09130000000"].join("\n");
}
export function AdminPropertyCsvImport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ok:number;failed:number}>({ok:0,failed:0});

  function loadFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result ?? "").replace(/^\uFEFF/, "");
      const matrix = parseCsv(data);
      if (matrix.length < 2) { toast.error("CSV باید حداقل یک ردیف داده داشته باشد."); return; }
      const headers = matrix[0].map(normalize);
      const mapped = matrix.slice(1, 101).map((values) => {
        const row: Row = {};
        headers.forEach((header, index) => { row[header] = values[index] ?? ""; });
        return row;
      });
      setRows(mapped);
      setResult({ok:0,failed:0});
      setProgress(0);
      if (matrix.length - 1 > 100) toast.warning("برای ایمنی، حداکثر ۱۰۰ ردیف در هر نوبت وارد می‌شود.");
    };
    reader.readAsText(file, "utf-8");
  }

  const validation = useMemo(() => rows.map((row, index) => {
    const title = getValue(row,"title");
    const neighborhood = getValue(row,"neighborhood");
    const phone = getValue(row,"contactPhone");
    const description = getValue(row,"description");
    const errors: string[] = [];
    if (title.length < 3) errors.push("عنوان");
    if (neighborhood.length < 2) errors.push("محله");
    if (phone.length < 8) errors.push("تلفن مشاور");
    if (description.length < 10) errors.push("توضیحات");
    return { index, row, errors, title };
  }), [rows]);

  async function importRows() {
    if (publishing || !validation.length) return;
    setPublishing(true);
    setResult({ok:0,failed:0});
    let ok = 0, failed = 0;
    for (let i = 0; i < validation.length; i++) {
      const item = validation[i];
      if (item.errors.length) { failed++; setProgress(i+1); continue; }
      const row = item.row;
      try {
        await saveProperty({ data: {
          title: item.title,
          transactionType: mapTx(getValue(row,"transactionType")),
          propertyType: mapType(getValue(row,"propertyType")),
          neighborhood: getValue(row,"neighborhood"),
          address: getValue(row,"address"),
          areaM2: intValue(getValue(row,"areaM2")),
          bedrooms: intValue(getValue(row,"bedrooms")),
          bathrooms: intValue(getValue(row,"bathrooms")),
          floor: intValue(getValue(row,"floor"), -60),
          floorLabel: null,
          orientation: null,
          totalFloors: intValue(getValue(row,"totalFloors")),
          builtYear: intValue(getValue(row,"builtYear"),1200),
          parking:false,elevator:false,storage:false,painted:false,wallpaper:false,convertible:false,
          cabinetType:null,flooringType:null,coolingSystem:null,heatingSystem:null,wallClosetType:null,otherAmenities:[],
          price: money(getValue(row,"price")),
          deposit: money(getValue(row,"deposit")),
          rent: money(getValue(row,"rent")),
          description: getValue(row,"description"),
          features: getValue(row,"features").split(/[\n|،,]+/).map((x)=>x.trim()).filter(Boolean).slice(0,20),
          images: getValue(row,"images").split(/[\n|،]+/).map((x)=>x.trim()).filter((x)=>/^https?:\/\//i.test(x)).slice(0,20),
          contactName: getValue(row,"contactName"),
          contactPhone: getValue(row,"contactPhone"),
          ownerName: getValue(row,"ownerName"),
          ownerPhone: getValue(row,"ownerPhone"),
          ownerInfo:"",
          internalPriority:"normal",
          internalNote:"ورود گروهی CSV",
          status:"draft",
          availabilityStatus:"available",
          featured:false,
          featuredUntil:null,
          latitude:null,
          longitude:null,
          virtualTourUrl:"",
        }});
        ok++;
      } catch {
        failed++;
      }
      setProgress(i+1);
      setResult({ok,failed});
    }
    setPublishing(false);
    toast.success(ok ? ok.toLocaleString("fa-IR") + " فایل وارد شد. ردیف‌های نامعتبر یا ناموفق ایجاد نشدند." : "فایلی وارد نشد.");
  }

  return (
    <section className="admin-panel admin-csv-import">
      <div className="admin-panel-head">
        <div><span className="kicker">ورود گروهی</span><h2>ورود فایل‌ها از CSV / Excel ذخیره‌شده به CSV</h2></div>
        <a className="btn-ghost" download="hirmand-property-import-sample.csv" href={"data:text/csv;charset=utf-8," + encodeURIComponent(csvSample())}>نمونه CSV</a>
      </div>
      <div className="admin-csv-body">
        <label className="admin-csv-drop">
          <UploadCloud size={24}/>
          <strong>{fileName || "فایل CSV را انتخاب کنید"}</strong>
          <small>UTF-8 · حداکثر ۱۰۰ ردیف در هر نوبت · فایل‌ها ابتدا پیش‌نمایش می‌شوند</small>
          <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}/>
        </label>
        {!!rows.length && (
          <>
            <div className="admin-csv-summary">
              <span><FileSpreadsheet size={15}/> {rows.length.toLocaleString("fa-IR")} ردیف</span>
              <span><CheckCircle2 size={15}/> آماده: {validation.filter((x)=>!x.errors.length).length.toLocaleString("fa-IR")}</span>
              <span><XCircle size={15}/> خطادار: {validation.filter((x)=>x.errors.length).length.toLocaleString("fa-IR")}</span>
            </div>
            <div className="admin-csv-preview">
              {validation.slice(0,12).map((item) => (
                <div key={item.index} className="admin-csv-row">
                  <strong>{(item.index+1).toLocaleString("fa-IR")}</strong>
                  <span>{item.title || "بدون عنوان"}</span>
                  <small>{item.errors.length ? "ناقص: " + item.errors.join("، ") : "آماده ورود · پیش‌نویس"}</small>
                </div>
              ))}
            </div>
            {progress ? <div className="admin-upload-progress"><span style={{width:(progress / rows.length * 100) + "%"}}/></div> : null}
            <div className="admin-csv-actions">
              <span>موفق: {result.ok.toLocaleString("fa-IR")} · ناموفق: {result.failed.toLocaleString("fa-IR")}</span>
              <button type="button" className="btn-gold" onClick={() => void importRows()} disabled={publishing || !validation.some((x)=>!x.errors.length)}>
                {publishing ? "در حال ورود…" : "شروع ورود گروهی"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
