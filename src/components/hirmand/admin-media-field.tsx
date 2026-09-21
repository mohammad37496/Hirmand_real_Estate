import { uploadErrorMessage, uploadInChunks } from "@/lib/media-upload-client";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ChevronDown, ChevronUp, Film, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { MAX_PROPERTY_MEDIA, isVideoUrl } from "@/lib/media";

type Props = {
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

const MAX_IMAGE_DIMENSION = 2560;
const IMAGE_QUALITY = 0.82;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

async function loadImageDimensions(file: File): Promise<{ width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("خواندن تصویر انجام نشد."));
      element.src = objectUrl;
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function optimizeImage(file: File): Promise<{ file: File; savedBytes: number }> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return { file, savedBytes: 0 };
  }

  if (file.type === "image/webp") {
    const dimensions = await loadImageDimensions(file);
    dimensions.close?.();
    if (dimensions.width <= MAX_IMAGE_DIMENSION && dimensions.height <= MAX_IMAGE_DIMENSION) {
      return { file, savedBytes: 0 };
    }
  }

  const dimensions = await loadImageDimensions(file);
  const maxDimension = Math.max(dimensions.width, dimensions.height);
  const scale = maxDimension > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / maxDimension : 1;
  const width = Math.max(1, Math.round(dimensions.width * scale));
  const height = Math.max(1, Math.round(dimensions.height * scale));
  dimensions.close?.();

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("پردازش تصویر انجام نشد."));
      element.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return { file, savedBytes: 0 };

    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", IMAGE_QUALITY),
    );

    if (!blob || blob.size >= file.size) {
      return { file, savedBytes: 0 };
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "property-image";
    const optimized = new File([blob], baseName + ".webp", {
      type: "image/webp",
      lastModified: Date.now(),
    });
    return { file: optimized, savedBytes: file.size - optimized.size };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function AdminMediaField({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const items = linesToList(value);

  function setItems(next: string[]) {
    const unique = Array.from(new Set(next.map((item) => item.trim()).filter(Boolean)));
    onChange(listToLines(unique.slice(0, MAX_PROPERTY_MEDIA)));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const next = [...items];
    const current = next[index]!;
    next[index] = next[nextIndex]!;
    next[nextIndex] = current;
    setItems(next);
  }

  function reorderByDrag(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setItems(next);
  }

  function removeAt(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    if (items.length + list.length > MAX_PROPERTY_MEDIA) {
      toast.error(`حداکثر ${MAX_PROPERTY_MEDIA.toLocaleString("fa-IR")} فایل رسانه مجاز است.`);
      return;
    }

    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ]);
    if (list.some((file) => !allowedTypes.has(file.type))) {
      toast.error("نوع یکی از فایل‌ها پشتیبانی نمی‌شود.");
      return;
    }
    if (list.some((file) => file.size > MAX_FILE_BYTES)) {
      toast.error("حجم فایل اولیه باید حداکثر ۲۵ مگابایت باشد.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const uploaded: string[] = [];
    let optimizedBytes = 0;

    try {
      for (let index = 0; index < list.length; index += 1) {
        const originalFile = list[index]!;
        const optimized = await optimizeImage(originalFile);
        const file = optimized.file;
        optimizedBytes += optimized.savedBytes;

        const result = await uploadInChunks({
          endpoint: "/api/upload",
          file,
          contentType: file.type,
          rejectedMessage: "نوع یا حجم این فایل رسانه‌ای پذیرفته نشد.",
          onProgress: (percentage) => setUploadProgress(percentage),
        });

        const url = typeof result.response.url === "string" ? result.response.url : "";
        if (!url) throw new Error("نشانی فایل آپلودشده دریافت نشد.");
        uploaded.push(url);
      }

      setItems([...items, ...uploaded]);
      const savedLabel = optimizedBytes > 0
        ? ` · ${Math.round(optimizedBytes / 1024 / 1024)} مگابایت حجم کم شد`
        : "";

      toast.success(
        uploaded.length === 1
          ? "فایل با موفقیت آپلود شد." + savedLabel
          : uploaded.length.toLocaleString("fa-IR") + " فایل آپلود شد." + savedLabel,
      );
    } catch (err) {
      toast.error(uploadErrorMessage(err, "آپلود انجام نشد."));
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
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime"
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
            <small>jpg / png / webp / gif / svg / mp4 / webm · تصاویر به WebP و حداکثر ۲۵۶۰px بهینه می‌شوند · حداکثر ۲۵ مگابایت · تا ۱۲ فایل</small>
          </>
        )}
      </div>

      {items.length ? (
        <>
          <div className="admin-media-toolbar">
            <strong>{items.length.toLocaleString("fa-IR")} رسانه از ۱۲</strong>
            <span>اولین مورد کاور اصلی است · برای جابه‌جایی، رسانه را بکشید و روی جای جدید رها کنید.</span>
          </div>
          <div className="admin-media-grid">
            {items.map((src, index) => {
              const video = isVideoUrl(src);
              return (
                <div
                  key={`${src}-${index}`}
                  className={`admin-media-item${index === 0 ? " is-primary" : ""}${dragIndex === index ? " is-dragging" : ""}`}
                  draggable={!uploading}
                  onDragStart={(e) => { setDragIndex(index); e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={(e) => { e.preventDefault(); reorderByDrag(dragIndex ?? index, index); setDragIndex(null); }}
                  onDragEnd={() => setDragIndex(null)}
                >
                  {video ? (
                    <video src={src} muted playsInline preload="metadata" />
                  ) : (
                    <img src={src} alt="" loading="lazy" />
                  )}
                  {index === 0 ? <span className="admin-media-primary">کاور اصلی</span> : null}
                  <span className="admin-media-badge">{video ? <Film size={12} /> : <ImagePlus size={12} />}</span>
                  <div className="admin-media-controls">
                    <button type="button" className="admin-media-move" onClick={() => moveItem(index, -1)} disabled={index === 0} title="بالا">
                      <ChevronUp size={13} />
                    </button>
                    <button type="button" className="admin-media-move" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} title="پایین">
                      <ChevronDown size={13} />
                    </button>
                    <button type="button" className="admin-media-remove" onClick={() => removeAt(index)} title="حذف">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
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
