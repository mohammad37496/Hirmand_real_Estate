import { upload } from "@vercel/blob/client";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Film, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { isVideoUrl } from "@/lib/media";

type Props = {
  adminKey: string;
  value: string;
  onChange: (next: string) => void;
};

function linesToList(raw: string) {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToLines(items: string[]) {
  return items.join("\n");
}

export function AdminMediaField({ adminKey, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const items = linesToList(value);

  function setItems(next: string[]) {
    onChange(listToLines(next.slice(0, 12)));
  }

  function removeAt(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    if (!adminKey) {
      toast.error("ابتدا وارد پنل مدیریت شوید.");
      return;
    }
    if (items.length + list.length > 12) {
      toast.error("حداکثر ۱۲ فایل رسانه مجاز است.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const uploaded: string[] = [];

    try {
      for (let index = 0; index < list.length; index += 1) {
        const file = list[index]!;
        const safeName = file.name
          .replace(/[^\w.\u0600-\u06FF-]+/g, "-")
          .slice(0, 90);
        const pathname = "properties/" + Date.now() + "-" + index + "-" + safeName;

        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          headers: { "x-hirmand-admin-key": adminKey },
          clientPayload: JSON.stringify({
            contentType: file.type,
            sizeBytes: file.size,
          }),
          multipart: file.size >= 5 * 1024 * 1024,
          onUploadProgress: (event) => {
            setUploadProgress(Math.max(0, Math.min(100, event.percentage)));
          },
        });

        uploaded.push(blob.url);
      }

      setItems([...items, ...uploaded]);
      toast.success(
        uploaded.length === 1
          ? "فایل با موفقیت آپلود شد."
          : uploaded.length.toLocaleString("fa-IR") + " فایل آپلود شد.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "آپلود انجام نشد.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  function onPick(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) void uploadFiles(e.target.files);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="admin-media">
      <div
        className={`admin-media-drop${dragOver ? " is-over" : ""}${uploading ? " is-busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          multiple
          hidden
          onChange={onPick}
        />
        {uploading ? (
          <>
            <Loader2 size={22} className="admin-spin" />
            <strong>در حال آپلود… {uploadProgress}%</strong>
          </>
        ) : (
          <>
            <Upload size={22} />
            <strong>آپلود از گالری یا کامپیوتر</strong>
            <span>تصویر یا ویدیو را بکشید و رها کنید · یا کلیک کنید</span>
            <small>jpg / png / webp / mp4 / webm · حداکثر ۲۵ مگابایت برای هر فایل · تا ۱۲ فایل</small>
          </>
        )}
      </div>

      {items.length ? (
        <div className="admin-media-grid">
          {items.map((src, index) => {
            const video = isVideoUrl(src);
            return (
              <div key={`${src}-${index}`} className="admin-media-item">
                {video ? (
                  <video src={src} muted playsInline preload="metadata" />
                ) : (
                  <img src={src} alt="" loading="lazy" />
                )}
                <span className="admin-media-badge">{video ? <Film size={12} /> : <ImagePlus size={12} />}</span>
                <button
                  type="button"
                  className="admin-media-remove"
                  onClick={() => removeAt(index)}
                  title="حذف"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <label className="field" style={{ marginTop: 12 }}>
        <span>یا لینک مستقیم تصویر/ویدیو (هر خط یک آدرس)</span>
        <textarea
          rows={3}
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={"https://...\nhttps://..."}
        />
      </label>
    </div>
  );
}
